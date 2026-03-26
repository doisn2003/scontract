import type { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response.js';

/**
 * Centralized error handling middleware.
 * Must be registered AFTER all routes.
 */
export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  console.error('❌ Error:', err.message);
  console.error(err.stack);

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    sendError(res, 'Validation Error', 400, err.message);
    return;
  }

  // Mongoose duplicate key
  if (err.name === 'MongoServerError' && (err as unknown as Record<string, unknown>).code === 11000) {
    sendError(res, 'Duplicate field value', 409, err.message);
    return;
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    sendError(res, 'Invalid token', 401, err.message);
    return;
  }

  if (err.name === 'TokenExpiredError') {
    sendError(res, 'Token expired', 401, err.message);
    return;
  }

  // Default 500
  sendError(res, 'Internal Server Error', 500, err.message);
};

/**
 * Async handler wrapper to catch errors in async route handlers
 * and forward them to the error handling middleware.
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
