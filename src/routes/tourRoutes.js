const express = require('express');
const router = express.Router();
const tourController = require('../controllers/tourController');


router.get('/', tourController.getTours); // Hiển thị danh sách tour
router.get('/api', tourController.getToursAPI); // API để lấy danh sách tour

module.exports = router;
