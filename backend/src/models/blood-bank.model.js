import mongoose from 'mongoose';
import { BLOOD_GROUPS } from '../utils/blood.util.js';

const bankSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 150 },
  address: { type: String, required: true, trim: true, maxlength: 255 },
  city: { type: String, required: true, trim: true, maxlength: 100 },
  phone: { type: String, trim: true, maxlength: 20 },
  email: { type: String, trim: true, maxlength: 120 },
  openingHours: { type: String, trim: true, maxlength: 200 },
  bloodGroups: { type: [{ type: String, enum: BLOOD_GROUPS }], default: [] },
  verified: { type: Boolean, default: false },
}, { timestamps: true });

bankSchema.index({ city: 1, verified: 1 });

export const BloodBank = mongoose.models.BloodBank || mongoose.model('BloodBank', bankSchema);

