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
import {
  createCatalogueMetadata,
  listCatalogueMetadata,
  updateCatalogueMetadata,
} from '../controllers/adminCatalogueMetadataController.js';

const adminRouter = Router();

// Keep the role guard within the admin namespace. This router shares the
// /api/v1 mount point with employee endpoints; unmatched employee routes must
// not fall through and be reported as admin-only.
adminRouter.use('/admin', authenticate, requireRole('admin'));

adminRouter.get('/admin/users', listUsers);
adminRouter.get('/admin/users/:userId/roles', getUserRoles);
adminRouter.put('/admin/users/:userId/roles', setUserRoles);
adminRouter.post('/admin/users/:userId/roles', addRole);
adminRouter.delete('/admin/users/:userId/roles/:role', removeRole);
adminRouter.get('/admin/catalogue-metadata', listCatalogueMetadata);
adminRouter.post('/admin/catalogue-metadata', createCatalogueMetadata);
adminRouter.patch('/admin/catalogue-metadata/:type/:id', updateCatalogueMetadata);

export default adminRouter;
