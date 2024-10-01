const mongoose = require('mongoose');
const { Schema } = mongoose;

const OrderSchema = new Schema({
  orderDate: Date,
  totalValue: Number,
  customer: {
    type: Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  tours: [
    {
      tour: { type: mongoose.Schema.Types.ObjectId, ref: "Tours" },
      quantity: { type: Number, required: true },
    },
  ],
  totalAmount: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    enum: ["pending", "processing", "payed", "cancel"],
    default: "pending",
  },
  paymentMethod: {
    type: String,
    enum: ["pointer-wallet"],
    required: true,
  },
});

const Order = mongoose.model('Order', OrderSchema);
module.exports = Order;