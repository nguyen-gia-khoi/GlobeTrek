const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { requireAdmin, requireVerifiedPartner, verifyToken } = require('../Middleware/authMiddleware');
const { authLimiter, sensitiveLimiter } = require('../Middleware/security/rateLimiters');

router.post('/signup', authLimiter, authController.signup);
router.post('/verify-account', authLimiter, authController.verfiaccount);
router.post("/signin", authLimiter, authController.signin);
router.post("/signout", authController.signout);
router.post("/refresh-token", sensitiveLimiter, authController.refreshToken);
router.post("/forgot-password", sensitiveLimiter, authController.forgotPassword);
router.post("/reset-password/:token", sensitiveLimiter, authController.resetPassword);
router.post("/check-email", sensitiveLimiter, authController.checkEmail);
router.put('/update-profile', verifyToken, authController.updateProfile);
router.post('/update-profile', verifyToken, authController.updateProfile);
router.put('/updateProfile', verifyToken, authController.updateProfile);
router.post('/updateProfile', verifyToken, authController.updateProfile);
router.get('/callback', authController.callback);
router.get('/login', authController.getLoginPage);
router.get('/register', authController.getRegisterPage);
router.get('/home', requireAdmin, authController.getHomePage);
router.get('/homePartner', requireVerifiedPartner, authController.getHomePartnerPage);
router.get('/unverified-partners', requireAdmin, authController.getUnverifiedPartners);
router.post('/partner/verify', requireAdmin, authController.verifyPartner);
router.get("/callback_partner", authController.Partner_callback);
router.get("/checkSSO", authController.CheckSSO);
module.exports = router;
    