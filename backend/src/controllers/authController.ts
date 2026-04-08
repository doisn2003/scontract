import type { Request, Response } from 'express';
import User from '../models/User.js';
import { generateToken } from '../middleware/auth.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { isValidEmail, isValidPassword, sanitize } from '../utils/validators.js';
import { createWallet } from '../services/walletService.js';
import type { AuthRequest } from '../types/index.js';

/**
 * POST /api/auth/register
 * Register a new user + auto-create a default wallet
 */
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, name } = req.body;

    // Validation
    if (!email || !password || !name) {
      sendError(res, 'Email, password, and name are required', 400);
      return;
    }

    const cleanEmail = sanitize(email).toLowerCase();
    const cleanName = sanitize(name);

    if (!isValidEmail(cleanEmail)) {
      sendError(res, 'Invalid email format', 400);
      return;
    }

    if (!isValidPassword(password)) {
      sendError(res, 'Password must be at least 6 characters', 400);
      return;
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser) {
      sendError(res, 'Email already registered', 409);
      return;
    }

    // Create user
    const user = await User.create({
      email: cleanEmail,
      password,
      name: cleanName,
    });

    // Auto-create a default wallet for the new user
    const wallet = await createWallet(
      user._id.toString(),
      'user',
      'Default Wallet'
    );

    // Generate JWT
    const token = generateToken(user._id.toString(), user.email, user.role);

    console.log(`[AUTH] User registered: ${user.email} (ID: ${user._id})`);

    sendSuccess(res, 'Registration successful', {
      user: {
        _id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: user.createdAt,
      },
      wallet,
      token,
    }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Registration failed';
    sendError(res, message, 500);
  }
};

/**
 * POST /api/auth/login
 * Login with email and password
 */
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      sendError(res, 'Email and password are required', 400);
      return;
    }

    const cleanEmail = sanitize(email).toLowerCase();

    // Find user
    const user = await User.findOne({ email: cleanEmail });
    if (!user) {
      sendError(res, 'Invalid email or password', 401);
      return;
    }

    // Check if account is suspended
    if (user.status === 'suspended') {
      sendError(res, 'Your account has been suspended. Please contact support.', 403);
      return;
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      sendError(res, 'Invalid email or password', 401);
      return;
    }

    // Generate JWT
    const token = generateToken(user._id.toString(), user.email, user.role);

    console.log(`[AUTH] User logged in: ${user.email} (ID: ${user._id})`);

    sendSuccess(res, 'Login successful', {
      user: {
        _id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: user.createdAt,
      },
      token,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Login failed';
    sendError(res, message, 500);
  }
};

/**
 * GET /api/auth/me
 * Get current authenticated user info
 */
export const getMe = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;

    if (!userId) {
      sendError(res, 'Unauthorized', 401);
      return;
    }

    const user = await User.findById(userId).select('-password');
    if (!user) {
      sendError(res, 'User not found', 404);
      return;
    }

    sendSuccess(res, 'User info', {
      _id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get user info';
    sendError(res, message, 500);
  }
};

/**
 * POST /api/auth/logout
 */
export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const userEmail = authReq.user?.email || 'unknown';
    
    console.log(`[AUTH] User logging out: ${userEmail}`);
    
    // JWT is stateless, so we just log it. 
    // The frontend will remove the token from local storage.
    sendSuccess(res, 'Logged out successfully');
  } catch (error) {
    sendError(res, 'Logout failed', 500);
  }
};
