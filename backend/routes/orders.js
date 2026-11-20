import { Router } from 'express';
import { createOrder, getMyOrders } from '../controllers/orderController.js';
const router = Router();
router.post('/', createOrder);
router.get('/mine', getMyOrders);
export default router;
