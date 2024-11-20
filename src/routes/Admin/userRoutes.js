const express = require('express');
const router = express.Router();
const authController = require('../../controllers/authController');
const {verifyAdmin} = require('../../Middleware/authMiddleware');
router.get('/users',verifyAdmin,authController.getUser)
router.get('/partners',verifyAdmin,authController.gePartners)
router.post('/banPartner',verifyAdmin,authController.banPartner)
router.post('/banAndUnban',verifyAdmin,authController.banAndUnbanUser)
module.exports = router;