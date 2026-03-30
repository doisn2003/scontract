import type { Request, Response } from 'express';
import { requestFaucet, getFaucetHistory } from '../services/faucetService.js';
import { sendSuccess, sendError } from '../utils/response.js';
import type { AuthRequest } from '../types/index.js';

import Wallet from '../models/Wallet.js';

/**
 * Send tokens from Master Wallet to Target Address
 * POST /api/faucet
 */
export const requestFaucetController = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;
    
    // 1. Safety check for req.body
    if (!req.body) {
      sendError(res, 'Request body is missing', 400);
      return;
    }

    let { targetAddress } = req.body;
    const ipAddress = req.ip || '';

    // 2. If targetAddress is missing, get the first wallet of the user
    if (!targetAddress) {
      if (!userId) {
        sendError(res, 'Target address is required', 400);
        return;
      }
      
      const userWallet = await Wallet.findOne({ userId }).sort({ createdAt: 1 });
      if (!userWallet) {
        sendError(res, 'No wallet found for this user. Please create a wallet first.', 404);
        return;
      }
      targetAddress = userWallet.address;
    }

    // 3. Security Check: ensure address is valid format
    if (!targetAddress.startsWith('0x') || targetAddress.length !== 42) {
      sendError(res, 'Invalid target address format (Example: 0x...)', 400);
      return;
    }

    // 4. Handle token transfer
    const result = await requestFaucet(targetAddress, ipAddress);

    sendSuccess(res, `Faucet successful. Transferred to ${targetAddress}`, result, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Faucet failed';
    const statusCode = message.includes('Cooldown active') ? 429 : 500;
    sendError(res, message, statusCode);
  }
};

/**
 * Get history of faucet requests for an address
 * GET /api/faucet/history/:address
 */
export const getHistoryController = async (req: Request, res: Response): Promise<void> => {
   try {
    const { address } = req.params;
    
    if (!address || typeof address !== 'string') {
      sendError(res, 'Address is required and must be a string', 400);
      return;
    }

    const history = await getFaucetHistory(address);
     sendSuccess(res, 'Faucet history retrieved', history);
   } catch (error) {
     const message = error instanceof Error ? error.message : 'Failed to retrieve faucet history';
     sendError(res, message, 500);
   }
};
