import 'dotenv/config';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import {
  BloodBank,
  BloodRequest,
  BloodStock,
  ContactMessage,
  Donation,
  Donor,
  User,
} from '../backend/src/models/index.js';
import { BLOOD_GROUPS } from '../backend/src/utils/blood.util.js';

mongoose.set('strictQuery', false);

const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/lifeline';

const sampleBanks = [
  {
    name: 'City Central Blood Bank',
    address: 'Sector 14, Main Medical Road',
    city: 'Cuttack',
    phone: '+91 671 2304567',
    email: 'cuttack.central@example.org',
    openingHours: 'Open 24/7',
    bloodGroups: ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'],
    verified: true,
  },
  {
    name: 'Metropolitan Red Cross Center',
    address: '42 Park Avenue, Civil Lines',
    city: 'Bhubaneswar',
    phone: '+91 674 2501234',
    email: 'bbsr.redcross@example.org',
    openingHours: 'Mon–Sun: 8:00 AM – 9:00 PM',
    bloodGroups: ['A+', 'B+', 'O+', 'O-', 'AB+'],
    verified: true,
  },
  {
    name: 'Apex Memorial Blood Center',
    address: '88 Healthcare Boulevard',
    city: 'Mumbai',
    phone: '+91 22 26549870',
    email: 'apex.mumbai@example.org',
    openingHours: 'Open 24/7',
    bloodGroups: ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'],
    verified: true,
  },
  {
    name: 'National Community Blood Bank',
    address: '15 Health Enclave, Connaught Place',
    city: 'Delhi',
    phone: '+91 11 23456789',
    email: 'delhi.community@example.org',
    openingHours: 'Mon–Sat: 8:00 AM – 8:00 PM',
    bloodGroups: ['A+', 'A-', 'B+', 'O+', 'O-', 'AB+'],
    verified: true,
  },
];

const sampleStock = {
  'A+': 32,
  'A-': 14,
  'B+': 45,
  'B-': 12,
  'AB+': 18,
  'AB-': 8,
  'O+': 55,
  'O-': 10,
};

async function seed() {
  console.log('Connecting to MongoDB...');
  try {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
  } catch (error) {
    console.error('Cannot connect to MongoDB:', error.message);
    console.error('Make sure your MongoDB server or replica set is running at:', mongoUri);
    process.exit(1);
  }

  console.log('Connected successfully. Seeding initial data...');

  // 1. Seed Blood Stock
  console.log('Updating blood inventory...');
  for (const group of BLOOD_GROUPS) {
    const units = sampleStock[group] || 10;
    await BloodStock.updateOne(
      { bloodGroup: group },
      { $set: { units } },
      { upsert: true },
    );
  }
  console.log(`  ✓ Updated inventory levels for all ${BLOOD_GROUPS.length} blood groups.`);

  // 2. Seed Verified Blood Banks
  console.log('Seeding verified blood banks...');
  let banksAdded = 0;
  for (const bank of sampleBanks) {
    const existing = await BloodBank.findOne({ name: bank.name, city: bank.city });
    if (!existing) {
      await BloodBank.create(bank);
      banksAdded++;
    }
  }
  console.log(`  ✓ Added ${banksAdded} new verified blood banks (total now ${await BloodBank.countDocuments()}).`);

  // 3. Seed Default Admin Account
  const adminEmail = 'admin@lifeline.org';
  const existingAdmin = await User.findOne({ email: adminEmail });
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash('Admin@12345', 12);
    await User.create({
      fullName: 'LifeLine Administrator',
      email: adminEmail,
      phone: '+91 9876543210',
      passwordHash,
      role: 'admin',
      accountStatus: 'active',
    });
    console.log(`  ✓ Created default administrator account: ${adminEmail} (password: Admin@12345)`);
  } else {
    if (existingAdmin.role !== 'admin') {
      existingAdmin.role = 'admin';
      await existingAdmin.save();
      console.log(`  ✓ Elevated existing account ${adminEmail} to administrator role.`);
    } else {
      console.log(`  ✓ Default administrator ${adminEmail} already exists.`);
    }
  }

  // 4. Seed Sample Donors
  console.log('Seeding sample available donors...');
  const sampleDonors = [
    {
      fullName: 'Rahul Sharma',
      phone: '+91 9811223344',
      bloodGroup: 'O+',
      age: 29,
      gender: 'Male',
      city: 'Cuttack',
      address: 'CDA Sector 9',
      available: true,
      directoryConsent: true,
      directoryConsentStatus: 'consented',
      directoryConsentUpdatedAt: new Date(),
      directoryConsentPolicyVersion: '1.0',
    },
    {
      fullName: 'Priya Patel',
      phone: '+91 9822334455',
      bloodGroup: 'A+',
      age: 26,
      gender: 'Female',
      city: 'Bhubaneswar',
      address: 'Saheed Nagar',
      available: true,
      directoryConsent: true,
      directoryConsentStatus: 'consented',
      directoryConsentUpdatedAt: new Date(),
      directoryConsentPolicyVersion: '1.0',
    },
    {
      fullName: 'Amit Kumar Sen',
      phone: '+91 9833445566',
      bloodGroup: 'B+',
      age: 34,
      gender: 'Male',
      city: 'Mumbai',
      address: 'Andheri West',
      available: true,
      directoryConsent: true,
      directoryConsentStatus: 'consented',
      directoryConsentUpdatedAt: new Date(),
      directoryConsentPolicyVersion: '1.0',
    },
    {
      fullName: 'Ananya Roy',
      phone: '+91 9844556677',
      bloodGroup: 'O-',
      age: 31,
      gender: 'Female',
      city: 'Delhi',
      address: 'Saket Enclave',
      available: true,
      directoryConsent: true,
      directoryConsentStatus: 'consented',
      directoryConsentUpdatedAt: new Date(),
      directoryConsentPolicyVersion: '1.0',
    },
    {
      fullName: 'Vikramjit Singh',
      phone: '+91 9855667788',
      bloodGroup: 'AB+',
      age: 40,
      gender: 'Male',
      city: 'Cuttack',
      address: 'Buxi Bazaar',
      available: true,
      directoryConsent: true,
      directoryConsentStatus: 'consented',
      directoryConsentUpdatedAt: new Date(),
      directoryConsentPolicyVersion: '1.0',
    },
  ];

  let donorsAdded = 0;
  for (const donor of sampleDonors) {
    const existing = await Donor.findOne({ phone: donor.phone });
    if (!existing) {
      await Donor.create(donor);
      donorsAdded++;
    }
  }
  console.log(`  ✓ Added ${donorsAdded} sample donors (total available: ${await Donor.countDocuments({ available: true })}).`);

  // 5. Seed Sample Enquiry
  const sampleEnquiry = {
    name: 'Dr. Sunita Mishra',
    email: 'dr.sunita@citycare.org',
    subject: 'Blood drive coordination partnership',
    message: 'We are hosting a corporate voluntary blood donation camp next month and would like to coordinate donor listings with LifeLine.',
    status: 'New',
  };
  const existingEnquiry = await ContactMessage.findOne({ email: sampleEnquiry.email });
  if (!existingEnquiry) {
    await ContactMessage.create(sampleEnquiry);
    console.log('  ✓ Created sample contact enquiry for administrator review.');
  }

  console.log('\nSeed process completed successfully!');
  await mongoose.disconnect();
}

seed().catch((error) => {
  console.error('Seeding failed:', error);
  process.exit(1);
});
