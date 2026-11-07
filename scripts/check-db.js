import 'dotenv/config';
import mongoose from 'mongoose';

mongoose.set('strictQuery', false);

const uri = process.env.MONGODB_URI;
console.log('Connecting to Atlas Cluster...');

try {
  await mongoose.connect(uri);
  const adminDb = mongoose.connection.db.admin();
  const dbs = await adminDb.listDatabases();
  console.log('\n=======================================');
  console.log('Databases on your MongoDB Atlas Cluster:');
  console.log('=======================================');
  for (const db of dbs.databases) {
    console.log(` • ${db.name} (${(db.sizeOnDisk / 1024).toFixed(1)} KB)`);
  }

  const currentDbName = mongoose.connection.db.databaseName;
  const collections = await mongoose.connection.db.listCollections().toArray();
  console.log('\n=======================================');
  console.log(`Collections inside database "${currentDbName}":`);
  console.log('=======================================');
  for (const col of collections) {
    const count = await mongoose.connection.db.collection(col.name).countDocuments();
    console.log(` • ${col.name}: ${count} document(s)`);
  }
  console.log('=======================================\n');
} catch (err) {
  console.error('Connection Error:', err.message);
} finally {
  await mongoose.disconnect();
}
