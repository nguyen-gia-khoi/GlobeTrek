const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const {verifyAdmin} = require('../Middleware/authMiddleware');

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
router.get('/home',verifyAdmin ,authController.getHomePage)
router.get('/homePartner',verifyAdmin ,authController.getHomePartnerPage)
router.get('/unverified-partners', verifyAdmin ,authController.getUnverifiedPartners);
router.post('/partner/verify',authController.verifyPartner)
router.get("/callback_partner",authController.Partner_callback)
router.get("/checkSSO", authController.CheckSSO)
module.exports = router;
    