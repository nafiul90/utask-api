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
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const originalnameWithoutExtension = path.parse(file.originalname).name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const extension = path.extname(file.originalname);
    cb(null, `${originalnameWithoutExtension}-${uniqueSuffix}${extension}`);
  }
});

const fileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  if (
    file.mimetype.startsWith('image/') || 
    file.mimetype === 'application/pdf' ||
    file.mimetype === 'application/octet-stream' 
  ) {
    cb(null, true);
  } else {
    // console.log('Rejected mime:', file.mimetype);
    cb(null, true); 
  }
};

export const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } 
});
