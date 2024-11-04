const express = require("express");
const router = express.Router();
const {
  getDailyRevenue,
  getMonthlyRevenue,
  getYearlyRevenue,
  getRevenueByTourAndPartner,getAllTourRevenueByPartner
} = require("../../controllers/Admin/revenueController");

// Route lấy doanh thu hàng ngày cho admin
router.get("/daily", getDailyRevenue);

// Route lấy doanh thu hàng tháng cho admin
router.get("/monthly", getMonthlyRevenue);

// Route lấy doanh thu hàng năm cho admin
router.get("/yearly", getYearlyRevenue);

// Route lấy doanh thu của tất cả các tour theo từng partner
router.get("/partner/:partnerId", getAllTourRevenueByPartner);

// Route lấy doanh thu của một tour thuộc về một partner
router.get("/tour/:tourId/partner/:partnerId", getRevenueByTourAndPartner);

module.exports = router;
