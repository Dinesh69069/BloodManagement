import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 120 },
  phone: { type: String, required: true, trim: true, maxlength: 20 },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  accountStatus: { type: String, enum: ['active', 'deletion_requested'], default: 'active' },
  deletionRequestedAt: { type: Date, default: null },
  deletionReviewedAt: { type: Date, default: null },
  deletionReviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

userSchema.index({ accountStatus: 1, deletionRequestedAt: 1 });

export const User = mongoose.models.User || mongoose.model('User', userSchema);

