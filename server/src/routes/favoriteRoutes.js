import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import {
  listFavoriteVendors,
  toggleFavoriteVendor,
  listFavoriteMenuItems,
  toggleFavoriteMenuItem,
} from '../controllers/favoriteController.js';

const favoriteRouter = Router();

favoriteRouter.use(authenticate);

favoriteRouter.get('/favorites/vendors', listFavoriteVendors);
favoriteRouter.post('/favorites/vendors/:vendorId', toggleFavoriteVendor);
favoriteRouter.get('/favorites/menu-items', listFavoriteMenuItems);
favoriteRouter.post('/favorites/menu-items/:menuItemId', toggleFavoriteMenuItem);

export default favoriteRouter;
