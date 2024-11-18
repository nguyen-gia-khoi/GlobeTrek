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
  status: {
    type: String,
    enum: ['pending', 'processing', 'paid', 'canceled'],
    default: 'pending', // Trạng thái đơn hàng
  },
  paymentMethod: {
    type: String,
    enum: ['pointer-wallet'],
    required: true,
  },
}, { timestamps: true }); 

const Order = mongoose.model('Order', OrderSchema);
module.exports = Order;
