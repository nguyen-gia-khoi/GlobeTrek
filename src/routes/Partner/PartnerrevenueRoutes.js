const express = require('express');
const router = express.Router();
const { getPartnerRevenue } = require('../../controllers/Partner/PartnerRevenueController');
const {
  getPartnerTourPerformance,
} = require('../../controllers/Partner/PartnerTourPerformanceController');
const { requireVerifiedPartner } = require('../../Middleware/authMiddleware');

router.use(requireVerifiedPartner);

// Route để lấy doanh thu của partner
router.get('/tour-performance', getPartnerTourPerformance);
router.get('/', getPartnerRevenue);

module.exports = router;
