import './config/env.js';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import healthRoutes from './routes/healthRoutes.js';
import authRoutes from './routes/authRoutes.js';

const port = Number(process.env.PORT) || 4000;

console.log('\n--- Environment Injection ---');
console.log(`NODE_ENV:            ${process.env.NODE_ENV || 'not set'}`);
console.log(`PORT:                ${port}`);
console.log(`CLIENT_ORIGIN:       ${process.env.CLIENT_ORIGIN || 'not set'}`);
console.log(`SUPABASE_URL:        ${process.env.SUPABASE_URL ? 'loaded' : 'NOT SET'}`);
console.log(`SUPABASE_ANON_KEY:   ${process.env.SUPABASE_ANON_KEY ? 'loaded' : 'NOT SET'}`);
console.log(`SUPABASE_SERVICE_ROLE_KEY: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? 'loaded' : 'NOT SET'}`);
console.log('--- End Environment Injection ---\n');

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());
app.use(morgan('dev'));
app.use('/api/v1', healthRoutes);
app.use('/api/v1', authRoutes);

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.' } });
});

const baseUrl = process.env.BASE_URL || `http://localhost:${port}`;
app.listen(port, () => {
  console.log(`🚀 Merchant Munchies API running on ${baseUrl}`);
  console.log(`📖 Swagger docs available at: ${baseUrl}/api-docs\n`);
});