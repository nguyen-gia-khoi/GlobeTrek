const express = require('express');
const router = express.Router();
const scheduleController = require('../../controllers/Admin/scheduleController');
const {verifyAdmin} = require('../../Middleware/authMiddleware')

router.get('/tours/:tourId/schedules/new',verifyAdmin, scheduleController.renderNewSchedulePage);
router.post('/tours/:tourId/schedules',verifyAdmin, scheduleController.createScheduleApi);
router.get('/tours/:tourId/schedules/:scheduleId/edit',verifyAdmin, scheduleController.renderEditSchedulePage); 
router.post('/tours/:tourId/schedules/:scheduleId',verifyAdmin, scheduleController.updateScheduleApi);
router.post('/tours/:tourId/schedules/:scheduleId/delete',verifyAdmin,scheduleController.deleteScheduleApi);
module.exports = router;