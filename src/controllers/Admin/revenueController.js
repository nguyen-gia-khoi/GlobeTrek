const mongoose = require("mongoose");
const {Revenue} = require("../../models/Revenue");
const Order = require("../../models/Order"); 
const {Tour} = require("../../models/Tour"); 

// Lấy doanh thu hàng ngày cho admin trong một tuần
const getDailyRevenue = async (req, res) => {
  try {
    const today = new Date();
    const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay())); 
    const endOfWeek = new Date(today.setDate(today.getDate() + 6 - today.getDay())); 
    const orders = await Order.find({
      status: "paid",
      createdAt: { $gte: startOfWeek, $lte: endOfWeek },
    });

    const dailyRevenues = {};
    for (let order of orders) {
      const orderDate = new Date(order.createdAt).toDateString(); 
      dailyRevenues[orderDate] = (dailyRevenues[orderDate] || 0) + order.totalValue; 
    }
    const revenueData = Object.entries(dailyRevenues).map(([date, total]) => ({
      date,
      total,
    }));
    res.render('Revenue/dailyRevenue', { revenueData });
  } catch (error) {
    res.status(500).json({ message: "Error retrieving daily revenue", error });
  }
};

const getMonthlyRevenue = async (req, res) => {
  try {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    // Tạo mảng để lưu doanh thu theo tháng
    const monthlyRevenues = Array(6).fill(0); // Khởi tạo mảng 6 tháng với giá trị 0

    // Lặp qua 6 tháng gần nhất
    for (let i = 0; i < 6; i++) {
      const month = currentMonth - i; // Tính tháng hiện tại - i
      const year = month < 0 ? currentYear - 1 : currentYear; // Điều chỉnh năm nếu tháng < 0
      const monthIndex = month < 0 ? 12 + month : month; // Điều chỉnh chỉ số tháng

      // Lấy doanh thu từ các đơn hàng đã thanh toán trong tháng hiện tại
      const orders = await Order.find({
        status: "paid",
        createdAt: {
          $gte: new Date(year, monthIndex, 1), // Bắt đầu từ ngày 1 của tháng
          $lte: new Date(year, monthIndex + 1, 0), 
        },
      });

      // Tính tổng doanh thu cho tháng
      monthlyRevenues[i] = orders.reduce((acc, order) => acc + order.totalValue, 0);
    }

    // Tạo danh sách tháng để hiển thị
    const labels = [];
    for (let i = 0; i < 6; i++) {
      const month = currentMonth - i;
      const year = month < 0 ? currentYear - 1 : currentYear;
      const monthIndex = month < 0 ? 12 + month : month;
      labels.push(`${year}-${String(monthIndex + 1).padStart(2, '0')}`); 
    }
    res.render('Revenue/monthlyRevenue', { labels: labels.reverse(), monthlyRevenues: monthlyRevenues.reverse() });
  } catch (error) {
    res.status(500).json({ message: "Error retrieving monthly revenue", error });
  }
};


// Lấy doanh thu hàng năm cho admin
const getYearlyRevenue = async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();

    const yearlyRevenues = {};

    for (let i = 0; i < 2; i++) {
      const year = currentYear - i; 

      const orders = await Order.find({
        status: "paid",
        createdAt: {
          $gte: new Date(year, 0, 1), // Bắt đầu từ ngày 1 tháng 1
          $lte: new Date(year + 1, 0, 0), // Kết thúc vào ngày 31 tháng 12
        },
      });

      yearlyRevenues[year] = orders.reduce((acc, order) => acc + order.totalValue, 0);
    }
    const labels = Object.keys(yearlyRevenues); 
    const revenues = Object.values(yearlyRevenues); 
    res.render('Revenue/yearlyRevenue', { labels, revenues });
  } catch (error) {
    res.status(500).json({ message: "Error retrieving yearly revenue", error });
  }
};
const getWeeklyRevenueForAllPartners = async (req, res) => {
  try {
    const today = new Date();
    const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay()));
    const endOfWeek = new Date(today.setDate(today.getDate() + 6 - today.getDay()));

    // Định dạng ngày theo kiểu dễ đọc (ví dụ: DD/MM/YYYY)
    const formattedStartOfWeek = startOfWeek.toLocaleDateString('vi-VN');
    const formattedEndOfWeek = endOfWeek.toLocaleDateString('vi-VN');

    const orders = await Order.find({
      status: "paid",
      createdAt: { $gte: startOfWeek, $lte: endOfWeek },
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
      const tourId = order.tour._id;

      if (!partnerRevenues[partnerId]) {
        partnerRevenues[partnerId] = {
          name: partnerName,
          tours: {}
        };
      }

      if (!partnerRevenues[partnerId].tours[tourId]) {
        partnerRevenues[partnerId].tours[tourId] = { sales: 0, orders: 0 };
      }

      partnerRevenues[partnerId].tours[tourId].sales += order.totalValue;
      partnerRevenues[partnerId].tours[tourId].orders += 1;
    });

    const groupedRevenues = Object.entries(partnerRevenues).map(([partnerId, partnerData]) => {
      return {
        partnerId,
        partnerName: partnerData.name,
        tours: Object.entries(partnerData.tours).map(([tourId, data]) => ({
          tourId,
          sales: data.sales,
          orders: data.orders
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

const getTotalRevenueForAllPartners = async (req, res) => {
  try {
    const today = new Date();
    const formattedToday = today.toLocaleDateString('vi-VN');
    
    // Lấy tất cả các đơn hàng có trạng thái "paid"
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

    // Tính doanh thu cho từng partner
    orders.forEach(order => {
      const partnerId = order.tour.partner._id;
      const partnerName = order.tour.partner.name;

      if (!partnerRevenues[partnerId]) {
        partnerRevenues[partnerId] = { name: partnerName, totalSales: 0 };
      }

      partnerRevenues[partnerId].totalSales += order.totalValue;
    });

    const groupedRevenues = Object.entries(partnerRevenues).map(([partnerId, partnerData]) => ({
      partnerId,
      partnerName: partnerData.name,
      totalSales: partnerData.totalSales
    }));

    console.log(groupedRevenues);  // Kiểm tra dữ liệu

    // Render trang tổng doanh thu
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
  getTotalRevenueForAllPartners,
};
