const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const authController = require('../Middleware/authMiddleware');
const { verifyWebhook } = require('../Middleware/security/webhookAuth');
const { webhookLimiter } = require('../Middleware/security/rateLimiters');

router.post('/api/create', authController.verifyToken, orderController.createOrder);
router.get('/api/list', authController.verifyToken, orderController.getUserOrders);
router.get('/api/detail/:orderId', authController.verifyToken, orderController.getOrderDetail);
router.get('/api/:orderId', authController.verifyToken, orderController.getOrderDetail);
router.post('/api/process-payment', authController.verifyToken, orderController.processPayment);
router.post('/api/cancel', authController.verifyToken, orderController.cancelOrder);
router.post('/api/refund', authController.verifyToken, orderController.Refund);
router.post('/api/whrefund', webhookLimiter, verifyWebhook, orderController.weekhookRefund);
router.get('/connect_wallet', authController.verifyToken, orderController.connectWallet)
router.post('/handelEvent', webhookLimiter, verifyWebhook, orderController.handelEvent)
// PayPal routes
router.post('/api/paypal/create-payment', authController.verifyToken, orderController.createPaypalPayment);
router.post('/api/paypal/capture-payment', authController.verifyToken, orderController.capturePaypalPayment);


module.exports = router;