import { Schema, model, Document } from 'mongoose';

export type UserRole = 'admin' | 'manager' | 'employee';
export type Gender = 'male' | 'female' | 'non-binary' | 'prefer-not-to-say';

export interface IUser extends Document {
  fullName: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  jobTitle?: string;
  department?: string;
  gender?: Gender;
  profilePicture?: string;
  fcmToken?: string;
}

const UserSchema = new Schema<IUser>(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['admin', 'manager', 'employee'], default: 'employee' },
    jobTitle: { type: String },
    department: { type: String },
    gender: { type: String, enum: ['male', 'female', 'non-binary', 'prefer-not-to-say'] },
    profilePicture: { type: String },
  },
  { timestamps: true }
);

export const User = model<IUser>('User', UserSchema);
