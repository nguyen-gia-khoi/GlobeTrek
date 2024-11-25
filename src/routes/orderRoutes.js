const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const authController = require('../Middleware/authMiddleware'); // Đảm bảo đường dẫn chính xác
const {verifyAdmin} = require('../Middleware/authMiddleware');

router.post('/api/create',verifyAdmin , orderController.createOrder);
router.get('/api/list',verifyAdmin , orderController.getUserOrders);
router.post('/api/process-payment', verifyAdmin ,orderController.processPayment);
router.post('/api/cancel',verifyAdmin ,   orderController.cancelOrder); 
router.post('/api/cancel-paid-order',verifyAdmin , orderController.cancelPaidOrder);


module.exports = router;
