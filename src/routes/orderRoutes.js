const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const authController = require('../Middleware/authMiddleware');
const { verify } = require('jsonwebtoken');

router.post('/api/create', authController.verifyToken, orderController.createOrder);
router.get('/api/list', authController.verifyToken, orderController.getUserOrders);
router.post('/api/process-payment', orderController.processPayment);
router.post('/api/cancel',   orderController.cancelOrder); 
router.post('/api/refund', orderController.Refund);
router.post('/api/whrefund', orderController.weekhookRefund);
router.get('/connect_wallet', authController.verifyToken, orderController.connectWallet)
router.post('/handelEvent', orderController.handelEvent)
// PayPal routes
router.post('/api/paypal/create-payment',  orderController.createPaypalPayment);
router.post('/api/paypal/capture-payment', orderController.capturePaypalPayment);


module.exports = router;