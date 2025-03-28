const mongoose = require('mongoose');
const moment = require('moment-timezone'); // Import moment-timezone
const Order = require('../models/Order');
const User = require('../models/User');
const { Tour } = require('../models/Tour');
const { sendOrderConfirmationEmail } = require('../service/mailtrap/email');
const { Pointer } = require("pointer-wallet");
const {  paypalClient } = require('../config/payment');
const paypal = require('@paypal/checkout-server-sdk');


const secretKey = process.env.VITE_POINTER_SECRET_KEY; 
const pointerPayment = new Pointer(secretKey);


const updateAvailabilityOnCreateOrder = async (tourId, bookingDate, adultCount, childCount) => {
  const tour = await Tour.findById(tourId);

  if (!tour) {
    throw new Error("Tour not found");
  }

  const bookingDateLocal = moment(bookingDate).tz('Asia/Ho_Chi_Minh').format('YYYY-MM-DD');
  const selectedAvailability = tour.availabilities.find(avail => {
    const availDateLocal = moment(avail.date).tz('Asia/Ho_Chi_Minh').format('YYYY-MM-DD');
    return availDateLocal === bookingDateLocal;
  });

  if (!selectedAvailability) {
    throw new Error("No availability found for the selected date");
  }

  const totalSeatsRequested = adultCount + childCount;
  if (selectedAvailability.availableSeats < totalSeatsRequested) {
    throw new Error("Not enough available spots for the selected date");
  }

  // Giảm số lượng chỗ trống cho ngày đã chọn
  selectedAvailability.availableSeats -= totalSeatsRequested;
  await tour.save();
};

const updateAvailabilityOnCancelOrder = async (tourId, bookingDate, adultCount, childCount) => {
  const tour = await Tour.findById(tourId);

  if (!tour) {
    throw new Error("Tour not found");
  }

  const availability = tour.availabilities.find(avail => 
    moment(avail.date).tz('Asia/Ho_Chi_Minh').format('YYYY-MM-DD') === moment(bookingDate).tz('Asia/Ho_Chi_Minh').format('YYYY-MM-DD')
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

    // Kiểm tra và cập nhật số lượng chỗ trống trong tour
    await updateAvailabilityOnCreateOrder(tour, bookingDate, adultCount, childCount);

    // Tạo đơn hàng mới
    const newOrder = new Order({
      orderDate: moment().tz('Asia/Ho_Chi_Minh').toDate(),
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

    // Cập nhật trạng thái đơn hàng sau 1 phút nếu chưa thanh toán
    setTimeout(async () => {
      const orderToProcess = await Order.findById(savedOrder._id);
      if (orderToProcess && orderToProcess.status === 'pending') {
        orderToProcess.status = 'processing';
        await orderToProcess.save();
        console.log(`Order ${savedOrder._id} updated to 'processing'.`);
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
    console.log(userId)
    const currentDate = new Date().toISOString().slice(0, 10); 

    const user = await User.findById(userId).populate({
      match: { bookingDate: { $gte: currentDate } }, 
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
    console.log(req.body)
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

const axios = require('axios');

const cancelOrder = async (req, res) => {
  try {
    const { orderId } = req.body; 
    console.log("Received orderID:", orderId);

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.status === 'canceled') {
      return res.status(400).json({ message: 'Order has already been canceled' });
    }

    if (order.status === 'paid') {
      return res.status(400).json({ message: 'Paid orders cannot be canceled' });
    }
    const pointerSecretKey = process.env.VITE_POINTER_SECRET_KEY;
    if (!pointerSecretKey) {
      return res.status(500).json({ message: 'Pointer Wallet secret key is missing' });
    }
    const headers = {
      'Authorization': `Bearer ${pointerSecretKey}`,
      'Content-Type': 'application/json',
    };
    // const orderID = orderId;
    //     // Gọi API Pointer Wallet để hủy đơn hàng, truyền orderID trong thân yêu cầu
    //     const cancelResponse = await pointerPayment.cancelOrder(
    //       { orderID }, 
    //       { headers }           
    //     );    
    const cancelResponse = await axios.post('https://api.pointer.io.vn/api/payment/cancel-order', {
      orderID: orderId
    }, { headers});

    console.log('Pointer Wallet cancel response:', cancelResponse.data);
    if (cancelResponse.status === 200 ) {
      await updateAvailabilityOnCancelOrder(order.tour, order.bookingDate, order.adultCount, order.childCount);
      await User.findByIdAndUpdate(order.user, { $inc: { cancellationCount: 1 } }, { new: true });
      order.status = 'canceled';
      await order.save();

      return res.status(200).json({ message: 'Order canceled successfully', order });
    } else {
      return res.status(400).json({ message: 'Failed to cancel order via Pointer Wallet', details: cancelResponse.data });
    }
  } catch (error) {
    console.error('Error in cancelOrder:', error); 
    res.status(500).json({ message: 'Error canceling order', error: error.message });
  }
};


const Refund = async (req, res) => {
  try {
    const { orderID } = req.body;

    if (!orderID) {
      return res.status(400).json({ message: "OrderID is required" });
    }
    const order = await Order.findById(orderID);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    const refundResponse = await pointerPayment.refundMoney(orderID);

    // Kiểm tra phản hồi từ refund API
    if (refundResponse && refundResponse.status === 200) {
      console.log("Refund successful:", refundResponse.data);
      return res.status(200).json({
        message: "Refund successful",
        data: refundResponse.data,
      });
    } else {
      console.error("Refund failed:", refundResponse);
      return res.status(400).json({
        message: "Refund failed",
        response: refundResponse,
      });
    }
  } catch (error) {
    console.error("Error in Refund:", error.message);
    res.status(500).json({ message: "Error processing refund", error: error.message });
  }
};


const weekhookRefund = async (req, res) => {
  try {
    const { orderID, status  } = req.body;

    const order = await Order.findById(orderID);
    console.log(orderID)
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    if (order.status !== 'paid') {
      return res.status(400).json({ message: "Only paid orders can be canceled with this function" });
    }

    // Cập nhật số lượng chỗ trống khi hủy tour
    await updateAvailabilityOnCancelOrder(order.tour, order.bookingDate, order.adultCount, order.childCount);

    if (status === 200) {
      order.status = 'canceled';
      await order.save();

      return res.status(200).json({ message: 'Paid order canceled successfully', order });
    } else {
      return res.status(400).json({ message: 'Failed to refund money', refundResponse });
    }
  } catch (error) {
    console.error("Error in cancelPaidOrder:", error.message);
    res.status(500).json({ message: 'Error canceling paid order', error: error.message });
  }
};

const connectWallet = async(req, res) =>{
  try {
    const userId = req.user._id;
    console.log(userId)
    const partnerId = process.env.PARTNERID;
    const returnUrl = process.env.VITE_REDIRECT_URL;

    const redirectUrl = `https://wallet.pointer.io.vn/connect-app?partnerId=${partnerId}&returnUrl=${encodeURIComponent(returnUrl)}&userId=${userId}`;
    res.json({ redirectUrl });
  } catch (error) {
    console.error("Error in cconnectWallet :", error.message);
    res.status(500).json({ message: 'Error connectWallet ', error: error.message });
  }
}

const handelEvent = async (req, res) => {
  try {
    const { userID, signature } = req.body;
    if (!userID || !signature) {
      return res.status(400).json({ message: 'Missing required fields: userID or signature' });
    }

    const updatedUser = await User.findByIdAndUpdate(
      userID,
      { signature },
      { new: true } 
    );

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(200).json({ 
      message: 'Signature saved successfully', 
      user: updatedUser 
    });
  } catch (error) {
    console.error('Error handling webhook:', error);
    res.status(500).json({ message: 'Internal server error', error });
  }
};


const createPaypalPayment = async (req, res) => {
  try {
    const { orderID, returnUrl, cancelUrl } = req.body; // Lấy returnUrl từ body
    const order = await Order.findById(orderID);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    const request = new paypal.orders.OrdersCreateRequest();
    request.prefer("return=representation");
    request.requestBody({
      intent: "CAPTURE",
      purchase_units: [{
        amount: {
          currency_code: "USD",
          value: (order.totalValue / 25000).toFixed(2),
        },
        description: `Payment for Tour Booking #${order._id}`,
        reference_id: order._id.toString(),
      }],
      application_context: {
        return_url: returnUrl, // Thêm returnUrl
        cancel_url: cancelUrl || `${VITE_REDIRECT_URL}/payment/${orderID}`, // Thêm cancelUrl nếu cần
      },
    });

    const response = await paypalClient.execute(request);
    const approvalLink = response.result.links.find(link => link.rel === 'approve');

    order.paymentDetails = {
      paypalOrderId: response.result.id,
      provider: 'paypal',
      status: 'pending',
    };
    await order.save();

    res.json({
      orderID: order._id,
      paypalOrderId: response.result.id,
      paypalUrl: approvalLink.href,
    });
  } catch (error) {
    console.error("PayPal create error:", error);
    res.status(500).json({ error: error.message });
  }
};
// Sửa lại hàm capturePaypalPayment
const capturePaypalPayment = async (req, res) => {
  try {
    const { orderID, paypalOrderId } = req.body;

    const order = await Order.findById(orderID);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    const request = new paypal.orders.OrdersCaptureRequest(paypalOrderId);
    const response = await paypalClient.execute(request);

    console.log('PayPal Capture Response:', response.result); // Log để kiểm tra

   
    if (response.result.status === "COMPLETED") {
      order.status = 'paid';
      order.paymentDetails = {
        transactionId: response.result.id,
        provider: 'paypal',
        status: 'completed',
        captureId: response.result.purchase_units[0].payments.captures[0].id,
      };
      await order.save();

      // Gửi email xác nhận
      const tour = await Tour.findById(order.tour);
      const emailContent = {
        orderId: order._id,
        totalValue: order.totalValue.toLocaleString(),
        bookingDate: order.bookingDate,
        tour: tour,
        status: order.status,
      };

      try {
        await sendOrderConfirmationEmail(order.user.email, emailContent);
      } catch (emailError) {
        console.error("Error sending email:", emailError.message);
      }

      return res.json({
        success: true,
        message: "Payment completed successfully",
        order: order,
      });
    } else {
      return res.status(400).json({
        message: "Payment not completed",
        status: response.result.status,
      });
    }
  } catch (error) {
    console.error("PayPal capture error:", error.message);
    return res.status(500).json({ error: error.message });
  }
};

// Add these to your exports
module.exports = {
  createOrder,
  getUserOrders,
  processPayment,
  cancelOrder,
  Refund,
  weekhookRefund,
  connectWallet,
  handelEvent,
  createPaypalPayment,
  capturePaypalPayment,
};
