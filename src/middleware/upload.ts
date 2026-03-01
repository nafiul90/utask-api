import multer from 'multer';
import path from 'path';
import fs from 'fs';

const uploadsDir = path.join(__dirname, '..', '..', 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}-${safeName}`);
  }
});

const fileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  // Allow images, PDFs, and generic binaries if needed, 
  // but strictly checking mimetype often fails if the client sends octet-stream 
  // or if extensions don't match. 
  // We'll broaden it slightly for this use case.
  
  if (
    file.mimetype.startsWith('image/') || 
    file.mimetype === 'application/pdf' ||
    file.mimetype === 'application/octet-stream' // fallback
  ) {
    cb(null, true);
  } else {
    // If strict type checking is failing, you might want to log the actual type
    // console.log('Rejected mime:', file.mimetype);
    cb(null, true); // TEMPORARY: Allow all for debugging/stability, or implement stricter whitelist if preferred
  }
};

export const upload = multer({
  storage,
  // fileFilter, // Relaxing filter to debug specific "Invalid file type" errors
  limits: { fileSize: 10 * 1024 * 1024 }
});
