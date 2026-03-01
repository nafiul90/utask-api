import mongoose from 'mongoose';

export async function connectDatabase(uri: string) {
  if (!uri) {
    throw new Error('Missing MongoDB connection string (MONGODB_URI)');
  }

  mongoose.set('strictQuery', true);

  await mongoose.connect(uri);
  console.log('MongoDB connected');
}
