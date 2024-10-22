const mongoose = require('mongoose');
const { Schema } = mongoose;

const OrderSchema = new Schema({
  orderDate: {
    type: Date,
    default: Date.now, // Ngày tạo đơn hàng
  },
  createdAt: {
    type: Date,
    default: Date.now, // Thời gian tạo đơn hàng
    expires: '1m' // Tự động hủy sau 15 phút
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  tour: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tour', // Tham chiếu đến mô hình Tour
    required: true,
  },
  adultPrice: { // Giá tour cho người lớn
    type: Number,
    required: true,
    min: [0, 'Adult price must be a positive number'],
  },
  childPrice: { // Giá tour cho trẻ em
    type: Number,
    required: true,
    min: [0, 'Child price must be a positive number'],
  },
  adultCount: { // Số lượng vé người lớn
    type: Number,
    required: true,
    min: [0, 'Adult count must be a positive number'],
  },
  childCount: { // Số lượng vé trẻ em
    type: Number,
    required: true,
    min: [0, 'Child count must be a positive number'],
  },
  totalValue: { // Tổng giá trị đơn hàng
    type: Number,
    required: true,
    min: [0, 'Total value must be a positive number'],
  },
  customerInfo: { // Thông tin liên hệ
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, required: true },
  },
  passengerInfo: { // Thông tin khách
    title: { type: String, enum: ['Ông', 'Bà', 'Cô'], required: true }, 
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, required: true },
    specialRequest: { type: String }, // Yêu cầu đặc biệt (nếu có)
  },
  bookingDate: { // Ngày mà người dùng đặt vé
    type: Date,
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'paid', 'cancelled'],
    default: 'pending', // Trạng thái đơn hàng
  },
  paymentMethod: {
    type: String,
    enum: ['pointer-wallet'],
    required: true,
  },
}, { timestamps: true }); // Tự động thêm các trường createdAt và updatedAt

const Order = mongoose.model('Order', OrderSchema);
module.exports = Order;
