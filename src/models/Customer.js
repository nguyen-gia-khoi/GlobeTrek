const mongoose = require('mongoose');
const { Schema } = mongoose;

const CustomerSchema = new Schema({
  cusEmail: String,
  cusPhone: String,
  gender: String,
  dateOfBirth: Date,
  cusFavTour: String,
  password: String
});

const Customer = mongoose.model('Customer', CustomerSchema);
module.exports = Customer;