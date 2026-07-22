import { Router } from 'express';
import authRoutes from './auth';
import errorRoutes from './errors';
import projectRoutes from './projects';
import notificationRoutes from './notifications';
import supportRoutes from './support';
import analyticsRoutes from './analytics';
import userRoutes from './users';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
});

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/errors', errorRoutes);
router.use('/projects', projectRoutes);
router.use('/notifications', notificationRoutes);
router.use('/support', supportRoutes);
router.use('/analytics', analyticsRoutes);

export default router;
