import type { Request, Response } from 'express';
import { executeCustomFaucet } from '../services/customFaucetService.js';
import { sendSuccess, sendError } from '../utils/response.js';
import type { AuthRequest } from '../types/index.js';

/**
 * POST /api/projects/:id/contracts/:contractId/faucet
 * Body: { targetAddress: string }
 */
export const requestCustomFaucet = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;
    
    if (!userId) {
      sendError(res, 'Unauthorized. Please login to use the faucet.', 401);
      return;
    }

    const projectId = req.params['id'] as string;
    const contractId = req.params['contractId'] as string;
    
    if (!req.body || !req.body.targetAddress) {
      sendError(res, 'targetAddress is required', 400);
      return;
    }

    const targetAddress = req.body.targetAddress;
    const ipAddress = req.ip || '';

    // Delegate to service
    const result = await executeCustomFaucet(projectId, contractId, userId, targetAddress, ipAddress);

    sendSuccess(res, `Faucet successful! Sent ${result.amountLabel} to ${targetAddress}`, result, 201);

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Custom Faucet failed';
    const statusCode = message.includes('Cooldown active') ? 429 
                     : message.includes('not enabled') ? 403
                     : message.includes('Insufficient funds') ? 400
                     : 500;
    sendError(res, message, statusCode);
  }
};
