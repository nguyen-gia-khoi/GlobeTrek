const express = require('express');
const controller = require('../controllers/promotionController');
const { verifyToken } = require('../Middleware/authMiddleware');

const router = express.Router();

router.post('/quote', verifyToken, controller.quote);

module.exports = router;
