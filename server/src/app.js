import './config/env.js';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import healthRoutes from './routes/healthRoutes.js';

const app = express();
const port = Number(process.env.PORT);

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());
app.use(morgan('dev'));
app.use('/api/v1', healthRoutes);

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.' } });
});

app.listen(port, () => console.log(`Merchant Munchies API listening on port ${port}`));
