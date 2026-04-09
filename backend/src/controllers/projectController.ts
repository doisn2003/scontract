/**
 * projectController.ts
 * REST API handlers cho Project CRUD và pipeline Compile/Deploy đa hợp đồng.
 */

import type { Request, Response } from 'express';
import { sendSuccess, sendError } from '../utils/response.js';
import * as projectService from '../services/projectService.js';
import type { AuthRequest } from '../types/index.js';

// ──────────────────────────────────────────────────────────
// PROJECT CRUD
// ──────────────────────────────────────────────────────────

/**
 * POST /api/projects
 * Body: { walletId, name?, description?, contracts: [{ soliditySource, name? }] }
 */
export const createProject = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;
    if (!userId) { sendError(res, 'Unauthorized', 401); return; }

    const { walletId, name, description, contracts } = req.body as {
      walletId: string;
      name?: string;
      description?: string;
      contracts: { soliditySource: string; name?: string }[];
    };

    const stamp = new Date().toISOString();
    console.log(`[STAMP_CHECK] ${stamp} - Creating project:`, { name, contractCount: contracts?.length });

    if (!walletId) { sendError(res, 'walletId is required', 400); return; }
    if (!contracts || !Array.isArray(contracts) || contracts.length === 0) {
      sendError(res, 'At least one contract is required', 400); return;
    }

    // Validation for each contract
    for (const [idx, c] of contracts.entries()) {
      if (!c.soliditySource || typeof c.soliditySource !== 'string') {
        sendError(res, `Contract at index ${idx} must have a soliditySource string`, 400); 
        return;
      }
      if (!c.soliditySource.includes('pragma solidity')) {
        sendError(res, `Invalid Solidity source in contract "${c.name || idx}": missing pragma statement`, 400); 
        return;
      }
    }

    const project = await projectService.createProject(
      userId, walletId, name || '', description || '', contracts
    );

    sendSuccess(res, 'Project created successfully', project, 201);
  } catch (error) {
    console.error('[projectController] Error in createProject:', error);
    const message = error instanceof Error ? error.message : 'Failed to create project';
    // If it's a Mongoose validation error, it's likely our 400 culprit
    const isValidationError = error instanceof Error && error.name === 'ValidationError';
    sendError(res, message, isValidationError ? 400 : 500);
  }
};

/** GET /api/projects */
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

/** GET /api/projects/:id */
export const getProject = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;
    if (!userId) { sendError(res, 'Unauthorized', 401); return; }

    const projectId = req.params['id'] as string;
    if (!projectId) { sendError(res, 'Project ID is required', 400); return; }

    const project = await projectService.getProjectById(projectId, userId);
    if (!project) { sendError(res, 'Project not found', 404); return; }

    // Backend filtering for guest users — 2-tier access model
    if (authReq.user?.role === 'guest') {
      const globalConfig = (project as any).global_access_config || {};
      const userEmail = authReq.user?.email || '';

      // ── Tier 1: Admission ("ticket") check ──
      const hasAdmission = 
        globalConfig.allow_all_guests === true || 
        (globalConfig.invited_guests || []).includes(userEmail);

      project.contracts = project.contracts.map((c: any) => {
        if (!c.abi) return c;

        if (!hasAdmission) {
          // No ticket → no functions visible at all
          c.abi = c.abi.filter((fn: any) => fn.type !== 'function');
          return c;
        }

        // ── Tier 2: Function-level authorization ──
        c.abi = c.abi.filter((fn: any) => {
          if (fn.type !== 'function') return true; // Keep events, constructors, etc.

          // Check global function-type toggles
          if (fn.stateMutability === 'view' || fn.stateMutability === 'pure') {
            if (globalConfig.allow_read) return true;
          } else if (fn.stateMutability === 'payable') {
            if (globalConfig.allow_payable) return true;
          } else {
            if (globalConfig.allow_write) return true;
          }

          // Check per-function permissions (Function Notes tab)
          const perm = project.guest_permissions?.find(
            (p: any) => p.contractAddress === c.contractAddress && p.methodName === fn.name
          );
          if (!perm) return false;
          if (perm.isGlobalAllowed) return true;
          if (perm.allowedGuestList?.includes(userEmail)) return true;

          return false;
        });

        return c;
      }) as any;
    }

    sendSuccess(res, 'Project retrieved', project);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get project';
    sendError(res, message, 500);
  }
};

/**
 * PATCH /api/projects/:id
 * Cập nhật metadata dùng chung: name, description.
 */
export const updateProject = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;
    if (!userId) { sendError(res, 'Unauthorized', 401); return; }

    const projectId = req.params['id'] as string;
    const updates = req.body as { 
      name?: string; 
      description?: string; 
      guest_permissions?: any[];
      global_access_config?: any;
      add_shared_dev_email?: string;
      clear_shared_devs?: boolean;
      remove_shared_dev_id?: string;
      remove_invited_guest?: string;
    };

    const project = await projectService.updateProject(projectId, userId, updates);
    sendSuccess(res, 'Project updated successfully', project);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update project';
    const statusCode = message.includes('not found') ? 404 : 500;
    sendError(res, message, statusCode);
  }
};

/** DELETE /api/projects/:id */
export const deleteProject = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;
    if (!userId) { sendError(res, 'Unauthorized', 401); return; }

    const projectId = req.params['id'] as string;
    if (!projectId) { sendError(res, 'Project ID is required', 400); return; }

    await projectService.deleteProject(projectId, userId);
    sendSuccess(res, 'Project deleted successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete project';
    const statusCode = message.includes('not authorized') || message.includes('not found') ? 404 : 500;
    sendError(res, message, statusCode);
  }
};

/** GET /api/explore */
export const getExploreProjects = async (_req: Request, res: Response): Promise<void> => {
  try {
    const projects = await projectService.getDeployedProjects();
    sendSuccess(res, 'Deployed projects retrieved', projects);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get projects';
    sendError(res, message, 500);
  }
};

// ──────────────────────────────────────────────────────────
// CONTRACT MANAGEMENT (thêm / sửa / xóa trong 1 project)
// ──────────────────────────────────────────────────────────

/**
 * POST /api/projects/:id/contracts
 * Body: { soliditySource, name? }
 */
export const addContract = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;
    if (!userId) { sendError(res, 'Unauthorized', 401); return; }

    const projectId = req.params['id'] as string;
    let { soliditySource, name } = req.body as { soliditySource?: string; name?: string };

    if (!soliditySource) {
      const contractName = name || 'NewContract';
      soliditySource = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract ${contractName} {
    uint256 public value;
    
    function setValue(uint256 _value) public {
        value = _value;
    }
}
`;
    } else if (!soliditySource.includes('pragma solidity')) {
      sendError(res, 'Invalid Solidity source: missing pragma statement', 400); return;
    }

    const project = await projectService.addContract(projectId, userId, soliditySource, name);
    sendSuccess(res, 'Contract added successfully', project, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to add contract';
    const statusCode = message.includes('not found') ? 404 : 500;
    sendError(res, message, statusCode);
  }
};

/**
 * PATCH /api/projects/:id/contracts/:contractId
 * Body: { name?, soliditySource? }
 */
export const updateContract = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;
    if (!userId) { sendError(res, 'Unauthorized', 401); return; }

    const projectId = req.params['id'] as string;
    const contractId = req.params['contractId'] as string;
    const updates = req.body as { name?: string; soliditySource?: string };

    const project = await projectService.updateContract(projectId, userId, contractId, updates);
    sendSuccess(res, 'Contract updated successfully', project);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update contract';
    const statusCode = message.includes('not found') ? 404
      : message.includes('Cannot edit source') ? 400
      : 500;
    sendError(res, message, statusCode);
  }
};

/**
 * DELETE /api/projects/:id/contracts/:contractId
 * Không cho phép xóa contract cuối cùng.
 */
export const removeContract = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;
    if (!userId) { sendError(res, 'Unauthorized', 401); return; }

    const projectId = req.params['id'] as string;
    const contractId = req.params['contractId'] as string;

    const project = await projectService.removeContract(projectId, userId, contractId);
    sendSuccess(res, 'Contract removed successfully', project);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to remove contract';
    const statusCode = message.includes('not found') ? 404
      : message.includes('last contract') ? 400
      : 500;
    sendError(res, message, statusCode);
  }
};

// ──────────────────────────────────────────────────────────
// PIPELINE: Compile / Deploy / Estimate Gas
// ──────────────────────────────────────────────────────────

/** POST /api/projects/:id/contracts/:contractId/compile */
export const compileContract = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;
    if (!userId) { sendError(res, 'Unauthorized', 401); return; }

    const projectId = req.params['id'] as string;
    const contractId = req.params['contractId'] as string;

    const result = await projectService.compileContract_(projectId, userId, contractId);
    sendSuccess(res, 'Compilation successful', result);
  } catch (error: any) {
    const message = error.message || 'Compilation failed';
    const statusCode = message.includes('not found') ? 404 : 400;
    sendError(res, message, statusCode, error.details);
  }
};

/**
 * POST /api/projects/:id/contracts/:contractId/deploy
 * Body: { constructorArgs?: unknown[] }
 */
export const deployContract = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;
    if (!userId) { sendError(res, 'Unauthorized', 401); return; }

    const projectId = req.params['id'] as string;
    const contractId = req.params['contractId'] as string;
    const { constructorArgs = [] } = req.body as { constructorArgs?: unknown[] };

    const result = await projectService.deployContract_(projectId, userId, contractId, constructorArgs);
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
 * GET /api/projects/:id/contracts/:contractId/estimate-deploy
 */
export const estimateDeployGas = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;
    if (!userId) { sendError(res, 'Unauthorized', 401); return; }

    const projectId = req.params['id'] as string;
    const contractId = req.params['contractId'] as string;
    const { constructorArgs = [] } = req.query as { constructorArgs?: unknown[] };

    const result = await projectService.estimateDeployGas(projectId, userId, contractId, constructorArgs);
    sendSuccess(res, 'Gas estimate calculated', result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to estimate gas';
    const isI18nError = message.startsWith('common.errors');
    const statusCode = message.includes('not found') ? 404
      : (message.includes('Must compile') || isI18nError) ? 200
      : 500;
      
    if (isI18nError || message.includes('Must compile')) {
      res.status(200).json({ success: false, message });
    } else {
      sendError(res, message, statusCode);
    }
  }
};

/**
 * PUT /api/projects/:id/contracts/reorder
 * Body: { contractIds: string[] }
 */
export const reorderContracts = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;
    if (!userId) { sendError(res, 'Unauthorized', 401); return; }

    const projectId = req.params['id'] as string;
    const { contractIds } = req.body as { contractIds: string[] };

    if (!contractIds || !Array.isArray(contractIds)) {
      sendError(res, 'contractIds array is required', 400); return;
    }

    const project = await projectService.reorderContracts(projectId, userId, contractIds);
    sendSuccess(res, 'Contracts reordered', project);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to reorder contracts';
    const statusCode = message.includes('not found') ? 404 : 500;
    sendError(res, message, statusCode);
  }
};
