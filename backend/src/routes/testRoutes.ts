import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { runProjectTests } from '../controllers/testController.js';

const router = Router();

router.use(auth);

// POST /api/tests/:id/contracts/:contractId — Run tests for a specific contract
router.post('/:id/contracts/:contractId', runProjectTests);

export default router;
