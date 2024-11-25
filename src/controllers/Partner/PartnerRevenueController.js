const jwt = require('jsonwebtoken');
const Order = require('../../models/Order');
const { Tour } = require('../../models/Tour');
const User = require('../../models/User');
const moment = require('moment');

// Hàm tính doanh thu theo khoảng thời gian
const getRevenueByTimePeriod = async (tourIds, startDate, endDate) => {
  return Order.aggregate([
    {
      $match: {
        tour: { $in: tourIds },
        status: 'paid', // Chỉ tính đơn hàng đã thanh toán
        createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) }, // Lọc theo khoảng thời gian
      },
    },
    {
      $group: {
        _id: '$tour', // Nhóm theo tour ID
        totalRevenue: { $sum: '$totalValue' },
        ordersCount: { $sum: 1 },
      },
    },
  ]);
};

const getPartnerRevenue = async (req, res) => {
  try {
    const token = req.cookies.PartneraccessToken;
    if (!token) {
      return res.status(401).json({ message: 'Token not found, please login' });
    }

    // Giải mã token
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    const partnerId = decoded.userId;

    if (!partnerId) {
      return res.status(400).json({ message: 'Partner ID not found in token' });
    }

    // Lấy danh sách tours của đối tác
    const tours = await Tour.find({ partner: partnerId }).select('_id title');

    if (!tours.length) {
      return res.render('Revenue/Partner/PartnerRevenue', {
        success: true,
        partnerName: '',
        partnerEmail: '',
        revenueData: [],
        totalRevenue: 0,
        totalActualRevenue: 0,
        dailyRevenue: [],
        weeklyRevenue: [],
        monthlyRevenue: [],
        yearlyRevenue: [],
      });
    }

    // Lấy danh sách tour ID
    const tourIds = tours.map(tour => tour._id);

    // Tính tổng doanh thu và doanh thu thực tế
    const orders = await Order.aggregate([
      {
        $match: {
          tour: { $in: tourIds },
          status: 'paid',
        },
      },
      {
        $group: {
          _id: '$tour', // Nhóm theo tour ID
          totalRevenue: { $sum: '$totalValue' },
          ordersCount: { $sum: 1 },
        },
      },
    ]);

    let totalRevenue = 0;
    let totalActualRevenue = 0;
    const revenueData = tours.map(tour => {
      const order = orders.find(o => o._id.toString() === tour._id.toString());
      if (order) {
        const tourRevenue = order.totalRevenue;
        const actualRevenue = tourRevenue * 0.7; // Giả sử tỷ lệ thực tế là 70%
        totalRevenue += tourRevenue;
        totalActualRevenue += actualRevenue;

        return {
          tourName: tour.title,
          revenue: tourRevenue,
          actualRevenue: actualRevenue,
          ordersCount: order.ordersCount,
        };
      }
      return {
        tourName: tour.title,
        revenue: 0,
        actualRevenue: 0,
        ordersCount: 0,
      };
    });

    // Tính doanh thu theo ngày, tuần, tháng, năm
    const dailyRevenue = await getRevenueByTimePeriod(tourIds, moment().startOf('day').toISOString(), moment().endOf('day').toISOString());
    const weeklyRevenue = await getRevenueByTimePeriod(tourIds, moment().startOf('week').toISOString(), moment().endOf('week').toISOString());
    const monthlyRevenue = await getRevenueByTimePeriod(tourIds, moment().startOf('month').toISOString(), moment().endOf('month').toISOString());
    const yearlyRevenue = await getRevenueByTimePeriod(tourIds, moment().startOf('year').toISOString(), moment().endOf('year').toISOString());

    const partner = await User.findById(partnerId).select('name email');

    res.render('Revenue/Partner/PartnerRevenue', {
      success: true,
      partnerName: partner.name,
      partnerEmail: partner.email,
      revenueData: revenueData,
      totalRevenue: totalRevenue,
      totalActualRevenue: totalActualRevenue,
      dailyRevenue: dailyRevenue,
      weeklyRevenue: weeklyRevenue,
      monthlyRevenue: monthlyRevenue,
      yearlyRevenue: yearlyRevenue,
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
