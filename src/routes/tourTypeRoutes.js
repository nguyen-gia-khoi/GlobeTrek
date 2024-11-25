// src/routes/tourTypeRoutes.js
const express = require('express');
const router = express.Router();
const tourTypeController = require('../controllers/Admin/tourtypeController');
const {verifyAdmin} = require('../Middleware/authMiddleware');

// Định nghĩa các route cho TourType
router.get('/',verifyAdmin , tourTypeController.getAllTourTypes); 
router.get('/api',verifyAdmin , tourTypeController.getAllTourTypesAPI);



module.exports = router;
