const express = require("express");
const router = express.Router();
const {
  getDailyRevenue,
  getMonthlyRevenue,
  getYearlyRevenue,
  getWeeklyRevenueForAllPartners,
  getMonthlyRevenueForEachPartner,
  getTotalRevenueForAllPartners,
  processMonthlyPayments
} = require("../../controllers/Admin/revenueController");
const {verifyAdmin} = require('../../Middleware/authMiddleware');
// Route lấy doanh thu hàng ngày cho admin
router.get("/daily" ,getDailyRevenue);

// Route lấy doanh thu hàng tháng cho admin
router.get("/monthly" ,getMonthlyRevenue);

// Route lấy doanh thu hàng năm cho admin
router.get("/yearly" ,getYearlyRevenue);

router.get("/process-payment", verifyAdmin , processMonthlyPayments);

// doanh thu trong tuần của partner.
router.get("/partner/weekly-revenue" ,getWeeklyRevenueForAllPartners);

router.get("/partner/monthly-revenue" ,getMonthlyRevenueForEachPartner);

router.get("/partner/total-revenue", verifyAdmin ,getTotalRevenueForAllPartners);




module.exports = router;
