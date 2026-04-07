import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { requireRole } from '../middleware/roleMiddleware.js';
import {
  getUsers,
  updateUserRole,
  updateUserStatus,
  getConfigs,
  updateConfig,
  getDashboardStats
} from '../controllers/adminController.js';

const router = Router();

// Protect all admin routes
router.use(auth);
router.use(requireRole(['admin']));

// Users
router.get('/users', getUsers);
router.put('/users/:id/role', updateUserRole);
router.put('/users/:id/status', updateUserStatus);

// System Configs
router.get('/configs', getConfigs);
router.put('/configs', updateConfig);

// Dashboard
router.get('/dashboard', getDashboardStats);

export default router;
