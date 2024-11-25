const express = require('express');
const router = express.Router();
const { getPartnerOrders,renderPartnerOrdersPage } = require('../../controllers/Partner/PartnerOrderController'); // Import controller
const {verifyAdmin} = require('../../Middleware/authMiddleware');

router.get('/api/orders' , getPartnerOrders);
router.get('/', renderPartnerOrdersPage);

module.exports = router;
    