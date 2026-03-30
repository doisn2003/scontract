import { Router } from 'express';
import { requestFaucetController, getHistoryController } from '../controllers/faucetController.js';
import { auth } from '../middleware/auth.js';

const router = Router();

/**
 * Handle Faucet Routes
 * All routes are protected by auth middleware
 */

// POST /api/faucet -> request tokens
router.post('/', auth, requestFaucetController);

// GET /api/faucet/history/:address -> get history
router.get('/history/:address', auth, getHistoryController);

export default router;
