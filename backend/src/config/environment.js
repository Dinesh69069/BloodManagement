import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomBytes } from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../..');

const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';
const port = Number(process.env.PORT || 3000);
const configuredMongoUri = process.env.MONGODB_URI;
const configuredSessionSecret = process.env.SESSION_SECRET || process.env.SECRET_KEY;
const configuredTrustProxyHops = process.env.TRUST_PROXY_HOPS;

if (configuredTrustProxyHops && !/^\d+$/.test(configuredTrustProxyHops)) {
  throw new Error('TRUST_PROXY_HOPS must be a non-negative integer.');
}
if (isProduction && !configuredMongoUri) {
  throw new Error('Set MONGODB_URI to the production database connection string.');
}
if (isProduction && (!configuredSessionSecret || configuredSessionSecret.length < 32)) {
  throw new Error('Set SESSION_SECRET to a random value of at least 32 characters in .env.');
}
if (!configuredSessionSecret && !isTest) {
  console.warn('No SESSION_SECRET configured; using a temporary local-development session secret.');
}

const sessionSecret = configuredSessionSecret?.length >= 32
  ? configuredSessionSecret
  : configuredSessionSecret
    ? createHash('sha256').update(configuredSessionSecret).digest('hex')
    : randomBytes(32).toString('hex');

const mongoUri = configuredMongoUri || 'mongodb://127.0.0.1:27017/lifeline';

export const env = {
  isProduction,
  isTest,
  port,
  mongoUri,
  sessionSecret,
  trustProxyHops: configuredTrustProxyHops ? Number(configuredTrustProxyHops) : null,
  directoryConsentPolicyVersion: '1.0',
  paths: {
    root: rootDir,
    backend: path.resolve(rootDir, 'backend'),
    frontend: path.resolve(rootDir, 'frontend'),
    views: path.resolve(rootDir, 'frontend', 'views'),
    public: path.resolve(rootDir, 'frontend', 'public'),
    uploads: path.resolve(rootDir, 'uploads', 'donors'),
  },
};

