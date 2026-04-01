import type { Request, Response } from 'express';
import { sendSuccess, sendError } from '../utils/response.js';
import { runTests } from '../services/testService.js';
import type { AuthRequest } from '../types/index.js';

/**
 * POST /api/projects/:id/contracts/:contractId/test
 * Chạy unit test cho 1 contract trong Docker sandbox.
 * Body: { testCode: string, library: 'viem' | 'ethers' }
 */
export const runProjectTests = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;
    if (!userId) { sendError(res, 'Unauthorized', 401); return; }

    const projectId = req.params['id'] as string;
    const contractId = req.params['contractId'] as string;
    if (!projectId) { sendError(res, 'Project ID is required', 400); return; }
    if (!contractId) { sendError(res, 'Contract ID is required', 400); return; }

    const { testCode, library = 'viem' } = req.body as {
      testCode: string;
      library?: 'viem' | 'ethers';
    };

    if (!testCode || typeof testCode !== 'string') {
      sendError(res, 'testCode is required and must be a string', 400);
      return;
    }

    const result = await runTests(projectId, userId, contractId, testCode, library);

    sendSuccess(res, result.success ? 'Tests passed' : 'Tests completed with failures', result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Test execution failed';
    const statusCode = message.includes('not found') ? 404 : 500;
    sendError(res, message, statusCode);
  }
};
