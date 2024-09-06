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
  video: String,
  image: String,
  description: String,
  state: String
});

const TourDetail = mongoose.model('TourDetail', TourDetailSchema);
module.exports = TourDetail;