// src/routes/tourTypeRoutes.js
const express = require('express');
const router = express.Router();
const tourTypeController = require('../controllers/Admin/tourtypeController');
const { requireAdmin } = require('../Middleware/authMiddleware');

// Định nghĩa các route cho TourType
router.get('/', requireAdmin, tourTypeController.getAllTourTypes); 
router.get('/api', tourTypeController.getAllTourTypesAPI);
router.post('/', requireAdmin, tourTypeController.createTourType);
router.post('/create', requireAdmin, tourTypeController.createTourType);
router.post('/edit/:id', requireAdmin, tourTypeController.updateTourType);
router.post('/:id', requireAdmin, tourTypeController.updateTourType);

module.exports = router;
