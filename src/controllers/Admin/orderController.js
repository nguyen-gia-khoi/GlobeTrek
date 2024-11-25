const Order = require("../../models/Order");

const getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find()
      .populate("user", "email")  // Lấy email của người dùng
      .populate("tour", "title");  // Lấy tiêu đề của tour

    if (orders.length === 0) {
      return res.status(404).json({ message: "No orders found." });
    }

    const response = orders.map(order => ({
      orderId: order._id,
      user: {
        id: order.user ? order.user._id : "Unknown",
        email: order.user ? order.user.email : "Unknown",
      },
      tour: {
        id: order.tour._id,
        title: order.tour.title,
      },
      adultPrice: order.adultPrice,
      childPrice: order.childPrice,
      adultCount: order.adultCount,
      childCount: order.childCount,
      totalValue: order.totalValue,
      customerInfo: {
        fullName: order.customerInfo.fullName,
        phone: order.customerInfo.phone,
        email: order.customerInfo.email,
      },
      passengerInfo: order.passengerInfo,
      bookingDate: order.bookingDate,
      status: order.status,
      paymentMethod: order.paymentMethod,
      orderDate: order.orderDate,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    }));

    res.status(200).json({ orders: response });
  } catch (error) {
    console.log("Error in getAllOrders controller", error.message);
    res.status(500).json({ message: "Server Error!", error: error.message });
  }
};

// Cập nhật trạng thái đơn hàng
const updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    if (!["pending", "processing", "paid", "canceled"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    order.status = status;
    const savedOrder = await order.save();

    res.status(200).json({ message: "Order status updated successfully", order: savedOrder });
  } catch (error) {
    console.log("Error in updateOrderStatus controller", error.message);
    res.status(500).json({ message: "Server Error!", error: error.message });
  }
};

// Xóa đơn hàng
const deleteOrder = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findByIdAndDelete(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    res.status(200).json({ message: "Order deleted successfully" });
  } catch (error) {
    console.log("Error in deleteOrder controller", error.message);
    res.status(500).json({ message: "Server Error!", error: error.message });
  }
};

const renderOrdersPage = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const pageNumber = Math.max(1, parseInt(page));
    const pageLimit = Math.min(50, parseInt(limit));
    const skip = (pageNumber - 1) * pageLimit;

    // Lấy dữ liệu nhóm theo tour và ngày đặt
    const groupedOrders = await Order.aggregate([
      {
        $lookup: {
          from: "tours", // Liên kết với bảng tours
          localField: "tour",
          foreignField: "_id",
          as: "tourDetails",
        },
      },
      { $unwind: "$tourDetails" }, // Trích xuất chi tiết tour từ mảng

      {
        $lookup: {
          from: "users", // Liên kết với bảng users để lấy thông tin người dùng
          localField: "user",
          foreignField: "_id",
          as: "userDetails",
        },
      },
      { $unwind: "$userDetails" }, // Trích xuất chi tiết người dùng từ mảng

      {
        $group: {
          _id: { tour: "$tour", bookingDate: "$bookingDate" },
          totalPeople: {
            $sum: { $add: ["$adultCount", "$childCount"] },
          },
          totalTickets: { $sum: "$adultCount" },
          totalChildren: { $sum: "$childCount" },
          totalOrders: { $sum: 1 },
          orders: { $push: "$$ROOT" }, // Đẩy tất cả dữ liệu vào danh sách chi tiết
        },
      },
      {
        $sort: { "_id.bookingDate": -1 },
      },
      {
        $facet: {
          data: [{ $skip: skip }, { $limit: pageLimit }],
          totalCount: [{ $count: "count" }],
        },
      },
    ]);

    const ordersSummary = groupedOrders[0].data || [];
    const totalOrdersCount = groupedOrders[0].totalCount?.[0]?.count || 0;
    const totalPages = Math.ceil(totalOrdersCount / pageLimit);

    res.render("Order/orders", {
      token: req.cookies.AdminaccessToken || null,
      ordersSummary,
      totalPages,
      currentPage: pageNumber,
    });
  } catch (error) {
    console.error("Error in renderOrdersPage controller:", error.message);
    res.status(500).json({ message: "Server Error!", error: error.message });
  }
};

module.exports = {
  renderOrdersPage,
  getAllOrders,
  updateOrderStatus,
  deleteOrder,
};
