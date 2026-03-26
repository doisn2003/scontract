import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { AuthRequest } from '../types/index.js';
import { sendError } from '../utils/response.js';

/**
 * JWT Authentication middleware.
 * Verifies the Bearer token from Authorization header
 * and attaches user info to req.user.
 */
export const auth = (req: Request, _res: Response, next: NextFunction): void => {
  const authReq = req as AuthRequest;

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    sendError(_res, 'Access denied. No token provided.', 401);
    return;
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    sendError(_res, 'Access denied. Token malformed.', 401);
    return;
  }

  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET is not configured');
    }

    const decoded = jwt.verify(token, secret) as { id: string; email: string };
    authReq.user = {
      id: decoded.id,
      email: decoded.email,
    };
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      sendError(_res, 'Token expired. Please login again.', 401);
      return;
    }
    sendError(_res, 'Invalid token.', 401);
  }
};

/**
 * Generate a JWT token for a user.
 */
export const generateToken = (userId: string, email: string): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }

  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  return jwt.sign(
    { id: userId, email },
    secret,
    { expiresIn } as jwt.SignOptions
  );
};
