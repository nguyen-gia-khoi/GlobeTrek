const express = require("express");
const router = express.Router();
const { getPartnerTransactions } = require("../../controllers/Partner/TransationController");
const {verifyAdmin} = require('../../Middleware/authMiddleware');

// Route hiển thị giao dịch của Partner
router.get("/" ,  getPartnerTransactions);

module.exports = router;
