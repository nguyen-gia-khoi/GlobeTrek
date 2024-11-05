const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/signup', authController.signup);
router.post('/verify-account', authController.verfiaccount)
router.post("/signin", authController.signin);
router.post("/signout", authController.signout);
router.post("/refresh-token", authController.refreshToken);
router.post("/forgot-password", authController.forgotPassword)
router.post("/reset-password/:token", authController.resetPassword)
router.post("/check-email",authController.checkEmail)
router.get('/callback',authController.callback)
router.get('/login', authController.getLoginPage);
router.get('/register', authController.getRegisterPage);
router.get('/home',authController.getHomePage)
router.get('/homePartner',authController.getHomePartnerPage)
router.get('/unverified-partners',authController.getUnverifiedPartners);
router.post('/partner/verify',authController.verifyPartner)
module.exports = router;
    