import mongoose from 'mongoose';
import { BLOOD_GROUPS } from '../utils/blood.util.js';

const stockSchema = new mongoose.Schema({
  bloodGroup: { type: String, enum: BLOOD_GROUPS, unique: true, required: true },
  units: { type: Number, min: 0, max: 100000, default: 0 },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

export const BloodStock = mongoose.models.BloodStock || mongoose.model('BloodStock', stockSchema);

