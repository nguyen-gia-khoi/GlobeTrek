const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const authController = require('../Middleware/authMiddleware'); // Đảm bảo đường dẫn chính xác

router.post('/api/create', authController.verifyToken, orderController.createOrder);
router.get('/api/list', authController.verifyToken, orderController.getUserOrders);
router.post('/api/process-payment', orderController.processPayment);
router.post('/api/cancel',   orderController.cancelOrder); 
router.post('/api/cancel-paid-order', orderController.cancelPaidOrder);


module.exports = router;
