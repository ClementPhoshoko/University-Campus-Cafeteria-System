import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { requireRole } from '../middleware/auth.js';
import {
  listUsers,
  getUserRoles,
  setUserRoles,
  addRole,
  removeRole,
} from '../controllers/adminController.js';

const adminRouter = Router();

// All admin routes require authentication + admin role
adminRouter.use(authenticate, requireRole('admin'));

adminRouter.get('/admin/users', listUsers);
adminRouter.get('/admin/users/:userId/roles', getUserRoles);
adminRouter.put('/admin/users/:userId/roles', setUserRoles);
adminRouter.post('/admin/users/:userId/roles', addRole);
adminRouter.delete('/admin/users/:userId/roles/:role', removeRole);

export default adminRouter;
