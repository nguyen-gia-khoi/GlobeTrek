const express = require('express');
const router = express.Router();
const scheduleController = require('../controllers/scheduleController');

router.get('/tours/:tourId/schedules', scheduleController.getSchedules);



module.exports = router;
