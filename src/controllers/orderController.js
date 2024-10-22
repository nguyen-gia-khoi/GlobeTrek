const mongoose = require('mongoose');
const Order = require('../models/Order'); // Import model Order
const User = require('../models/User'); // Import model User

// Hàm tạo đơn hàng
const createOrder = async (req, res) => {
  try {
    const {
      totalValue,
      customerInfo,
      passengerInfo, 
      tour,
      adultPrice,
      childPrice,
      adultCount,
      childCount,
      bookingDate,
      paymentMethod,
    } = req.body;

    // Kiểm tra thông tin đơn hàng
    if (!tour) {
      return res.status(400).json({ message: "Tour is required" });
    }
    if (adultCount <= 0 && childCount <= 0) {
      return res.status(400).json({ message: "At least one ticket must be purchased" });
    }

    // Tạo một đối tượng Order mới
    const newOrder = new Order({
      orderDate: new Date(), // Đặt ngày đặt hàng là thời gian hiện tại
      totalValue: totalValue, // Tổng giá trị đơn hàng
      user: req.user._id,
      customerInfo: customerInfo, 
      passengerInfo: passengerInfo, 
      tour: tour, 
      adultPrice: adultPrice,
      childPrice: childPrice, 
      adultCount: adultCount, 
      childCount: childCount, 
      bookingDate: bookingDate, 
      status: 'pending', 
      paymentMethod: paymentMethod, 
    });

    // Lưu đơn hàng mới vào cơ sở dữ liệu
    const savedOrder = await newOrder.save();

    // Cập nhật lịch sử đơn hàng của người dùng
    await User.updateOne(
      { _id: req.user._id },
      { $push: { orderHistory: savedOrder._id } }
    );

    // Tự động hủy đơn hàng sau 15 phút nếu vẫn trong trạng thái 'pending'
    setTimeout(async () => {
      const orderToCancel = await Order.findById(savedOrder._id);
      if (orderToCancel && orderToCancel.status === 'pending') {
        orderToCancel.status = 'canceled';
        await orderToCancel.save();
        console.log(`Order ${savedOrder._id} has been automatically canceled.`);
      }
    }, 15 * 60 * 1000); // 15 phút

    // Phản hồi thành công
    res.status(201).json({ message: 'Order created successfully', order: savedOrder });
  } catch (error) {
    // Phản hồi lỗi
    console.log("Error in createOrder controller", error.message);
    res.status(500).json({ message: 'Error creating order', error: error.message });
  }
};

// Hàm lấy danh sách đơn hàng của người dùng
const getUserOrders = async (req, res) => {
  try {
    const userId = req.user._id;

    // Tìm tất cả đơn hàng của người dùng
    const orders = await Order.find({ user: userId }).populate('tour');

    // Trả về danh sách đơn hàng
    res.status(200).json(orders);
  } catch (error) {
    console.log("Error fetching orders", error.message);
    res.status(500).json({ message: 'Error fetching orders', error });
  }
};

// Hàm xử lý thanh toán
const processPayment = async (req, res) => {
  try {
    const { orderId } = req.body; // Chỉ cần orderId

    // Tìm đơn hàng
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Giả lập quy trình thanh toán
    const paymentSuccessful = true; // Thay đổi điều này thành kết quả từ API thanh toán

    if (paymentSuccessful) {
      // Cập nhật trạng thái đơn hàng thành 'paid'
      order.status = 'paid';
      await order.save();

      // Phản hồi thành công
      res.status(200).json({ message: 'Payment successful', order });
    } else {
      res.status(400).json({ message: 'Payment failed' });
    }
  } catch (error) {
    console.log("Error in processPayment", error.message);
    res.status(500).json({ message: 'Error processing payment', error });
  }
};

// Hàm hủy đơn hàng
const cancelOrder = async (req, res) => {
  try {
    const { orderId } = req.body;

    // Tìm đơn hàng
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Kiểm tra trạng thái của đơn hàng
    if (order.status !== 'pending') {
      return res.status(400).json({ message: "Only pending orders can be canceled" });
    }

    // Cập nhật trạng thái đơn hàng thành 'canceled'
    order.status = 'canceled';
    await order.save();

    // Phản hồi thành công
    res.status(200).json({ message: 'Order canceled successfully', order });
  } catch (error) {
    console.log("Error in cancelOrder", error.message);
    res.status(500).json({ message: 'Error canceling order', error });
  }
};

module.exports = {
  createOrder,
  getUserOrders,
  processPayment,
  cancelOrder,
};
