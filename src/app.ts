import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import path from 'path';
import apiRouter from './routes';
import { getRoot } from './controllers/healthController';

const app = express();
const uploadsPath = path.join(__dirname, '..', 'public');

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(compression());
app.use(morgan('dev'));
app.use('/uploads', express.static(path.join(uploadsPath, 'uploads')));

app.get('/', getRoot);
app.use('/api', apiRouter);

export default app;
