import { Router } from 'express';
import { getExploreProjects } from '../controllers/projectController.js';

const router = Router();

// Explore is public (or optionally auth-protected)
// GET /api/explore — list all deployed projects
router.get('/', getExploreProjects);

export default router;
