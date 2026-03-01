import { Request, Response } from 'express';

export const uploadProfileImage = (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  const publicPath = `/uploads/${req.file.filename}`;
  return res.status(201).json({ path: publicPath });
};
