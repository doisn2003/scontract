import type { Request, Response, NextFunction } from 'express';
import type { AuthRequest } from '../types/index.js';
import { sendError } from '../utils/response.js';

/**
 * Middleware to check if user has one of the required roles.
 * Must be used after auth middleware.
 */
export const requireRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authReq = req as AuthRequest;
    
    if (!authReq.user) {
      sendError(res, 'Unauthorized', 401);
      return;
    }

    if (!roles.includes(authReq.user.role)) {
      sendError(res, 'Forbidden: Insufficient permissions', 403);
      return;
    }

    next();
  };
};
