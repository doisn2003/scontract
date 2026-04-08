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
    const role = req.query.role as string;
    const search = req.query.search as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const query: any = {};
    if (role) query.role = role;
    if (search) {
      query.$or = [
        { email: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } }
      ];
    }

    const total = await User.countDocuments(query);
    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    sendSuccess(res, 'Users retrieved', { 
      users,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
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

    // Security: Prevent self-lockout
    if (id === (req as any).user?._id) {
      sendError(res, 'You cannot modify your own administrative role', 400);
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

    // Security: Prevent self-lockout
    if (id === (req as any).user?._id) {
      sendError(res, 'You cannot suspend your own account', 400);
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
