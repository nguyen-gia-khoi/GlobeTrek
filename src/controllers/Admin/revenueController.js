const mongoose = require("mongoose");
const {Revenue} = require("../../models/Revenue");
const Order = require("../../models/Order"); 
const {Tour} = require("../../models/Tour"); 
const Transaction = require("../../models/Transaction"); 

// Lấy doanh thu hàng ngày cho admin trong một tuần
const getDailyRevenue = async (req, res) => {
  try {
    const today = new Date();

    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay()); 

    const endOfWeek = new Date(today);
    endOfWeek.setDate(today.getDate() + (6 - today.getDay())); 

    const orders = await Order.find({
      status: "paid",
      createdAt: { $gte: startOfWeek, $lte: endOfWeek },
    });

    const dailyRevenues = {
      admin: {},
      partner: {}
    };

    for (let order of orders) {
      const orderDate = new Date(order.createdAt).toLocaleDateString(); 

      const partnerRevenue = order.totalValue * 0.7;  
      const adminRevenue = order.totalValue * 0.3;  

      dailyRevenues.partner[orderDate] = (dailyRevenues.partner[orderDate] || 0) + partnerRevenue;
      dailyRevenues.admin[orderDate] = (dailyRevenues.admin[orderDate] || 0) + adminRevenue;
    }
    const allDatesInRange = [];
    let currentDate = startOfWeek;
    while (currentDate <= endOfWeek) {
      allDatesInRange.push(currentDate.toLocaleDateString());
      currentDate.setDate(currentDate.getDate() + 1);
    }

    allDatesInRange.forEach(date => {
      if (!dailyRevenues.partner[date]) {
        dailyRevenues.partner[date] = 0;
        dailyRevenues.admin[date] = 0;
      }
    });

    const revenueData = allDatesInRange.map(date => ({
      date,
      admin: dailyRevenues.admin[date],
      partner: dailyRevenues.partner[date],
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

      const orders = await Order.find({
        status: "paid",
        createdAt: {
          $gte: new Date(year, monthIndex, 1),
          $lte: new Date(year, monthIndex + 1, 0),
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
    const today = new Date();
    const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay())); 
    const endOfWeek = new Date(today.setDate(today.getDate() + 6 - today.getDay())); 

    const formattedStartOfWeek = startOfWeek.toLocaleDateString('vi-VN');
    const formattedEndOfWeek = endOfWeek.toLocaleDateString('vi-VN');

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
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    const orders = await Order.find({
      status: "paid",
      createdAt: {
        $gte: new Date(currentYear, currentMonth, 1),
        $lte: new Date(currentYear, currentMonth + 1, 0)
      }
    }).populate({
      path: 'tour',
      select: 'partner',
      populate: {
        path: 'partner',
        select: 'name'
      }
    });

    const partnerRevenues = {};

    for (const order of orders) {
      const partnerId = order.tour.partner._id;
      const totalRevenue = order.totalValue;
      const adminShare = totalRevenue * 0.30;
      const partnerShare = totalRevenue * 0.70;

      if (!partnerRevenues[partnerId]) {
        partnerRevenues[partnerId] = { name: order.tour.partner.name, totalSales: 0, adminRevenue: 0, partnerRevenue: 0 };
      }

      partnerRevenues[partnerId].totalSales += totalRevenue;
      partnerRevenues[partnerId].adminRevenue += adminShare;
      partnerRevenues[partnerId].partnerRevenue += partnerShare;
    }

    const groupedRevenues = Object.entries(partnerRevenues).map(([partnerId, partnerData]) => ({
      partnerId,
      partnerName: partnerData.name,
      totalSales: partnerData.totalSales,
      adminRevenue: partnerData.adminRevenue,
      partnerRevenue: partnerData.partnerRevenue
    }));

    res.render('Revenue/monthlyRevenueForEachPartner', {
      groupedRevenues,
      month: `${currentMonth + 1}-${currentYear}`
    });
  } catch (error) {
    console.error("Error retrieving monthly revenue for each partner:", error);
    res.status(500).json({ message: "Error retrieving monthly revenue for each partner", error });
  }
};

// Hàm POST để chuyển tiền và cập nhật trạng thái
const processMonthlyPayments = async (req, res) => {
  try {
    const { transactionId, partnerAmount } = req.body;

    if (!transactionId || !partnerAmount) {
      return res.status(400).json({ message: "Missing required data" });
    }

    // Tìm giao dịch cần thanh toán
    const transaction = await Transaction.findById(transactionId);

    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    if (transaction.status === "success") {
      return res.status(400).json({ message: "Transaction already completed" });
    }

    // Giả sử xử lý thanh toán thành công qua ví điện tử
    const paymentSuccess = true; // Thay bằng API xử lý thực tế của ví điện tử

    if (paymentSuccess) {
      // Cập nhật trạng thái giao dịch
      transaction.status = "success";
      transaction.paidAt = new Date();
      await transaction.save();

      // Cập nhật trạng thái của các đơn hàng liên quan
      await Order.updateMany(
        { 'tour.partner': transaction.partner, status: 'paid' },
        { $set: { status: 'completed' } }
      );

      return res.status(200).json({ message: "Payment processed successfully" });
    } else {
      return res.status(500).json({ message: "Payment failed" });
    }
  } catch (error) {
    console.error("Error processing payment:", error);
    res.status(500).json({ message: "Error processing payment", error });
  }
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
