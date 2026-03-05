import dotenv from 'dotenv';
import app from './app';
import { connectDatabase } from './config/database';

dotenv.config();

const PORT = process.env.PORT || 9052;
const MONGODB_URI = process.env.MONGODB_URI;

async function bootstrap() {
  if (MONGODB_URI) {
    try {
      await connectDatabase(MONGODB_URI);
    } catch (error) {
      console.error('MongoDB connection failed. API will still start, but database features are unavailable.', error);
    }
  } else {
    console.warn('No MONGODB_URI provided. Starting API without a database connection.');
  }

  app.listen(PORT, () => {
    console.log(`uTask API is running on port ${PORT}`);
  });
}

bootstrap();

// OpenClaw demo write test - Wed Mar  4 08:22:28 CET 2026
// Proof: File changed successfully!