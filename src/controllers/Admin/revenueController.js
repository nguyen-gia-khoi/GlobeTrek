const mongoose = require("mongoose");
const {Revenue} = require("../../models/Revenue");
const Order = require("../../models/Order"); 
const {Tour} = require("../../models/Tour"); 
const Transaction = require("../../models/Transaction"); 
const User = require("../../models/User");
const { recordAudit } = require("../../service/auditService");
const startOfDay = (date) => {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
};

const endOfDay = (date) => {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
};

const formatDayKey = (date) => {
  const value = new Date(date);
  const day = String(value.getDate()).padStart(2, '0');
  const month = String(value.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${value.getFullYear()}`;
};

// Lấy doanh thu hàng ngày cho admin trong một tuần
const getDailyRevenue = async (req, res) => {
  try {
    const today = new Date();
    const startOfWeek = startOfDay(today);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());

    const endOfWeek = endOfDay(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    const orders = await Order.find({
      status: "paid",
      createdAt: { $gte: startOfWeek, $lte: endOfWeek },
    });

    const dailyRevenues = {
      admin: {},
      partner: {}
    };

    for (let order of orders) {
      const orderDate = formatDayKey(order.createdAt);

      const partnerRevenue = order.totalValue * 0.7;
      const adminRevenue = order.totalValue * 0.3;

      dailyRevenues.partner[orderDate] = (dailyRevenues.partner[orderDate] || 0) + partnerRevenue;
      dailyRevenues.admin[orderDate] = (dailyRevenues.admin[orderDate] || 0) + adminRevenue;
    }

    const allDatesInRange = [];
    const currentDate = new Date(startOfWeek);
    while (currentDate <= endOfWeek) {
      allDatesInRange.push(formatDayKey(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }

    const revenueData = allDatesInRange.map(date => ({
      date,
      admin: dailyRevenues.admin[date] || 0,
      partner: dailyRevenues.partner[date] || 0,
    }));

    res.render('Revenue/dailyRevenue', { revenueData });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error retrieving daily revenue", error });
  }
};


const getMonthlyRevenue = async (req, res) => {
  try {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    const monthlyRevenues = Array(6).fill(0);
    const adminRevenues = Array(6).fill(0);
    const partnerRevenues = Array(6).fill(0);

    for (let i = 0; i < 6; i++) {
      const month = currentMonth - i;
      const year = month < 0 ? currentYear - 1 : currentYear;
      const monthIndex = month < 0 ? 12 + month : month;

      const monthStart = new Date(year, monthIndex, 1);
      const monthEnd = endOfDay(new Date(year, monthIndex + 1, 0));
      const orders = await Order.find({
        status: "paid",
        createdAt: {
          $gte: monthStart,
          $lte: monthEnd,
        },
      });

      monthlyRevenues[i] = orders.reduce((acc, order) => acc + order.totalValue, 0);

      orders.forEach(order => {
        const adminShare = order.totalValue * 0.30;
        const partnerShare = order.totalValue * 0.70;

        adminRevenues[i] += adminShare;
        partnerRevenues[i] += partnerShare;
      });
    }

    const labels = [];
    for (let i = 0; i < 6; i++) {
      const month = currentMonth - i;
      const year = month < 0 ? currentYear - 1 : currentYear;
      const monthIndex = month < 0 ? 12 + month : month;
      labels.push(`${year}-${String(monthIndex + 1).padStart(2, '0')}`);
    }

    res.render('Revenue/monthlyRevenue', { 
      labels: labels.reverse(), 
      monthlyRevenues: monthlyRevenues.reverse(),
      adminRevenues: adminRevenues.reverse(),
      partnerRevenues: partnerRevenues.reverse()
    });
  } catch (error) {
    res.status(500).json({ message: "Error retrieving monthly revenue", error });
  }
};

const getYearlyRevenue = async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();
    const yearlyRevenues = {
      admin: {},
      partner: {}
    };

    for (let i = 0; i < 2; i++) {
      const year = currentYear - i;
      const orders = await Order.find({
        status: "paid",
        createdAt: {
          $gte: new Date(year, 0, 1), 
          $lt: new Date(year + 1, 0, 1), 
        },
      });

      orders.forEach(order => {
        const partnerRevenue = order.totalValue * 0.7;  
        const adminRevenue = order.totalValue * 0.3;

        yearlyRevenues.partner[year] = (yearlyRevenues.partner[year] || 0) + partnerRevenue;
        yearlyRevenues.admin[year] = (yearlyRevenues.admin[year] || 0) + adminRevenue;
      });
    }

    const labels = Object.keys(yearlyRevenues.partner);
    const partnerRevenues = Object.values(yearlyRevenues.partner);
    const adminRevenues = Object.values(yearlyRevenues.admin);

    res.render('Revenue/yearlyRevenue', { labels, partnerRevenues, adminRevenues });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error retrieving yearly revenue", error });
  }
};



const getWeeklyRevenueForAllPartners = async (req, res) => {
  try {
    const startOfWeek = startOfDay(new Date());
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const endOfWeek = endOfDay(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    const formattedStartOfWeek = formatDayKey(startOfWeek);
    const formattedEndOfWeek = formatDayKey(endOfWeek);

    const orders = await Order.find({
      status: "paid",
      createdAt: { $gte: startOfWeek, $lte: endOfWeek },
    }).populate({
      path: 'tour',
      select: 'partner title', 
      populate: {
        path: 'partner',
        select: 'name'
      }
    });

    const partnerRevenues = {};

    orders.forEach(order => {
      const tour = order.tour;
      if (!tour || !tour.partner) return;

      const partnerId = tour.partner._id;
      const partnerName = tour.partner.name;
      const tourId = tour._id;
      const tourTitle = tour.title || "Chưa xác định"; 
      if (!partnerRevenues[partnerId]) {
        partnerRevenues[partnerId] = {
          name: partnerName,
          tours: {},
          adminRevenue: 0,
          partnerRevenue: 0,
        };
      }
      if (!partnerRevenues[partnerId].tours[tourId]) {
        partnerRevenues[partnerId].tours[tourId] = { 
          title: tourTitle, 
          sales: 0, 
          orders: 0 
        };
      }

      const totalRevenue = order.totalValue; 
      const adminShare = totalRevenue * 0.30; 
      const partnerShare = totalRevenue * 0.70; 

      partnerRevenues[partnerId].adminRevenue += adminShare;
      partnerRevenues[partnerId].partnerRevenue += partnerShare;

      partnerRevenues[partnerId].tours[tourId].sales += totalRevenue;
      partnerRevenues[partnerId].tours[tourId].orders += 1;
    });

    const groupedRevenues = Object.entries(partnerRevenues).map(([partnerId, partnerData]) => {
      return {
        partnerId,
        partnerName: partnerData.name,
        adminRevenue: partnerData.adminRevenue,
        partnerRevenue: partnerData.partnerRevenue,
        tours: Object.entries(partnerData.tours).map(([tourId, data]) => ({
          tourId,
          title: data.title,
          sales: data.sales,
          orders: data.orders,
        }))
      };
    });

    res.render('Revenue/allTourRevenueByPartner', { 
      groupedRevenues, 
      formattedStartOfWeek, 
      formattedEndOfWeek 
    });

  } catch (error) {
    console.error("Error retrieving weekly revenue for all partners:", error);
    res.status(500).json({ message: "Error retrieving weekly revenue for all partners", error });
  }
};

const getMonthlyRevenueForEachPartner = async (req, res) => {
  try {
    const today = new Date();
    const currentMonth = today.getMonth(); // Lấy tháng hiện tại (0-11)
    const currentYear = today.getFullYear(); // Lấy năm hiện tại

    // Lấy tất cả các đơn hàng "paid" trong tháng
    const orders = await Order.find({
      status: "paid",
      createdAt: {
        $gte: new Date(currentYear, currentMonth, 1), // Ngày đầu tháng
        $lt: new Date(currentYear, currentMonth + 1, 1), // Ngày đầu tháng kế tiếp
      },
    }).populate({
      path: "tour",
      select: "partner",
      populate: {
        path: "partner",
        select: "name email",
      },
    });

    // Lấy danh sách các đối tác đã được thanh toán trong tháng
    const paidPartners = await Transaction.find({
      date: {
        $gte: new Date(currentYear, currentMonth, 1),
        $lt: new Date(currentYear, currentMonth + 1, 1),
      },
    });

    // Nhóm doanh thu theo partner
    const partnerRevenues = {};

    for (const order of orders) {
      const partner = order.tour?.partner; // Đảm bảo `partner` tồn tại
      if (!partner || paidPartners.some(trx => trx.partner.toString() === partner._id.toString())) continue;

      const partnerId = partner._id.toString();
      const partnerEmail = partner.email;
      const totalRevenue = order.totalValue;
      const adminShare = totalRevenue * 0.3;
      const partnerShare = totalRevenue * 0.7;

      if (!partnerRevenues[partnerId]) {
        partnerRevenues[partnerId] = {
          name: partner.name,
          email: partnerEmail,
          totalSales: 0,
          adminRevenue: 0,
          partnerRevenue: 0,
          status: "pending", // Mặc định trạng thái là 'pending'
        };
      }

      // Cộng dồn doanh thu cho partner
      partnerRevenues[partnerId].totalSales += totalRevenue;
      partnerRevenues[partnerId].adminRevenue += adminShare;
      partnerRevenues[partnerId].partnerRevenue += partnerShare;

      // Kiểm tra nếu đã có giao dịch thành công
      const partnerTransaction = paidPartners.find(trx => trx.partner.toString() === partnerId);
      if (partnerTransaction && partnerTransaction.status === "success") {
        partnerRevenues[partnerId].status = "success";
      }
    }

    // Chuyển đối tượng thành mảng để dễ hiển thị
    const groupedRevenues = Object.entries(partnerRevenues).map(([partnerId, partnerData]) => ({
      partnerId,
      partnerName: partnerData.name,
      partnerEmail: partnerData.email,
      totalSales: partnerData.totalSales,
      adminRevenue: partnerData.adminRevenue,
      partnerRevenue: partnerData.partnerRevenue,
      status: partnerData.status,
    }));

    // Render ra view EJS với dữ liệu cần thiết
    res.render("Revenue/monthlyRevenueForEachPartner", {
      groupedRevenues,
      month: `${currentMonth + 1}-${currentYear}`, // Tháng hiển thị (dạng 1-based)
    });
  } catch (error) {
    console.error("Error calculating monthly revenue for each partner:", error);
    res.status(500).send("Error calculating revenue");
  }
};


const processMonthlyPayments = async (req, res) => {
  await recordAudit(req, 'payout.blocked', {
    type: 'Partner',
    id: req.body?.partneremail || '',
  }, { reason: 'payout-disabled' });
  return res.status(403).json({ message: 'Đối soát đang tạm khóa' });
};

const getTotalRevenueForAllPartners = async (req, res) => {
  try {
    const today = new Date();
    const formattedToday = today.toLocaleDateString('vi-VN');
    
    const orders = await Order.find({
      status: "paid",
      createdAt: { $lte: today }
    }).populate({
      path: 'tour',
      select: 'partner',
      populate: {
        path: 'partner',
        select: 'name'
      }
    });

    const partnerRevenues = {};

    orders.forEach(order => {
      const partnerId = order.tour.partner._id;
      const partnerName = order.tour.partner.name;

      if (!partnerRevenues[partnerId]) {
        partnerRevenues[partnerId] = { name: partnerName, totalSales: 0, adminRevenue: 0, partnerRevenue: 0 };
      }

      const totalRevenue = order.totalValue;
      const adminShare = totalRevenue * 0.30; // 30% cho admin
      const partnerShare = totalRevenue * 0.70; // 70% cho partner

      partnerRevenues[partnerId].totalSales += totalRevenue;
      partnerRevenues[partnerId].adminRevenue += adminShare;
      partnerRevenues[partnerId].partnerRevenue += partnerShare;
    });

    const groupedRevenues = Object.entries(partnerRevenues).map(([partnerId, partnerData]) => ({
      partnerId,
      partnerName: partnerData.name,
      totalSales: partnerData.totalSales,
      adminRevenue: partnerData.adminRevenue,
      partnerRevenue: partnerData.partnerRevenue
    }));

    res.render('Revenue/allTourRevenueByPartnerTotal', { 
      groupedRevenues, 
      formattedToday 
    });

  } catch (error) {
    console.error("Error retrieving total revenue for all partners:", error);
    res.status(500).json({ message: "Error retrieving total revenue for all partners", error });
  }
};

module.exports = {
  getDailyRevenue,
  getMonthlyRevenue,
  getYearlyRevenue,
  getWeeklyRevenueForAllPartners,
  getMonthlyRevenueForEachPartner,
  getTotalRevenueForAllPartners,
  processMonthlyPayments
};
