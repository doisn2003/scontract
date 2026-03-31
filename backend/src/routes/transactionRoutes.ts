/**
 * transactionRoutes.ts
 * Routes for Transaction History API.
 */

import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import {
  recordTransaction,
  listTransactions,
  getBnbPrice,
} from '../controllers/transactionController.js';

const router = Router();

// All routes require authentication
router.use(auth);

// GET  /api/transactions         — list transactions (with optional ?projectId=)
router.get('/', listTransactions);

// POST /api/transactions         — record a confirmed transaction
router.post('/', recordTransaction);

// GET  /api/transactions/bnb-price — live BNB/USD price
router.get('/bnb-price', getBnbPrice);

export default router;
