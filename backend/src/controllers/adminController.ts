import type { Request, Response } from 'express';
import User from '../models/User.js';
import Project from '../models/Project.js';
import SystemConfig from '../models/SystemConfig.js';
import { sendSuccess, sendError } from '../utils/response.js';

/**
 * GET /api/admin/users
 */
export const getUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const filter = req.query.role ? { role: req.query.role } : {};
    const users = await User.find(filter).select('-password').sort({ createdAt: -1 });
    sendSuccess(res, 'Users retrieved', { users });
  } catch (error) {
    sendError(res, 'Failed to get users', 500);
  }
};

/**
 * PUT /api/admin/users/:id/role
 */
export const updateUserRole = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!['admin', 'dev', 'guest'].includes(role)) {
      sendError(res, 'Invalid role', 400);
      return;
    }

    const user = await User.findByIdAndUpdate(id, { role }, { new: true }).select('-password');
    if (!user) {
      sendError(res, 'User not found', 404);
      return;
    }

    sendSuccess(res, 'User role updated', { user });
  } catch (error) {
    sendError(res, 'Failed to update user role', 500);
  }
};

/**
 * PUT /api/admin/users/:id/status
 */
export const updateUserStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['active', 'suspended'].includes(status)) {
      sendError(res, 'Invalid status', 400);
      return;
    }

    const user = await User.findByIdAndUpdate(id, { status }, { new: true }).select('-password');
    if (!user) {
      sendError(res, 'User not found', 404);
      return;
    }

    sendSuccess(res, 'User status updated', { user });
  } catch (error) {
    sendError(res, 'Failed to update user status', 500);
  }
};

/**
 * GET /api/admin/configs
 */
export const getConfigs = async (req: Request, res: Response): Promise<void> => {
  try {
    const configs = await SystemConfig.find();
    sendSuccess(res, 'System configs retrieved', { configs });
  } catch (error) {
    sendError(res, 'Failed to get configs', 500);
  }
};

/**
 * PUT /api/admin/configs
 */
export const updateConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const { key, value } = req.body;

    if (!key || value === undefined) {
      sendError(res, 'Key and value are required', 400);
      return;
    }

    const config = await SystemConfig.findOneAndUpdate(
      { key },
      { value },
      { new: true, upsert: true }
    );

    sendSuccess(res, 'System config updated', { config });
  } catch (error) {
    sendError(res, 'Failed to update config', 500);
  }
};

/**
 * GET /api/admin/dashboard
 */
export const getDashboardStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const totalUsers = await User.countDocuments();
    const totalProjects = await Project.countDocuments();
    
    // Group projects by network just to give some rich data
    const projectsByNetwork = await Project.aggregate([
      { $group: { _id: '$network', count: { $sum: 1 } } }
    ]);

    sendSuccess(res, 'Dashboard stats', {
      totalUsers,
      totalProjects,
      projectsByNetwork
    });
  } catch (error) {
    sendError(res, 'Failed to get dashboard stats', 500);
  }
};
