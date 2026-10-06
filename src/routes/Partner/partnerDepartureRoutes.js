const express = require('express');
const controller = require('../../controllers/Partner/PartnerDepartureController');
const { requireVerifiedPartner } = require('../../Middleware/authMiddleware');

const router = express.Router();

router.use(requireVerifiedPartner);
router.get('/', controller.listDepartures);
router.post('/', controller.createDepartures);
router.post('/:id', controller.updateDeparture);
router.post('/:id/delete', controller.deleteDeparture);

module.exports = router;
