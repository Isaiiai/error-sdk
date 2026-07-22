import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';

export type UserRole = 'admin' | 'product_manager' | 'developer';
export type UserStatus = 'active' | 'inactive' | 'suspended';

export interface IUser extends Document {
  email: string;
  username: string;
  password: string;
  fullName: string;
  role: UserRole;
  avatar?: string;
  status: UserStatus;
  emailVerified: boolean;
  lastLogin?: Date;
  preferences: {
    theme: 'light' | 'dark';
    emailNotifications: boolean;
    timezone: string;
    language: string;
  };
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidate: string): Promise<boolean>;
}

const UserSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, index: true },
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true, select: false },
    fullName: { type: String, required: true },
    role: {
      type: String,
      enum: ['admin', 'product_manager', 'developer'],
      default: 'developer',
    },
    avatar: String,
    status: {
      type: String,
      enum: ['active', 'inactive', 'suspended'],
      default: 'active',
    },
    emailVerified: { type: Boolean, default: false },
    lastLogin: Date,
    preferences: {
      theme: { type: String, enum: ['light', 'dark'], default: 'light' },
      emailNotifications: { type: Boolean, default: true },
      timezone: { type: String, default: 'UTC' },
      language: { type: String, default: 'en' },
    },
  },
  { timestamps: true }
);

UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

UserSchema.methods.comparePassword = async function (candidate: string): Promise<boolean> {
  return bcrypt.compare(candidate, this.password);
};

export const User = mongoose.model<IUser>('User', UserSchema);
