const express = require('express');
const router = express.Router();
const { getPartnerOrders, renderPartnerOrdersPage, getTourPassengers, renderPurchaseHistoryPage } = require('../../controllers/Partner/PartnerOrderController');
const {requireVerifiedPartner} = require('../../Middleware/authMiddleware');

router.use(requireVerifiedPartner);

router.get('/api/orders', getPartnerOrders);
router.get('/api/tours/:tourId/passengers', getTourPassengers);
router.get('/history', renderPurchaseHistoryPage);
router.get('/', renderPartnerOrdersPage);

module.exports = router;
    