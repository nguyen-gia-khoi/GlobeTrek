// src/routes/tourTypeRoutes.js
const express = require('express');
const router = express.Router();
const tourTypeController = require('../controllers/Admin/tourtypeController');

// Định nghĩa các route cho TourType
router.get('/', tourTypeController.getAllTourTypes); 
router.get('/api', tourTypeController.getAllTourTypesAPI);



module.exports = router;
