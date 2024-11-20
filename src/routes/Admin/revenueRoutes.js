const express = require("express");
const router = express.Router();
const {
  getDailyRevenue,
  getMonthlyRevenue,
  getYearlyRevenue,
  getWeeklyRevenueForAllPartners,
  getTotalRevenueForAllPartners
} = require("../../controllers/Admin/revenueController");

// Route lấy doanh thu hàng ngày cho admin
router.get("/daily", getDailyRevenue);

// Route lấy doanh thu hàng tháng cho admin
router.get("/monthly", getMonthlyRevenue);

// Route lấy doanh thu hàng năm cho admin
router.get("/yearly", getYearlyRevenue);

// doanh thu trong tuần của partner.
router.get("/partner/weekly-revenue", getWeeklyRevenueForAllPartners);

router.get("/partner/total-revenue", getTotalRevenueForAllPartners);




module.exports = router;
