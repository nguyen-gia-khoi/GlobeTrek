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
module.exports = router;
