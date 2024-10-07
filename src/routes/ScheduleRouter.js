const express = require('express');
const router = express.Router();
const scheduleController = require('../controllers/scheduleController');

router.get('/tours/:tourId/schedules', scheduleController.getSchedules);
router.get('/tours/:tourId/schedules/new', scheduleController.renderNewSchedulePage);
router.post('/tours/:tourId/schedules', scheduleController.createScheduleApi);
router.get('/tours/:tourId/schedules/:scheduleId/edit', scheduleController.renderEditSchedulePage); 
router.post('/tours/:tourId/schedules/:scheduleId', scheduleController.updateScheduleApi);
router.post('/tours/:tourId/schedules/:scheduleId/delete',scheduleController.deleteScheduleApi);


module.exports = router;
