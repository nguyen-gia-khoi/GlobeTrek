const mongoose = require('mongoose')
//shape data
const TourTypeSchema = new mongoose.Schema({
  tourType: String
},{ timestamps: true });

const TourType = mongoose.model('TourType', TourTypeSchema)

module.exports = TourType; 