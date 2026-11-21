import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import {
  clearReadNotifications,
  deleteNotification,
  getNotificationPreferences,
  getNotifications,
  getUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
  markNotificationUnread,
  updateNotificationPreferences,
} from '../controllers/notificationController.js';

const notificationRouter = Router();

notificationRouter.use(authenticate);

notificationRouter.get('/notifications', getNotifications);
notificationRouter.get('/notifications/unread-count', getUnreadCount);

// Static bulk paths must precede the dynamic /:notificationId delete route.
notificationRouter.patch('/notifications/read-all', markAllNotificationsRead);
notificationRouter.delete('/notifications/read', clearReadNotifications);

notificationRouter.patch('/notifications/:notificationId/read', markNotificationRead);
notificationRouter.patch('/notifications/:notificationId/unread', markNotificationUnread);
notificationRouter.delete('/notifications/:notificationId', deleteNotification);

notificationRouter.get('/notification-preferences', getNotificationPreferences);
notificationRouter.patch('/notification-preferences', updateNotificationPreferences);

export default notificationRouter;
