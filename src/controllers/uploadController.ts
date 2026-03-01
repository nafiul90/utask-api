import { Request, Response } from 'express';

export const uploadProfileImage = (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  const publicPath = `/uploads/${req.file.filename}`;
  return res.status(201).json({ path: publicPath });
};

export const uploadTaskAttachment = (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  return res.status(201).json({
    path: `/uploads/${req.file.filename}`,
    filename: req.file.filename,
    originalName: req.file.originalname,
    mimeType: req.file.mimetype,
    size: req.file.size
  });
};
