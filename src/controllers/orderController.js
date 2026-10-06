const mongoose = require('mongoose');
const moment = require('moment-timezone'); // Import moment-timezone
const axios = require('axios');
const Order = require('../models/Order');
const User = require('../models/User');
const { Tour } = require('../models/Tour');
const { sendOrderConfirmationEmail } = require('../service/mailtrap/email');
const { Pointer } = require("pointer-wallet");
const { paypalClient } = require('../config/payment');
const paypal = require('@paypal/checkout-server-sdk');
const redis = require('../config/redis');
const {
  runWithOptionalTransaction,
  resolveDeparture,
  reserveSeats,
  undoReservation,
  confirmHeldOrder,
  releaseHeldOrder,
  releaseSoldOrder,
} = require('../service/departureService');
const {
  quoteOrder,
  reservePromotionUse,
  releasePromotionUse,
} = require('../service/promotionService');

const secretKey = process.env.VITE_POINTER_SECRET_KEY;
const pointerPayment = new Pointer(secretKey);

const HOLD_MINUTES = Math.max(1, Number(process.env.ORDER_HOLD_MINUTES) || 15);
const HOLD_DURATION_MS = HOLD_MINUTES * 60 * 1000;

// Hoàn trả lại số lượng chỗ trống khi đơn hàng bị hủy hoặc quá 15 phút không thanh toán
const releaseHeldSeats = async (orderId, reason = 'canceled') => {
  try {
    const order = await releaseHeldOrder(orderId);
    if (!order) return null;
    await redis.del(`order:hold:${orderId}`);
    console.log(`[Order Hold] Đã nhả chỗ đơn ${orderId} (Lý do: ${reason})`);
    return order;
  } catch (error) {
    console.error(`[Order Lock Error] Lỗi khi nhả chỗ đơn ${orderId}:`, error);
    throw error;
  }
};

const createOrder = async (req, res) => {
  try {
    const {
      customerInfo,
      passengerInfo,
      tour,
      adultPrice,
      childPrice,
      adultCount,
      childCount,
      bookingDate,
      departureId,
      paymentMethod,
    } = req.body;

    if (!tour) {
      return res.status(400).json({ message: "Tour is required" });
    }

    if ((adultCount || 0) <= 0 && (childCount || 0) <= 0) {
      return res.status(400).json({ message: "At least one ticket must be purchased" });
    }

    const totalSeatsRequested = (Number(adultCount) || 0) + (Number(childCount) || 0);
    const tourDoc = await Tour.findById(tour);
    const departure = await resolveDeparture({
      tourId: tour,
      departureId,
      bookingDate,
      requireOpen: true,
    });
    if (!departure) {
      return res.status(400).json({ message: 'Không tìm thấy lịch khởi hành đang mở bán cho ngày đã chọn' });
    }

    const quote = await quoteOrder({
      tour: tourDoc,
      departure,
      adultCount,
      childCount,
      adultPrice,
      childPrice,
      code: req.body.code,
      userId: req.user._id,
    });

    const holdExpiresAt = new Date(Date.now() + HOLD_DURATION_MS);
    let savedOrder;
    await runWithOptionalTransaction(async (session) => {
      const reserved = await reserveSeats(departure._id, totalSeatsRequested, session);
      if (!reserved) {
        throw new Error('Không đủ chỗ trống hoặc lịch đã đóng bán');
      }

      let usageReserved = false;
      try {
        if (quote.promotion) {
          await reservePromotionUse(quote.promotion.id, req.user._id, session);
          usageReserved = true;
        }
        const newOrder = new Order({
          orderDate: moment().tz('Asia/Ho_Chi_Minh').toDate(),
          totalValue: quote.totalValue,
          originalTotal: quote.originalTotal,
          discountAmount: quote.discountAmount,
          promotion: quote.promotion?.id || undefined,
          user: req.user._id,
          customerInfo,
          passengerInfo,
          tour,
          departure: departure._id,
          adultPrice: quote.adultPrice,
          childPrice: quote.childPrice,
          adultCount,
          childCount,
          bookingDate: departure.departureDate,
          holdExpiresAt,
          status: 'pending',
          seatState: 'held',
          paymentMethod,
        });
        savedOrder = await newOrder.save(session ? { session } : {});
        await User.updateOne(
          { _id: req.user._id },
          { $addToSet: { orderHistory: savedOrder._id } },
          session ? { session } : {}
        );
      } catch (error) {
        if (!session) {
          await undoReservation(departure._id, totalSeatsRequested);
          if (usageReserved) await releasePromotionUse(quote.promotion.id);
        }
        throw error;
      }
    });

    try {
      await redis.set(
        `order:hold:${savedOrder._id}`,
        JSON.stringify({
          orderId: savedOrder._id,
          tourId: tour,
          departureId: departure._id,
          bookingDate: departure.departureDate,
          adultCount,
          childCount,
          holdExpiresAt
        }),
        'EX',
        HOLD_MINUTES * 60
      );
    } catch (redisErr) {
      console.error("Redis set hold key error:", redisErr.message);
    }

    setTimeout(async () => {
      try {
        const currentOrder = await Order.findById(savedOrder._id);
        if (currentOrder && (currentOrder.status === 'pending' || currentOrder.status === 'processing')) {
          await releaseHeldSeats(savedOrder._id, `Quá ${HOLD_MINUTES} phút chưa thanh toán`);
        }
      } catch (timerErr) {
        console.error(`Error in auto-release timer for order ${savedOrder._id}:`, timerErr);
      }
    }, HOLD_DURATION_MS);

    res.status(201).json({
      message: `Order created successfully. Seats are held for ${HOLD_MINUTES} minutes.`,
      order: savedOrder,
      quote,
      holdExpiresAt: savedOrder.holdExpiresAt
    });
  } catch (error) {
    console.log("Error in createOrder controller:", error.message);
    res.status(error.status || 500).json({ message: error.message || 'Error creating order', error: error.message });
  }
};


// Lấy danh sách đơn hàng của người dùng (tối ưu hóa các trường dữ liệu cần thiết)
const getUserOrders = async (req, res) => {
  try {
    const userId = req.user._id;

    const user = await User.findById(userId).populate({
      path: 'orderHistory',
      select: '_id bookingDate createdAt orderDate tour adultCount childCount totalValue status paymentMethod holdExpiresAt',
      populate: {
        path: 'tour',
        select: '_id title name description images location duration price'
      }
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const orders = (user.orderHistory || []).filter(Boolean);

    // Sắp xếp đơn hàng mới nhất lên đầu
    orders.sort((a, b) => new Date(b.createdAt || b.bookingDate || 0) - new Date(a.createdAt || a.bookingDate || 0));

    const groupedOrders = orders.reduce((result, order) => {
      const date = order.bookingDate ? new Date(order.bookingDate) : new Date(order.createdAt || Date.now());
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
    res.status(500).json({ message: 'Error fetching orders', error: error.message });
  }
};

// Lấy chi tiết 1 vé / đơn hàng theo orderId
const getOrderDetail = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user._id;

    const order = await Order.findById(orderId)
      .populate('tour')
      .populate('user', 'name email phone phoneNumber address');

    if (!order) {
      return res.status(404).json({ message: 'Không tìm thấy thông tin vé/đơn hàng này' });
    }

    // Bảo mật: Kiểm tra xem đơn hàng có thuộc về user đang đăng nhập không (hoặc role admin)
    const isOwner = order.user && (order.user._id ? order.user._id.toString() : order.user.toString()) === userId.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Bạn không có quyền xem chi tiết vé này' });
    }

    return res.status(200).json(order);
  } catch (error) {
    console.error('Error fetching order detail:', error);
    return res.status(500).json({ message: 'Lỗi máy chủ khi lấy chi tiết vé', error: error.message });
  }
};

// Xử lý thanh toán
const processPayment = async (req, res) => {
  try {
    console.log(req.body);
    const { orderID, status } = req.body;

    const order = await Order.findById(orderID).populate('user');
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    if (String(order.user?._id || order.user) !== String(req.user._id) && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Bạn không có quyền thanh toán đơn này' });
    }

    if (status === 200) {
      const paidOrder = await confirmHeldOrder(order._id);

      // Xóa khóa tạm trong Redis khi thanh toán thành công
      await redis.del(`order:hold:${order._id}`);

      // Gửi email xác nhận
      const tour = await Tour.findById(order.tour);
      const email = order.user?.email || order.customerInfo?.email;

      if (email) {
        const emailContent = {
          orderId: order._id,
          totalValue: order.totalValue.toLocaleString(),
          bookingDate: order.bookingDate,
          tour: tour,
          status: paidOrder.status,
        };

        try {
          await sendOrderConfirmationEmail(email, emailContent);
          console.log("Email confirmation sent to:", email);
        } catch (emailError) {
          console.error("Error sending email:", emailError.message);
        }
      }

      res.status(200).json({ message: 'Payment successful', order: paidOrder });
    } else {
      // Hoàn lại số lượng chỗ trống và chuyển trạng thái canceled nếu thanh toán thất bại
      await releaseHeldSeats(order._id, 'Thanh toán thất bại');
      res.status(400).json({ message: 'Payment failed, seats released' });
    }
  } catch (error) {
    console.log("Error in processPayment", error.message);
    res.status(500).json({ message: 'Error processing payment', error });
  }
};

const cancelOrder = async (req, res) => {
  try {
    const { orderId } = req.body;
    console.log("Received orderID:", orderId);

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    if (String(order.user) !== String(req.user._id) && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Bạn không có quyền hủy đơn này' });
    }

    if (order.status === 'canceled') {
      return res.status(400).json({ message: 'Order has already been canceled' });
    }

    if (order.status === 'paid') {
      return res.status(400).json({ message: 'Paid orders cannot be canceled directly via this method' });
    }

    const pointerSecretKey = process.env.VITE_POINTER_SECRET_KEY;
    if (!pointerSecretKey) {
      return res.status(500).json({ message: 'Pointer Wallet secret key is missing' });
    }
    const headers = {
      'Authorization': `Bearer ${pointerSecretKey}`,
      'Content-Type': 'application/json',
    };

    try {
      const cancelResponse = await axios.post('https://api.pointer.io.vn/api/payment/cancel-order', {
        orderID: orderId
      }, { headers });
      console.log('Pointer Wallet cancel response:', cancelResponse.data);
    } catch (pointerErr) {
      console.warn('Pointer Wallet cancel request warning:', pointerErr.message);
    }

    // Nhả lại chỗ và cập nhật trạng thái đơn hàng sang canceled
    await releaseHeldSeats(order._id, 'Người dùng hủy đơn');
    await User.findByIdAndUpdate(order.user, { $inc: { cancellationCount: 1 } }, { new: true });

    return res.status(200).json({ message: 'Order canceled successfully', order });
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
    if (String(order.user) !== String(req.user._id) && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Bạn không có quyền hoàn tiền đơn này' });
    }

    const refundResponse = await pointerPayment.refundMoney(orderID);

    // Kiểm tra phản hồi từ refund API
    if (refundResponse && refundResponse.status === 200) {
      console.log("Refund successful:", refundResponse.data);
      const canceledOrder = await releaseSoldOrder(order._id);
      return res.status(200).json({
        message: "Refund successful",
        data: refundResponse.data,
        order: canceledOrder,
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
    const { orderID, status } = req.body;
    if (!orderID) return res.status(400).json({ message: 'Order not found' });

    const order = await Order.findById(orderID);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    if (order.status === 'canceled') {
      return res.status(200).json({ message: 'Đơn hàng đã được hủy trước đó' });
    }
    if (order.status !== 'paid') {
      return res.status(400).json({ message: "Only paid orders can be canceled with this function" });
    }

    if (Number(status) === 200) {
      const canceledOrder = await releaseSoldOrder(order._id);
      return res.status(200).json({ message: 'Paid order canceled successfully', orderId: canceledOrder?._id || order._id });
    }
    return res.status(400).json({ message: 'Failed to refund money' });
  } catch (error) {
    console.error("Error in cancelPaidOrder:", error.message);
    res.status(500).json({ message: 'Error canceling paid order' });
  }
};

const connectWallet = async (req, res) => {
  try {
    const userId = req.user._id;
    console.log(userId);
    const partnerId = process.env.PARTNERID;
    const returnUrl = process.env.VITE_REDIRECT_URL;

    const redirectUrl = `https://wallet.pointer.io.vn/connect-app?partnerId=${partnerId}&returnUrl=${encodeURIComponent(returnUrl)}&userId=${userId}`;
    res.json({ redirectUrl });
  } catch (error) {
    console.error("Error in connectWallet:", error.message);
    res.status(500).json({ message: 'Error connectWallet', error: error.message });
  }
};

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
      userId: updatedUser._id,
    });
  } catch (error) {
    console.error('Error handling webhook:', error);
    res.status(500).json({ message: 'Internal server error', error });
  }
};


const createPaypalPayment = async (req, res) => {
  try {
    const { orderID, returnUrl, cancelUrl } = req.body;
    const order = await Order.findById(orderID);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    if (String(order.user) !== String(req.user._id) && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Bạn không có quyền thanh toán đơn này' });
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
        return_url: returnUrl,
        cancel_url: cancelUrl || `${process.env.VITE_REDIRECT_URL || ''}/payment/${orderID}`,
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

const capturePaypalPayment = async (req, res) => {
  try {
    const { orderID, paypalOrderId } = req.body;

    const order = await Order.findById(orderID);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    if (String(order.user) !== String(req.user._id) && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Bạn không có quyền thanh toán đơn này' });
    }

    const request = new paypal.orders.OrdersCaptureRequest(paypalOrderId);
    const response = await paypalClient.execute(request);

    console.log('PayPal Capture Response:', response.result);

    if (response.result.status === "COMPLETED") {
      order.paymentDetails = {
        transactionId: response.result.id,
        provider: 'paypal',
        status: 'completed',
        captureId: response.result.purchase_units[0].payments.captures[0].id,
      };
      await order.save();
      const paidOrder = await confirmHeldOrder(order._id);

      // Xóa khóa tạm trong Redis khi thanh toán thành công
      await redis.del(`order:hold:${order._id}`);

      // Gửi email xác nhận
      const tour = await Tour.findById(order.tour);
      const email = order.user?.email || order.customerInfo?.email;
      if (email) {
        const emailContent = {
          orderId: order._id,
          totalValue: order.totalValue.toLocaleString(),
          bookingDate: order.bookingDate,
          tour: tour,
          status: paidOrder.status,
        };

        try {
          await sendOrderConfirmationEmail(email, emailContent);
        } catch (emailError) {
          console.error("Error sending email:", emailError.message);
        }
      }

      return res.json({
        success: true,
        message: "Payment completed successfully",
        order: paidOrder,
      });
    } else {
      await releaseHeldSeats(order._id, 'PayPal capture không hoàn tất');
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

// Background Sweeper: quét và nhả chỗ các đơn quá hạn giữ chỗ
const cleanupExpiredOrders = async () => {
  try {
    const now = new Date();
    const expiredOrders = await Order.find({
      status: { $in: ['pending', 'processing'] },
      holdExpiresAt: { $lt: now }
    });

    if (expiredOrders.length > 0) {
      console.log(`[Sweeper] Phát hiện ${expiredOrders.length} đơn hàng quá hạn giữ chỗ. Tiến hành nhả vé và hủy đơn...`);
      for (const expOrder of expiredOrders) {
        await releaseHeldSeats(expOrder._id, `Hết hạn ${HOLD_MINUTES} phút giữ chỗ (Background Sweeper)`);
      }
    }
  } catch (err) {
    console.error('[Sweeper Error] Lỗi khi quét đơn hàng hết hạn:', err.message);
  }
};

// Khởi chạy sweeper định kỳ mỗi 2 phút
setInterval(cleanupExpiredOrders, 2 * 60 * 1000);
// Chạy ngay một lần khi server khởi động
cleanupExpiredOrders();

module.exports = {
  createOrder,
  getUserOrders,
  getOrderDetail,
  processPayment,
  cancelOrder,
  Refund,
  weekhookRefund,
  connectWallet,
  handelEvent,
  createPaypalPayment,
  capturePaypalPayment,
  releaseHeldSeats,
  cleanupExpiredOrders,
};
