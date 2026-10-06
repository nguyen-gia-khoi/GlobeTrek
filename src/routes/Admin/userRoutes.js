const express = require('express');
const router = express.Router();
const authController = require('../../controllers/authController');
const { requireAdmin } = require('../../Middleware/authMiddleware');

router.use(requireAdmin);

router.get('/users' ,authController.getUser)
router.get('/partners' ,authController.gePartners)
router.post('/banPartner' ,authController.banPartner)
router.post('/banAndUnban' ,authController.banAndUnbanUser)
module.exports = router;