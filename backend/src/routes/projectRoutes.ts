import { Router } from 'express';
import { auth } from '../middleware/auth.js';
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

const router = Router();

// Tất cả routes yêu cầu xác thực
router.use(auth);

// ── Project CRUD ──────────────────────────────────────────────────────────
router.post('/', createProject);                // POST   /api/projects
router.get('/', getProjects);                   // GET    /api/projects
router.get('/:id', getProject);                 // GET    /api/projects/:id
router.patch('/:id', updateProject);             // PATCH  /api/projects/:id  (name/desc)
router.delete('/:id', deleteProject);            // DELETE /api/projects/:id

// ── Contract Management (IDE Tabs) ────────────────────────────────────────
router.post('/:id/contracts', addContract);                           // Thêm contract
router.patch('/:id/contracts/:contractId', updateContract);           // Đổi tên / Sửa source
router.delete('/:id/contracts/:contractId', removeContract);          // Xóa contract (min 1)
router.put('/:id/contracts/reorder', reorderContracts);               // Sắp xếp lại thứ tự tab

// ── Pipeline per Contract ─────────────────────────────────────────────────
router.post('/:id/contracts/:contractId/compile', compileContract);                // Compile
router.post('/:id/contracts/:contractId/deploy', deployContract);                  // Deploy
router.get('/:id/contracts/:contractId/estimate-deploy', estimateDeployGas);       // Gas estimate

export default router;
