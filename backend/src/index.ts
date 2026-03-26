import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import connectDB from './config/db.js';
import { errorHandler } from './middleware/errorHandler.js';

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// Database connection
connectDB();

// --- Routes will be registered here in Phase 1+ ---
// app.use('/api/auth', authRoutes);
// app.use('/api/wallets', walletRoutes);
// app.use('/api/faucet', faucetRoutes);
// app.use('/api/projects', projectRoutes);
// app.use('/api/explore', exploreRoutes);
// app.use('/api/transactions', transactionRoutes);

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
