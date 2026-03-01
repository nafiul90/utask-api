import { Request, Response } from 'express';

export const getRoot = (_req: Request, res: Response) => {
  res.status(200).send('welcome to uTask api');
};
