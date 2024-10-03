const express = require('express');
const router = express.Router();
const tourController = require('../controllers/tourController'); // Make sure this path is correct

router.get('/', tourController.getTours); // Ensure getTours is correctly defined
router.get('/create', tourController.getCreateTour);
router.post('/create', tourController.postCreateTour);
router.get('/:id/edit', tourController.getUpdateTour);
router.post('/:id/edit', tourController.postUpdateTour);
router.get('/:id/delete', tourController.getDeleteTour);
router.post('/:id/delete', tourController.postDeleteTour);
router.post('/toggle-schedule', tourController.toggleScheduleStatus);

module.exports = router;
