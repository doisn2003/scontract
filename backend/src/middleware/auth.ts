import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import type { AuthRequest } from '../types/index.js';
import { sendError } from '../utils/response.js';

/**
 * JWT Authentication middleware.
 * Verifies the Bearer token from Authorization header
 * and attaches user info to req.user.
 */
export const auth = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
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

    const decoded = jwt.verify(token, secret) as { id: string; email: string; role: string };
    
    // Check if user still exists and is not suspended
    const user = await User.findById(decoded.id);
    if (!user) {
      sendError(_res, 'User no longer exists.', 401);
      return;
    }

    if (user.status === 'suspended') {
      sendError(_res, 'Account suspended. Please contact support.', 403);
      return;
    }

    authReq.user = {
      id: user._id.toString(),
      email: user.email,
      role: user.role || 'guest',
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
export const generateToken = (userId: string, email: string, role: string = 'guest'): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }

  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  return jwt.sign(
    { id: userId, email, role },
    secret,
    { expiresIn } as jwt.SignOptions
  );
};
