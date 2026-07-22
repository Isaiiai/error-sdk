import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { Notification } from '../models/Notification';
import { success, fail, getPagination, paginationMeta } from '../utils/response';

const router = Router();

router.use(authenticate);

router.get('/', async (req: AuthRequest, res) => {
  try {
    const { page, limit, skip } = getPagination(req);
    const filter = { userId: req.user!._id };
    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Notification.countDocuments(filter),
      Notification.countDocuments({ ...filter, isRead: false }),
    ]);
    return success(res, {
      notifications,
      unreadCount,
      pagination: paginationMeta(page, limit, total),
    });
  } catch (err) {
    const e = err as Error;
    return fail(res, 500, 'ERROR', e.message);
  }
});

router.patch('/:notificationId', async (req: AuthRequest, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.notificationId, userId: req.user!._id },
      { $set: { isRead: req.body.isRead ?? true } },
      { new: true }
    );
    if (!notification) return fail(res, 404, 'NOT_FOUND', 'Notification not found');
    return success(res, notification);
  } catch (err) {
    const e = err as Error;
    return fail(res, 500, 'ERROR', e.message);
  }
});

export default router;
