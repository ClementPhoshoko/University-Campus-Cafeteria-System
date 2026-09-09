import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import {
  getCart,
  addToCart,
  updateCartItem,
  removeCartItem,
  clearCart,
} from '../controllers/cartController.js';

const cartRouter = Router();

cartRouter.use(authenticate);

cartRouter.get('/cart', getCart);
cartRouter.post('/cart/items', addToCart);
cartRouter.patch('/cart/items/:itemId', updateCartItem);
cartRouter.delete('/cart/items/:itemId', removeCartItem);
cartRouter.delete('/cart', clearCart);

export default cartRouter;
