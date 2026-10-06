const express = require('express');
const controller = require('../../controllers/Partner/PartnerPromotionController');
const { requireVerifiedPartner } = require('../../Middleware/authMiddleware');

const router = express.Router();

router.use(requireVerifiedPartner);
router.get('/', controller.listPromotions);
router.post('/', controller.createPromotion);
router.post('/:id/delete', controller.deletePromotion);
router.post('/:id', controller.updatePromotion);

module.exports = router;
