const express = require('express');
const router = express.Router();
const { getPartnerOrders,renderPartnerOrdersPage } = require('../../controllers/Partner/PartnerOrderController'); // Import controller
const {verifyAdmin} = require('../../Middleware/authMiddleware');

router.get('/api/orders',  verifyAdmin , getPartnerOrders);
router.get('/', verifyAdmin , renderPartnerOrdersPage);

module.exports = router;
    