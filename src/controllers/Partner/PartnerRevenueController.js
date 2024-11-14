const jwt = require('jsonwebtoken');  // Đảm bảo bạn đã cài thư viện jwt
const Order = require('../../models/Order');  // Mô hình Order
const { Tour } = require('../../models/Tour');  // Mô hình Tour
const User = require('../../models/User');  // Mô hình User để lấy thông tin partner

// Controller
const getPartnerRevenue = async (req, res) => {
  try {
    // Lấy token từ cookie
    const token = req.cookies.PartneraccessToken;

    if (!token) {
      return res.status(401).json({ message: 'Token not found, please login' });
    }

    // Giải mã token để lấy thông tin userId (partnerId)
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    const partnerId = decoded.userId;

    if (!partnerId) {
      return res.status(400).json({ message: 'Partner ID not found in token' });
    }

    // Tìm tất cả các tour của partner
    const tours = await Tour.find({ partner: partnerId });

    // Mảng để lưu doanh thu của từng tour
    let revenueData = [];
    let totalRevenue = 0;  // Biến để tính tổng doanh thu

    // Lặp qua các tour của partner và tính doanh thu cho mỗi tour
    for (let tour of tours) {
      // Lấy tất cả đơn hàng đã thanh toán của tour này
      const orders = await Order.find({ tour: tour._id, status: 'paid' });

      // Tính tổng doanh thu của tour
      let tourRevenue = 0;
      orders.forEach(order => {
        tourRevenue += order.totalValue;  // Tổng giá trị đơn hàng là totalAmount
      });

      // Thêm doanh thu của tour vào tổng doanh thu
      totalRevenue += tourRevenue;

      // Thêm dữ liệu doanh thu của tour vào mảng revenueData
      revenueData.push({
        tourName: tour.title,  // Tên tour
        revenue: tourRevenue,  // Doanh thu của tour
        ordersCount: orders.length  // Số lượng đơn hàng đã thanh toán
      });
    }

    // Tìm thông tin partner từ User model
    const partner = await User.findById(partnerId).select('name email'); // Lấy tên và email của partner

    // Trả về doanh thu của các tour và thông tin partner cho client
    res.render('Revenue/PartnerRevenue', {
      success: true,
      partnerName: partner.name,  // Trả về tên partner
      partnerEmail: partner.email, // Trả về email của partner
      revenueData: revenueData,  // Truyền dữ liệu doanh thu của các tour
      totalRevenue: totalRevenue  // Trả về tổng doanh thu của tất cả các tour
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
