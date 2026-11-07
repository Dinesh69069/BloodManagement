import MongoStore from 'connect-mongo';
import mongoose from 'mongoose';
import { app, setSessionStore } from './app.js';
import { env } from './config/environment.js';
import {
  connectDatabase,
  migrateLegacyAccountStatus,
  migrateUnverifiableDonorConsent,
} from './config/database.js';
import { logServerError } from './middleware/error.middleware.js';

let server;

if (process.env.NODE_ENV !== 'test') {
  connectDatabase()
    .then((mongoClient) => {
      setSessionStore(MongoStore.create({ client: mongoClient, collectionName: 'sessions' }));
      server = app.listen(env.port, '0.0.0.0', () => {
        console.log(`LifeLine Blood Bank platform running on port ${env.port}`);
        console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`Frontend Views: ${env.paths.views}`);
      });
    })
    .catch(async (error) => {
      console.error('MongoDB connection failed. Check MONGODB_URI and database availability.');
      logServerError(error);
      await mongoose.disconnect().catch(logServerError);
      process.exitCode = 1;
    });

  // Graceful shutdown handling
  const shutdown = async (signal) => {
    console.log(`\nReceived ${signal}. Gracefully shutting down...`);
    if (server) {
      server.close(() => console.log('HTTP server closed.'));
    }
    await mongoose.disconnect().catch(logServerError);
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

export { app, migrateLegacyAccountStatus, migrateUnverifiableDonorConsent };

