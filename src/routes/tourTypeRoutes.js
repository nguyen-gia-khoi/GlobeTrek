// src/routes/tourTypeRoutes.js
const express = require('express');
const router = express.Router();
const tourTypeController = require('../controllers/tourTypeController');

// Định nghĩa các route cho TourType
router.get('/', tourTypeController.getAllTourTypes); // Lấy danh sách TourType

module.exports = router;
