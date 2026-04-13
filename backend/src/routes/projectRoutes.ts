import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { requireRole } from '../middleware/roleMiddleware.js';
import {
  // Project CRUD
  createProject,
  getProjects,
  getProject,
  updateProject,
  deleteProject,
  // Contract Management
  addContract,
  updateContract,
  removeContract,
  // Pipeline
  compileContract,
  deployContract,
  estimateDeployGas,
  reorderContracts,
} from '../controllers/projectController.js';
import { requestCustomFaucet } from '../controllers/customFaucetController.js';

const router = Router();

// Tất cả routes yêu cầu xác thực
router.use(auth);

// Helper middleware for write access
const requireDevOrAdmin = requireRole(['dev', 'admin']);

// ── Project CRUD ──────────────────────────────────────────────────────────
router.post('/', requireDevOrAdmin, createProject);                // POST   /api/projects
router.get('/', getProjects);                   // GET    /api/projects
router.get('/:id', getProject);                 // GET    /api/projects/:id
router.patch('/:id', requireDevOrAdmin, updateProject);             // PATCH  /api/projects/:id  (name/desc)
router.delete('/:id', requireDevOrAdmin, deleteProject);            // DELETE /api/projects/:id

// ── Contract Management (IDE Tabs) ────────────────────────────────────────
router.post('/:id/contracts', requireDevOrAdmin, addContract);                           // Thêm contract
router.patch('/:id/contracts/:contractId', requireDevOrAdmin, updateContract);           // Đổi tên / Sửa source
router.delete('/:id/contracts/:contractId', requireDevOrAdmin, removeContract);          // Xóa contract (min 1)
router.put('/:id/contracts/reorder', requireDevOrAdmin, reorderContracts);               // Sắp xếp lại thứ tự tab

// ── Pipeline per Contract ─────────────────────────────────────────────────
router.post('/:id/contracts/:contractId/compile', requireDevOrAdmin, compileContract);                // Compile
router.post('/:id/contracts/:contractId/deploy', requireDevOrAdmin, deployContract);                  // Deploy
router.get('/:id/contracts/:contractId/estimate-deploy', requireDevOrAdmin, estimateDeployGas);       // Gas estimate

// ── Custom Faucet (Public for Authenticated Users) ───────────────────────
router.post('/:id/contracts/:contractId/faucet', requestCustomFaucet);                                // Custom Faucet

export default router;
