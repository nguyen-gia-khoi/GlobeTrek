const mongoose = require('mongoose');
const { Schema } = mongoose;

const OrderSchema = new Schema({
  orderDate: Date,
  totalValue: Number,
  customer: {
    type: Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  }
});

const Order = mongoose.model('Order', OrderSchema);
module.exports = Order;