import mongoose from 'mongoose';
import { env } from './environment.js';
import { BLOOD_GROUPS } from '../utils/blood.util.js';
import { BloodStock } from '../models/blood-stock.model.js';
import { Donor } from '../models/donor.model.js';
import { User } from '../models/user.model.js';

mongoose.set('strictQuery', false);

export async function migrateUnverifiableDonorConsent() {
  return Donor.updateMany(
    { directoryConsentStatus: { $exists: false } },
    {
      $set: {
        directoryConsent: false,
        directoryConsentStatus: 'unknown',
        directoryConsentUpdatedAt: null,
        photoConsent: false,
        photoConsentStatus: 'unknown',
        photoConsentUpdatedAt: null,
        available: false,
      },
    },
  );
}

export async function migrateLegacyAccountStatus() {
  return User.updateMany(
    { accountStatus: { $exists: false } },
    { $set: { accountStatus: 'active', deletionRequestedAt: null, deletionReviewedAt: null, deletionReviewedBy: null } },
  );
}

export async function connectDatabase() {
  if (env.isTest) return null;

  await mongoose.connect(env.mongoUri);

  try {
    const topology = await mongoose.connection.db.command({ hello: 1 })
      .catch(() => mongoose.connection.db.command({ ismaster: 1 }));

    if (env.isProduction && !topology?.setName) {
      console.warn('Notice: Replica set setName not detected via hello command; continuing with connected database.');
    }
  } catch (err) {
    console.warn('Notice: Could not query hello/ismaster command; continuing with connected database:', err.message);
  }

  await Promise.all([
    migrateLegacyAccountStatus(),
    ...BLOOD_GROUPS.map((bloodGroup) =>
      BloodStock.updateOne({ bloodGroup }, { $setOnInsert: { units: 0 } }, { upsert: true })),
    migrateUnverifiableDonorConsent(),
  ]);

  return mongoose.connection.getClient();
}

