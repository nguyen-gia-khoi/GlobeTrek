const mongoose = require('mongoose');
const { Schema } = mongoose;

const TourDetailSchema = new Schema({
  tourID: {
    type: Schema.Types.ObjectId,
    ref: 'Tour',
    required: true
  },
  tourDuration: Number,
  norPrice: Number,
  address: String,
  destination: {
    type: Schema.Types.ObjectId,
    ref: 'Destination',
    required: true
  },
  partner: {
    type: Schema.Types.ObjectId,
    ref: 'Partner',
    required: true
  },
  images: [String], // Array to store image paths
  videos: [String], // Array to store video paths
  description: String,
  state: Boolean
},{ timestamps: true });

const TourDetail = mongoose.model('TourDetail', TourDetailSchema);
module.exports = TourDetail;
