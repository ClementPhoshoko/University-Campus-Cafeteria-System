import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import {
  createOrder,
  listMyOrders,
  getMyOrder,
  cancelMyOrder,
  reorderOrder,
  rateOrder,
} from '../controllers/orderController.js';

const orderRouter = Router();

orderRouter.use(authenticate);

orderRouter.post('/orders', createOrder);
orderRouter.get('/orders', listMyOrders);
orderRouter.get('/orders/:orderId', getMyOrder);
orderRouter.post('/orders/:orderId/cancel', cancelMyOrder);
orderRouter.post('/orders/:orderId/reorder', reorderOrder);
orderRouter.post('/orders/:orderId/rate', rateOrder);

export default orderRouter;
