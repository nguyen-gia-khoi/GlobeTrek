const mongoose = require('mongoose');
const { Schema } = mongoose;

const OrderDetailSchema = new Schema({
  order: {
    type: Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  tourDetail: {
    type: Schema.Types.ObjectId,
    ref: 'TourDetail',
    required: true
  },
  ticketType: String,
  ticketAmount: Number,
  departureDay: Date,
  endDay: Date,
  points: Number
});

const OrderDetail = mongoose.model('OrderDetail', OrderDetailSchema);
module.exports = OrderDetail;