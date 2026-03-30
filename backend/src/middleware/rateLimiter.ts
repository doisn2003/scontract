import { rateLimit } from 'express-rate-limit';

/**
 * Global rate limiter to prevent DDoS and brute-force.
 * Max 100 requests per 15 minutes per IP.
 */
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 15 minutes',
  },
});

/**
 * Stricter limiter for sensitive routes like auth.
 */
export const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    message: 'Too many login/register attempts. Please try again after an hour',
  },
});
