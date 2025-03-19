const jwt = require('jsonwebtoken');
const Order = require('../../models/Order');
const { Tour } = require('../../models/Tour');
const User = require('../../models/User');
const moment = require('moment');

// Hàm tính doanh thu theo khoảng thời gian (tái sử dụng và tối ưu)
const getRevenueByTimePeriod = async (tourIds, startDate, endDate) => {
  const result = await Order.aggregate([
    {
      $match: {
        tour: { $in: tourIds },
        status: 'paid',
        createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) },
      },
    },
    {
      $group: {
        _id: '$tour',
        totalRevenue: { $sum: '$totalValue' },
        ordersCount: { $sum: 1 },
      },
    },
  ]).exec();
  return result.reduce((acc, item) => {
    acc[item._id] = { totalRevenue: item.totalRevenue, ordersCount: item.ordersCount };
    return acc;
  }, {});
};

// Hàm chính lấy doanh thu đối tác
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

    // Lấy thông tin đối tác và tours cùng lúc (giảm truy vấn)
    const [partner, tours] = await Promise.all([
      User.findById(partnerId).select('name email').lean(),
      Tour.find({ partner: partnerId }).select('_id title').lean(),
    ]);

    if (!tours.length) {
      return res.render('Revenue/Partner/PartnerRevenue', {
        success: true,
        partnerName: partner?.name || '',
        partnerEmail: partner?.email || '',
        revenueData: [],
        totalRevenue: 0,
        totalActualRevenue: 0,
        dailyRevenue: [],
        weeklyRevenue: [],
        monthlyRevenue: [],
        yearlyRevenue: [],
      });
    }

    const tourIds = tours.map(tour => tour._id);

    // Tính toán tất cả doanh thu trong một truy vấn duy nhất
    const revenuePeriods = await Promise.all([
      Order.aggregate([
        { $match: { tour: { $in: tourIds }, status: 'paid' } },
        {
          $group: {
            _id: '$tour',
            totalRevenue: { $sum: '$totalValue' },
            ordersCount: { $sum: 1 },
          },
        },
      ]).exec(),
      getRevenueByTimePeriod(tourIds, moment().startOf('day').toISOString(), moment().endOf('day').toISOString()),
      getRevenueByTimePeriod(tourIds, moment().startOf('week').toISOString(), moment().endOf('week').toISOString()),
      getRevenueByTimePeriod(tourIds, moment().startOf('month').toISOString(), moment().endOf('month').toISOString()),
      getRevenueByTimePeriod(tourIds, moment().startOf('year').toISOString(), moment().endOf('year').toISOString()),
    ]);

    const [totalRevenueData, dailyRevenue, weeklyRevenue, monthlyRevenue, yearlyRevenue] = revenuePeriods;

    // Tạo map từ totalRevenueData để tra cứu nhanh
    const revenueMap = totalRevenueData.reduce((acc, item) => {
      acc[item._id] = { totalRevenue: item.totalRevenue, ordersCount: item.ordersCount };
      return acc;
    }, {});

    let totalRevenue = 0;
    let totalActualRevenue = 0;
    const revenueData = tours.map(tour => {
      const revenueInfo = revenueMap[tour._id] || { totalRevenue: 0, ordersCount: 0 };
      const tourRevenue = revenueInfo.totalRevenue;
      const actualRevenue = tourRevenue * 0.7; // Tỷ lệ thực tế 70%
      totalRevenue += tourRevenue;
      totalActualRevenue += actualRevenue;

      return {
        tourName: tour.title,
        revenue: tourRevenue,
        actualRevenue,
        ordersCount: revenueInfo.ordersCount,
      };
    });

    // Render kết quả
    res.render('Revenue/Partner/PartnerRevenue', {
      success: true,
      partnerName: partner.name,
      partnerEmail: partner.email,
      revenueData,
      totalRevenue,
      totalActualRevenue,
      dailyRevenue: Object.entries(dailyRevenue),
      weeklyRevenue: Object.entries(weeklyRevenue),
      monthlyRevenue: Object.entries(monthlyRevenue),
      yearlyRevenue: Object.entries(yearlyRevenue),
    });
  } catch (err) {
    console.error('Error in getPartnerRevenue:', err);
    if (err instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }
    res.status(500).json({
      success: false,
      message: `Error calculating revenue: ${err.message}`,
    });
  }
};

module.exports = { getPartnerRevenue };