import mongoose from 'mongoose';
import { BLOOD_GROUPS } from '../utils/blood.util.js';

const donorSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  fullName: { type: String, required: true, trim: true, maxlength: 100 },
  phone: { type: String, required: true, trim: true, maxlength: 20 },
  bloodGroup: { type: String, enum: BLOOD_GROUPS, required: true },
  age: { type: Number, min: 18, max: 65, required: true },
  gender: { type: String, enum: ['Prefer not to say', 'Female', 'Male', 'Other'], default: 'Prefer not to say' },
  city: { type: String, required: true, trim: true, maxlength: 100 },
  address: { type: String, trim: true, maxlength: 255 },
  lastDonationDate: { type: Date, default: null },
  available: { type: Boolean, default: false },
  directoryConsent: { type: Boolean, default: false },
  directoryConsentStatus: { type: String, enum: ['unknown', 'consented', 'withdrawn'], default: 'unknown' },
  directoryConsentUpdatedAt: { type: Date, default: null },
  directoryConsentPolicyVersion: { type: String, maxlength: 30, default: null },
  photoPath: { type: String, maxlength: 100, default: null },
  photoConsent: { type: Boolean, default: false },
  photoConsentStatus: { type: String, enum: ['unknown', 'consented', 'withdrawn'], default: 'unknown' },
  photoConsentUpdatedAt: { type: Date, default: null },
}, { timestamps: true });

donorSchema.index({ bloodGroup: 1, city: 1, available: 1, directoryConsentStatus: 1 });
donorSchema.index({ phone: 1 }, { unique: true });
donorSchema.index({ user: 1 }, { unique: true, partialFilterExpression: { user: { $type: 'objectId' } } });

export const Donor = mongoose.models.Donor || mongoose.model('Donor', donorSchema);

