const mongoose = require('mongoose')
//shape data
const DestinationSchema = new mongoose.Schema({
  Destination:String,

},{ timestamps: true });

const Destination = mongoose.model('Destination', DestinationSchema)

module.exports= Destination;