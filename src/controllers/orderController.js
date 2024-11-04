const mongoose = require('mongoose');
const Order = require('../models/Order');
const User = require('../models/User');
const { Tour } = require('../models/Tour');
const { sendOrderConfirmationEmail } = require('../service/mailtrap/email');

// Tạo đơn hàng
const createOrder = async (req, res) => {
  try {
    const {
      totalValue,
      customerInfo,
      passengerInfo,
      tour, // ID của Tour
      adultPrice,
      childPrice,
      adultCount,
      childCount,
      bookingDate,
      paymentMethod,
    } = req.body;

    if (!tour) {
      return res.status(400).json({ message: "Tour is required" });
    }
    if (adultCount <= 0 && childCount <= 0) {
      return res.status(400).json({ message: "At least one ticket must be purchased" });
    }

    // Tạo đơn hàng mới
    const newOrder = new Order({
      orderDate: new Date(),
      totalValue,
      user: req.user._id,
      customerInfo,
      passengerInfo,
      tour,
      adultPrice,
      childPrice,
      adultCount,
      childCount,
      bookingDate,
      status: 'pending',
      paymentMethod,
    });

    const savedOrder = await newOrder.save();

    // Cập nhật lịch sử đơn hàng của người dùng
    await User.updateOne(
      { _id: req.user._id },
      { $push: { orderHistory: savedOrder._id } }
    );

    await Tour.updateOne(
      { _id: tour }, // Điều kiện tìm kiếm theo ID
      { $inc: { availableSpots: -(adultCount + childCount) } } // Giảm số lượng availableSpots
    );

    // Chuyển trạng thái sau 1 phút, nếu chưa thanh toán sẽ tự động hủy sau 10 phút
    setTimeout(async () => {
      const orderToProcess = await Order.findById(savedOrder._id);
      if (orderToProcess && orderToProcess.status === 'pending') {
        orderToProcess.status = 'processing';
        await orderToProcess.save();
        console.log(`Order ${savedOrder._id} updated to 'processing'.`);

        setTimeout(async () => {
          const orderToCancel = await Order.findById(savedOrder._id);
          if (orderToCancel && orderToCancel.status === 'processing') {
            orderToCancel.status = 'canceled';
            await orderToCancel.save();
            console.log(`Order ${savedOrder._id} was automatically canceled.`);
          }
        }, 10 * 60 * 1000); // 10 phút
      }
    }, 1 * 15 * 1000); // 1 phút

    res.status(201).json({ message: 'Order created successfully', order: savedOrder });
  } catch (error) {
    console.log("Error in createOrder controller", error.message);
    res.status(500).json({ message: 'Error creating order', error: error.message });
  }
};

// Lấy các đơn hàng của người dùng
const getUserOrders = async (req, res) => {
  try {
    const userId = req.user._id;

    const user = await User.findById(userId).populate({
      path: 'orderHistory',
      populate: { path: 'tour' } // Populate Tour trong mỗi đơn hàng
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const orders = user.orderHistory;

    const groupedOrders = orders.reduce((result, order) => {
      const date = new Date(order.bookingDate);
      const monthYear = `${date.getMonth() + 1}-${date.getFullYear()}`;

      if (!result[monthYear]) {
        result[monthYear] = [];
      }
      result[monthYear].push(order);

      return result;
    }, {});

    res.status(200).json(groupedOrders);
  } catch (error) {
    console.log("Error fetching orders", error.message);
    res.status(500).json({ message: 'Error fetching orders', error });
  }
};

// Xử lý thanh toán
const processPayment = async (req, res) => {
  try {
    const { orderID, status } = req.body;

    const order = await Order.findById(orderID).populate('user'); // Populate để lấy đầy đủ thông tin người dùng
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (status === 200) {
      order.status = 'paid';
      await order.save();
    
      // Gửi email xác nhận
      const tour = await Tour.findById(order.tour);
      const email = order.user.email ; // Lấy email từ đối tượng user đã populate
    
      const emailContent = {
        orderId: order._id,
        totalValue: order.totalValue.toLocaleString(),
        bookingDate: order.bookingDate,
        tour: tour,
        status: order.status,
      };
    
      try {
        await sendOrderConfirmationEmail(email, emailContent);
        console.log("Email confirmation sent to:", order.user.email);
      } catch (emailError) {
        console.error("Error sending email:", emailError.message);
      }
    
      res.status(200).json({ message: 'Payment successful', order });
    } else {
      res.status(400).json({ message: 'Payment failed' });
    }    
  } catch (error) {
    console.log("Error in processPayment", error.message);
    res.status(500).json({ message: 'Error processing payment', error });
  }
};


// Hủy đơn hàng
const cancelOrder = async (req, res) => {
  try {
    const { orderId } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.status !== 'pending') {
      return res.status(400).json({ message: "Only pending orders can be canceled" });
    }

    // Tăng lại số lượng availableSpots trong Tour
    await Tour.findByIdAndUpdate(order.tour, {
      $inc: { availableSpots: order.adultCount + order.childCount }
    });

    order.status = 'canceled';
    await order.save();
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
