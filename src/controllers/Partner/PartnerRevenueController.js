const jwt = require('jsonwebtoken');
const Order = require('../../models/Order');
const { Tour } = require('../../models/Tour');
const User = require('../../models/User');
const moment = require('moment');

// Controller
const getPartnerRevenue = async (req, res) => {
  try {
    const token = req.cookies.PartneraccessToken;

    if (!token) {
      return res.status(401).json({ message: 'Token not found, please login' });
    }
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    const partnerId = decoded.userId;

    if (!partnerId) {
      return res.status(400).json({ message: 'Partner ID not found in token' });
    }

    const tours = await Tour.find({ partner: partnerId });

    let revenueData = [];
    let totalRevenue = 0;
    let totalActualRevenue = 0; // Tổng doanh thu thực tế

    for (let tour of tours) {
      const orders = await Order.find({ tour: tour._id, status: 'paid' });

      let tourRevenue = 0;
      orders.forEach(order => {
        tourRevenue += order.totalValue;
      });

      totalRevenue += tourRevenue;

      let actualRevenue = tourRevenue * 0.7; // Giả sử tỷ lệ thực tế là 70%
      totalActualRevenue += actualRevenue; // Cộng dồn doanh thu thực tế

      revenueData.push({
        tourName: tour.title,
        revenue: tourRevenue,
        actualRevenue: actualRevenue,
        ordersCount: orders.length
      });
    }

    const partner = await User.findById(partnerId).select('name email');

    res.render('Revenue/Partner/PartnerRevenue', {
      success: true,
      partnerName: partner.name,
      partnerEmail: partner.email,
      revenueData: revenueData,
      totalRevenue: totalRevenue,
      totalActualRevenue: totalActualRevenue, // Trả về tổng doanh thu thực tế
    });
  } catch (err) {
    console.error(err);
    if (err instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }
    res.status(500).json({
      success: false,
      message: 'Lỗi khi tính toán doanh thu',
    });
  }
};

module.exports = {
  getPartnerRevenue
};
