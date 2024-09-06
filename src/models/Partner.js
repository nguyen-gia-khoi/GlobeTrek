const mongoose = require('mongoose')
//shape data
const PartnerSchema = new mongoose.Schema({
  partnername:String,
  partnernumber:String
})

const Partner = mongoose.model('Partner', PartnerSchema)

module.exports= Partner;