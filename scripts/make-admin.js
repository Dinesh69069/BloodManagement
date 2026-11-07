import 'dotenv/config';
import mongoose from 'mongoose';
import { User } from '../backend/src/models/user.model.js';

mongoose.set('strictQuery', false);

const email = process.argv[2]?.trim().toLowerCase();

if (!email) {
  console.error('Usage: node scripts/make-admin.js <user-email>');
  process.exit(1);
}

const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/lifeline';

try {
  await mongoose.connect(mongoUri);
  const user = await User.findOneAndUpdate(
    { email },
    { $set: { role: 'admin' } },
    { new: true }
  );

  if (!user) {
    console.error(`User with email "${email}" was not found. Please sign up first.`);
    process.exitCode = 1;
  } else {
    console.log(`Success: User "${user.fullName}" (${user.email}) is now an administrator.`);
  }
} catch (error) {
  console.error('Database connection error:', error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}

