import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { runProjectTests } from '../controllers/testController.js';

const router = Router();

router.use(auth);

// POST /api/tests/:id — Run tests for a project
router.post('/:id', runProjectTests);

export default router;
