const mongoose = require('mongoose');
const { Schema } = mongoose;

const OrderSchema = new Schema({
  orderDate: {
    type: Date,
    default: Date.now, 
  },
  createdAt: {
    type: Date,
    default: Date.now, 
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
  departure: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TourDeparture',
    index: true,
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
  totalValue: { // Số tiền khách phải trả sau giảm giá
    type: Number,
    required: true,
    min: [0, 'Total value must be a positive number'],
  },
  originalTotal: {
    type: Number,
    min: [0, 'Original total must be a positive number'],
  },
  discountAmount: {
    type: Number,
    default: 0,
    min: [0, 'Discount amount must be a positive number'],
  },
  promotion: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Promotion',
  },
  customerInfo: { // Thông tin liên hệ
 
    fullName: { type: String, required: false },
    phone: { type: String, required: false },
    email: { type: String, required: false },

},
  passengerInfo: {
    type: {
      title: { type: String, enum: ['Ông', 'Bà', 'Cô'], required: false }, 
      fullName: { type: String, required: false },
      phone: { type: String, required: false },
      email: { type: String, required: false },
      specialRequest: { type: String, required: false } 
    },
    required: false 
  },
  
  bookingDate: { // Ngày mà người dùng đặt vé
    type: Date,
    required: true,
  },
  holdExpiresAt: { // Thời gian hết hạn giữ chỗ (15 phút)
    type: Date,
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'paid', 'canceled'],
    default: 'pending', // Trạng thái đơn hàng
  },
  paymentMethod: {
    type: String,
    enum: ['pointer-wallet', 'connected-wallet', 'paypal', 'stripe'],
    required: true,
  },
  paymentDetails: {
    transactionId: String,
    provider: String,
    status: String
  },
  seatState: {
    type: String,
    enum: ['held', 'sold', 'released'],
    default: 'held',
  },
}, { timestamps: true });

OrderSchema.index({ tour: 1, createdAt: -1 });
OrderSchema.index({ departure: 1, status: 1, createdAt: -1 });
OrderSchema.index({ status: 1, holdExpiresAt: 1 });
OrderSchema.index({ promotion: 1, user: 1, status: 1 });

const Order = mongoose.model('Order', OrderSchema);
module.exports = Order;
