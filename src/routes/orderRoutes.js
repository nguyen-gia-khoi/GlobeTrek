const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const authController = require('../Middleware/authMiddleware');

router.post('/api/create', authController.verifyToken, orderController.createOrder);
router.get('/api/list', authController.verifyToken, orderController.getUserOrders);
router.post('/api/process-payment', orderController.processPayment);
router.post('/api/cancel',   orderController.cancelOrder); 
router.post('/api/refund', orderController.Refund);
router.post('/api/whrefund', orderController.weekhookRefund);


module.exports = router;