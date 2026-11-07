import mongoose from 'mongoose';
import { BLOOD_GROUPS } from '../utils/blood.util.js';

const requestSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  patientName: { type: String, required: true, trim: true, maxlength: 100 },
  bloodGroup: { type: String, enum: BLOOD_GROUPS, required: true },
  units: { type: Number, min: 1, max: 20, required: true },
  hospital: { type: String, required: true, trim: true, maxlength: 150 },
  city: { type: String, required: true, trim: true, maxlength: 100 },
  contactPhone: { type: String, required: true, trim: true, maxlength: 20 },
  message: { type: String, trim: true, maxlength: 500, default: '' },
  urgency: { type: String, enum: ['Normal', 'Urgent', 'Emergency'], default: 'Normal' },
  status: { type: String, enum: ['Pending', 'Approved', 'Fulfilled', 'Rejected', 'Cancelled'], default: 'Pending' },
  fulfilledAt: { type: Date, default: null },
  fulfilledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

requestSchema.index({ user: 1, createdAt: -1 });

export const BloodRequest = mongoose.models.BloodRequest || mongoose.model('BloodRequest', requestSchema);

