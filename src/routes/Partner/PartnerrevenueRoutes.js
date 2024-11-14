const express = require('express');
const router = express.Router();
const { getPartnerRevenue } = require('../../controllers/Partner/PartnerRevenueController');
// Route để lấy doanh thu của partner
router.get('/',  getPartnerRevenue);

module.exports = router;
