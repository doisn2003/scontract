/**
 * projectController.ts
 * REST API handlers for the Project CRUD and Compile/Deploy pipeline.
 */

import type { Request, Response } from 'express';
import { sendSuccess, sendError } from '../utils/response.js';
import * as projectService from '../services/projectService.js';
import type { AuthRequest } from '../types/index.js';

/**
 * POST /api/projects
 * Create a new project with Solidity source code.
 */
export const createProject = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;
    if (!userId) { sendError(res, 'Unauthorized', 401); return; }

    const { walletId, name, description, soliditySource } = req.body as {
      walletId: string;
      name?: string;
      description?: string;
      soliditySource: string;
    };

    if (!walletId) {
      sendError(res, 'walletId is required', 400);
      return;
    }

    if (!soliditySource || typeof soliditySource !== 'string') {
      sendError(res, 'soliditySource is required and must be a string', 400);
      return;
    }

    // Basic validation: must contain pragma
    if (!soliditySource.includes('pragma solidity')) {
      sendError(res, 'Invalid Solidity source: missing pragma statement', 400);
      return;
    }

    const project = await projectService.createProject(
      userId, walletId, name || '', description || '', soliditySource
    );

    sendSuccess(res, 'Project created successfully', project, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create project';
    sendError(res, message, 500);
  }
};

/**
 * POST /api/projects/:id/compile
 * Compile the Solidity source inside a Docker sandbox.
 */
export const compileProject = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;
    if (!userId) { sendError(res, 'Unauthorized', 401); return; }

    const projectId = req.params.id as string;
    if (!projectId) { sendError(res, 'Project ID is required', 400); return; }

    const result = await projectService.compileProject(projectId, userId);

    sendSuccess(res, 'Compilation successful', result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Compilation failed';
    // Compilation errors are client-side issues (bad Solidity code)
    const statusCode = message.includes('not found') ? 404 : 400;
    sendError(res, message, statusCode);
  }
};

/**
 * POST /api/projects/:id/deploy
 * Deploy the compiled contract to BSC Testnet.
 */
export const deployProject = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;
    if (!userId) { sendError(res, 'Unauthorized', 401); return; }

    const projectId = req.params.id as string;
    if (!projectId) { sendError(res, 'Project ID is required', 400); return; }

    const { constructorArgs = [] } = req.body as { constructorArgs?: unknown[] };

    const result = await projectService.deployProject(projectId, userId, constructorArgs);

    sendSuccess(res, 'Contract deployed successfully', result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Deployment failed';
    const statusCode = message.includes('not found') ? 404
      : message.includes('Cannot deploy') ? 400
      : message.includes('insufficient funds') ? 400
      : 500;
    sendError(res, message, statusCode);
  }
};

/**
 * GET /api/projects
 * List all projects for the authenticated user.
 */
export const getProjects = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;
    if (!userId) { sendError(res, 'Unauthorized', 401); return; }

    const projects = await projectService.getUserProjects(userId);
    sendSuccess(res, 'Projects retrieved', projects);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get projects';
    sendError(res, message, 500);
  }
};

/**
 * GET /api/projects/:id
 * Get project detail (including ABI and source).
 */
export const getProject = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;
    if (!userId) { sendError(res, 'Unauthorized', 401); return; }

    const projectId = req.params.id as string;
    if (!projectId) { sendError(res, 'Project ID is required', 400); return; }

    const project = await projectService.getProjectById(projectId, userId);
    if (!project) {
      sendError(res, 'Project not found', 404);
      return;
    }

    sendSuccess(res, 'Project retrieved', project);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get project';
    sendError(res, message, 500);
  }
};

/**
 * GET /api/explore
 * Browse all deployed projects (public — Lộ trình B).
 */
export const getExploreProjects = async (_req: Request, res: Response): Promise<void> => {
  try {
    const projects = await projectService.getDeployedProjects();
    sendSuccess(res, 'Deployed projects retrieved', projects);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get projects';
    sendError(res, message, 500);
  }
};

/**
 * GET /api/projects/:id/estimate-deploy
 * Dry-run gas estimation for deploying a compiled contract.
 * Returns { gasLimit, gasBNB, gasUSD, bnbPrice, deployerAddress }
 * Does NOT broadcast any transaction.
 */
export const estimateDeployGas = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;
    if (!userId) { sendError(res, 'Unauthorized', 401); return; }

    const projectId = req.params.id as string;
    if (!projectId) { sendError(res, 'Project ID is required', 400); return; }

    const { constructorArgs = [] } = req.query as { constructorArgs?: unknown[] };

    const result = await projectService.estimateDeployGas(projectId, userId, constructorArgs);
    sendSuccess(res, 'Gas estimate calculated', result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to estimate gas';
    const statusCode = message.includes('not found') ? 404
      : message.includes('Must compile') ? 400
      : 500;
    sendError(res, message, statusCode);
  }
};

/**
 * DELETE /api/projects/:id
 * Delete a project (must be owner).
 */
export const deleteProject = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;
    if (!userId) { sendError(res, 'Unauthorized', 401); return; }

    const projectId = req.params.id as string;
    if (!projectId) { sendError(res, 'Project ID is required', 400); return; }

    await projectService.deleteProject(projectId, userId);

    sendSuccess(res, 'Project deleted successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete project';
    const statusCode = message.includes('not authorized') ? 403
      : message.includes('not found') ? 404
      : 500;
    sendError(res, message, statusCode);
  }
};

