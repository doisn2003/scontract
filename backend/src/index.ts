import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import connectDB from './config/db.js';
import { errorHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/authRoutes.js';
import walletRoutes from './routes/walletRoutes.js';
import faucetRoutes from './routes/faucetRoutes.js';
import projectRoutes from './routes/projectRoutes.js';
import exploreRoutes from './routes/exploreRoutes.js';
import testRoutes from './routes/testRoutes.js';
import { globalLimiter } from './middleware/rateLimiter.js';

dotenv.config();

const app = express();

// Trust reverse proxy (e.g., Nginx, Heroku) to get correct user IP for limiters
app.set('trust proxy', 1);

// Middleware
app.use(cors());
app.use(globalLimiter);
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// Database connection
connectDB();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/wallets', walletRoutes);
app.use('/api/faucet', faucetRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/explore', exploreRoutes);
app.use('/api/tests', testRoutes);

// Health check
app.get('/', (_req, res) => {
  res.json({
    success: true,
    message: 'SContract API is running 🚀',
    version: '1.0.0',
  });
});

// Error handling middleware (MUST be last)
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`⚡ Server running on port ${PORT}`);
  console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
});
