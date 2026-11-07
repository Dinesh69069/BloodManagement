import mongoose from 'mongoose';
import { env } from '../config/environment.js';

export class MongoReplicaSetRequiredError extends Error {
  constructor() {
    super('MongoDB replica set transactions are required for this operation.');
    this.name = 'MongoReplicaSetRequiredError';
  }
}

export class InsufficientStockError extends Error {
  constructor() {
    super('There is not enough recorded inventory to fulfill this request.');
    this.name = 'InsufficientStockError';
  }
}

export async function withMongoTransaction(operation) {
  const db = mongoose.connection.db;
  if (!db) throw new Error('MongoDB is not connected.');
  let topology;
  try {
    topology = await db.command({ hello: 1 })
      .catch(() => db.command({ ismaster: 1 }));
  } catch {
    topology = { setName: 'atlas-replica-set' };
  }
  const session = await mongoose.startSession();
  try {
    if (!topology?.setName) {
      if (env.isProduction) throw new MongoReplicaSetRequiredError();
      return await operation(session);
    }
    let result;
    await session.withTransaction(async () => {
      result = await operation(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

