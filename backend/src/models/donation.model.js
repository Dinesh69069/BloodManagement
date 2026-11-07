import mongoose from 'mongoose';

const donationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  donationDate: { type: Date, required: true },
  center: { type: String, trim: true, maxlength: 150 },
  notes: { type: String, trim: true, maxlength: 300 },
}, { timestamps: true });

donationSchema.index({ user: 1, donationDate: -1 });

export const Donation = mongoose.models.Donation || mongoose.model('Donation', donationSchema);

