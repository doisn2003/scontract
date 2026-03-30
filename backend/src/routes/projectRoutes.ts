import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import {
  createProject,
  compileProject,
  deployProject,
  getProjects,
  getProject,
} from '../controllers/projectController.js';

const router = Router();

// All routes require authentication
router.use(auth);

// CRUD
router.post('/', createProject);           // POST /api/projects
router.get('/', getProjects);              // GET  /api/projects
router.get('/:id', getProject);            // GET  /api/projects/:id

// Pipeline
router.post('/:id/compile', compileProject); // POST /api/projects/:id/compile
router.post('/:id/deploy', deployProject);   // POST /api/projects/:id/deploy

export default router;
