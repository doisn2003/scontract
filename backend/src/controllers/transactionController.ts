/**
 * transactionController.ts
 * REST handlers for Transaction History.
 */

import type { Request, Response } from 'express';
import { sendSuccess, sendError } from '../utils/response.js';
import * as transactionService from '../services/transactionService.js';
import type { AuthRequest } from '../types/index.js';

/**
 * POST /api/transactions
 * Frontend gọi sau khi tx.wait() confirm để lưu bản ghi giao dịch.
 * Body: { projectId, txHash, functionName, args, gasUsed }
 */
export const recordTransaction = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;
    if (!userId) { sendError(res, 'Unauthorized', 401); return; }

    const { projectId, txHash, functionName, args, gasUsed } = req.body as {
      projectId: string;
      txHash: string;
      functionName: string;
      args?: unknown[];
      gasUsed: number;
    };

    if (!projectId || !txHash || !functionName || gasUsed === undefined) {
      sendError(res, 'projectId, txHash, functionName, and gasUsed are required', 400);
      return;
    }

    if (typeof gasUsed !== 'number' || gasUsed < 0) {
      sendError(res, 'gasUsed must be a non-negative number', 400);
      return;
    }

    const tx = await transactionService.createTransaction({
      projectId,
      userId,
      txHash,
      functionName,
      args: args || [],
      gasUsed,
      status: 'success',
    });

    sendSuccess(res, 'Transaction recorded', tx, 201);
  } catch (error: any) {
    // Duplicate txHash — silently accept (idempotent)
    if (error.code === 11000) {
      sendSuccess(res, 'Transaction already recorded', null, 200);
      return;
    }
    const message = error instanceof Error ? error.message : 'Failed to record transaction';
    sendError(res, message, 500);
  }
};

/**
 * GET /api/transactions
 * Lấy lịch sử giao dịch của user, có thể filter theo projectId.
 * Query: ?projectId=xxx&page=1&limit=20
 */
export const listTransactions = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;
    if (!userId) { sendError(res, 'Unauthorized', 401); return; }

    const { projectId, page, limit } = req.query as {
      projectId?: string;
      page?: string;
      limit?: string;
    };

    const result = await transactionService.getTransactions({
      userId,
      projectId,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });

    sendSuccess(res, 'Transactions retrieved', result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get transactions';
    sendError(res, message, 500);
  }
};

/**
 * GET /api/transactions/bnb-price
 * Trả về giá BNB/USD hiện tại (dùng cho FE tính Gas Estimate realtime).
 */
export const getBnbPrice = async (_req: Request, res: Response): Promise<void> => {
  try {
    const price = await transactionService.getBnbPriceUSD();
    sendSuccess(res, 'BNB price retrieved', { priceUSD: price });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get BNB price';
    sendError(res, message, 500);
  }
};
