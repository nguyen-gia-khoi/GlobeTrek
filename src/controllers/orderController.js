const mongoose = require('mongoose');
const Order = require('../models/Order');
const User = require('../models/User');
const { Tour } = require('../models/Tour');
const { sendOrderConfirmationEmail } = require('../service/mailtrap/email');

const updateAvailabilityOnCreateOrder = async (tourId, bookingDate, adultCount, childCount) => {
  const tour = await Tour.findById(tourId);

  if (!tour) {
    throw new Error("Tour not found");
  }
  const bookingDateISO = new Date(bookingDate).toISOString().slice(0, 10);
  const selectedAvailability = tour.availabilities.find(avail => {
    const availDateISO = new Date(avail.date).toISOString().slice(0, 10);
    return availDateISO === bookingDateISO; 
  });
  if (!selectedAvailability) {
    throw new Error("No availability found for the selected date");
  }
  const totalSeatsRequested = adultCount + childCount;
  if (selectedAvailability.availableSeats < totalSeatsRequested) {
    throw new Error("Not enough available spots for the selected date");
  }

  // giảm số lượng chỗ trống cho ngày đã chọn
  selectedAvailability.availableSeats -= totalSeatsRequested;
  await tour.save();
};

const updateAvailabilityOnCancelOrder = async (tourId, bookingDate, adultCount, childCount) => {
  const tour = await Tour.findById(tourId);

  if (!tour) {
    throw new Error("Tour not found");
  }

  const availability = tour.availabilities.find(avail => 
    new Date(avail.date).toLocaleDateString() === new Date(bookingDate).toLocaleDateString()
  );
  if (!availability) {
    throw new Error("No availability found for the selected date");
  }
  // Tăng số lượng chỗ trống khi hủy đơn hàng
  availability.availableSeats += adultCount + childCount;
  await tour.save();
};
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

    if (!tour) {
      return res.status(400).json({ message: "Tour is required" });
    }
    if (adultCount <= 0 && childCount <= 0) {
      return res.status(400).json({ message: "At least one ticket must be purchased" });
    }

    await updateAvailabilityOnCreateOrder(tour, bookingDate, adultCount, childCount);
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
            
            // Tăng lại số lượng chỗ trống trong Tour nếu đơn hàng bị hủy
            await updateAvailabilityOnCancelOrder(tour, orderToCancel.bookingDate, orderToCancel.adultCount, orderToCancel.childCount);

            console.log(`Order ${savedOrder._id} was automatically canceled.`);
          }
        }, 10 * 60 * 1000); // 10 phút
      }
    }, 1 * 60 * 1000); // 1 phút

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
      populate: { path: 'tour' }
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

    const order = await Order.findById(orderID).populate('user');
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (status === 200) {
      order.status = 'paid';
      await order.save();
    
      // Gửi email xác nhận
      const tour = await Tour.findById(order.tour);
      const email = order.user.email;
    
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
      // Hoàn lại số lượng chỗ trống nếu thanh toán thất bại
      await Tour.updateOne(
        { _id: order.tour },
        { $inc: { availableSpots: order.adultCount + order.childCount } }
      );

      res.status(400).json({ message: 'Payment failed' });
    }
  } catch (error) {
    console.log("Error in processPayment", error.message);
    res.status(500).json({ message: 'Error processing payment', error });
  }
};

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

    // Cập nhật lại số lượng chỗ trống trong Tour khi hủy đơn hàng
    await updateAvailabilityOnCancelOrder(order.tour, order.bookingDate, order.adultCount, order.childCount);

    // Cập nhật trạng thái đơn hàng thành "canceled"
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
