const express = require('express');
const router = express.Router();
const destinationController = require('../controllers/destinationController');

// Định nghĩa các route cho Destination
router.get('/', destinationController.getAllDestinations); // Lấy danh sách Destination


module.exports = router;
