import { Router } from 'express';
import webRoutes from './web.routes.js';
import apiRoutes from './api.routes.js';

const router = Router();

router.use('/api', apiRoutes);
router.use('/', webRoutes);

export default router;

