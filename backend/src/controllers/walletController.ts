import type { Request, Response } from 'express';
import { sendSuccess, sendError } from '../utils/response.js';
import * as walletService from '../services/walletService.js';
import type { AuthRequest, WalletType } from '../types/index.js';

/**
 * POST /api/wallets
 * Create a new wallet for the authenticated user
 */
export const createWallet = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;

    if (!userId) {
      sendError(res, 'Unauthorized', 401);
      return;
    }

    const { walletType = 'user', label = 'My Wallet' } = req.body as {
      walletType?: WalletType;
      label?: string;
    };

    // Limit: max 10 wallets per user
    const count = await walletService.countWallets(userId);
    if (count >= 10) {
      sendError(res, 'Maximum 10 wallets allowed per account', 400);
      return;
    }

    const wallet = await walletService.createWallet(userId, walletType, label);

    sendSuccess(res, 'Wallet created successfully', wallet, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create wallet';
    sendError(res, message, 500);
  }
};

/**
 * GET /api/wallets
 * List all wallets for the authenticated user
 */
export const getWallets = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;

    if (!userId) {
      sendError(res, 'Unauthorized', 401);
      return;
    }

    const wallets = await walletService.getWallets(userId);

    sendSuccess(res, 'Wallets retrieved', wallets);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get wallets';
    sendError(res, message, 500);
  }
};

/**
 * GET /api/wallets/:id/private-key
 * Get the decrypted private key of a wallet (owner only)
 */
export const getPrivateKey = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;
    const walletId = req.params.id as string;

    if (!userId) {
      sendError(res, 'Unauthorized', 401);
      return;
    }

    if (!walletId) {
      sendError(res, 'Wallet ID is required', 400);
      return;
    }

    const privateKey = await walletService.getPrivateKey(walletId, userId);
    if (!privateKey) {
      sendError(res, 'Wallet not found or access denied', 404);
      return;
    }

    sendSuccess(res, 'Private key retrieved', { privateKey });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get private key';
    sendError(res, message, 500);
  }
};

/**
 * GET /api/wallets/:id/balance
 * Get the balance of a wallet from the blockchain
 */
export const getBalance = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;
    const walletId = req.params.id as string;

    if (!userId) {
      sendError(res, 'Unauthorized', 401);
      return;
    }

    if (!walletId) {
      sendError(res, 'Wallet ID is required', 400);
      return;
    }

    // Get wallet to verify ownership and get address
    const wallet = await walletService.getWalletById(walletId, userId);
    if (!wallet) {
      sendError(res, 'Wallet not found or access denied', 404);
      return;
    }

    const balance = await walletService.getWalletBalance(wallet.address);

    sendSuccess(res, 'Balance retrieved', {
      address: wallet.address,
      balance,
      unit: 'BNB',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get balance';
    sendError(res, message, 500);
  }
};
