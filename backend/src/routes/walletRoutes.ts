import { Router } from 'express';
import {
  createWallet,
  getWallets,
  getPrivateKey,
  getBalance,
} from '../controllers/walletController.js';
import { auth } from '../middleware/auth.js';

const router = Router();

// All wallet routes require authentication
router.use(auth);

// POST /api/wallets — Create a new wallet
router.post('/', createWallet);

// GET /api/wallets — List user's wallets
router.get('/', getWallets);

// GET /api/wallets/:id/private-key — Reveal wallet private key
router.get('/:id/private-key', getPrivateKey);

// GET /api/wallets/:id/balance — Check wallet balance on-chain
router.get('/:id/balance', getBalance);

export default router;
