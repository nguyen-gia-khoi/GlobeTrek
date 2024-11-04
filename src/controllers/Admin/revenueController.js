const Revenue = require("../../models/Revenue");
const Order = require("../../models/Order"); // Import model Order

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


// Lấy doanh thu của từng đối tác cho từng tour
const getRevenueByTourAndPartner = async (req, res) => {
  try {
    const { tourId, partnerId } = req.params;

    const revenue = await Revenue.findOne({ "tourRevenue.tourId": tourId, "tourRevenue.partnerId": partnerId });

    if (!revenue) {
      return res.status(404).json({ message: "No revenue data found for this tour and partner." });
    }

    const tourRevenueData = revenue.tourRevenue.find(
      (entry) => entry.tourId.toString() === tourId && entry.partnerId.toString() === partnerId
    );

    // Render file EJS và truyền dữ liệu
    res.render('Revenue/revenueByTourAndPartner', { tourRevenueData });
  } catch (error) {
    res.status(500).json({ message: "Error retrieving revenue by tour and partner", error });
  }
};

// Lấy doanh thu của tất cả các tour thuộc một partner
const getAllTourRevenueByPartner = async (req, res) => {
  try {
    const { partnerId } = req.params; // Lấy partnerId từ URL params

    // Lấy tất cả các đơn hàng với trạng thái là "paid"
    const orders = await Order.find({ status: "paid" }).populate("tour");

    // Lọc doanh thu cho từng tour của partner
    const tourRevenues = orders
      .filter(order => order.tour.partnerId.toString() === partnerId)
      .map(order => ({
        tourId: order.tour._id,
        sales: order.totalValue, // Giả sử totalValue là tổng doanh thu của đơn hàng
        orders: 1, // Mỗi đơn hàng tính là một order
      }));

    // Nếu có nhiều đơn hàng cho cùng một tour, bạn có thể nhóm lại
    const groupedRevenues = tourRevenues.reduce((acc, curr) => {
      const existing = acc.find(item => item.tourId.toString() === curr.tourId.toString());
      if (existing) {
        existing.sales += curr.sales; // Cộng dồn doanh thu
        existing.orders += curr.orders; // Cộng dồn số đơn hàng
      } else {
        acc.push(curr);
      }
      return acc;
    }, []);

    if (groupedRevenues.length === 0) {
      return res.status(404).json({ message: "No revenue data found for this partner." });
    }

    // Render file EJS và truyền dữ liệu
    res.render('Revenue/allTourRevenueByPartner', { partnerId, groupedRevenues });
  } catch (error) {
    res.status(500).json({ message: "Error retrieving revenue by partner", error });
  }
};

module.exports = {
  getDailyRevenue,
  getMonthlyRevenue,
  getYearlyRevenue,
  getRevenueByTourAndPartner,
  getAllTourRevenueByPartner
};
