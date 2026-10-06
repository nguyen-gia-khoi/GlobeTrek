const mongoose = require('mongoose');
const { Schema } = mongoose;
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { type } = require('os');


const UserSchema = new Schema({
  name: {
    type: String,
    trim: true,
    maxlength: [50, "Tên không được vượt quá 50 ký tự"],
  },
  email: {
    type: String,
    required: [true, "Email is required"],
    unique: true,
    trim: true,
    maxlength: [50, "Email không được vượt quá 50 ký tự"],
  },
  password: {
    type: String,
    // required: [true, "Password is required"],
  },
  phoneNumber: {
    type: String,
    trim: true,
    maxlength: [20, "Số điện thoại không được vượt quá 20 ký tự"],
  },
  phone: {
    type: String,
    trim: true,
    maxlength: [20, "Số điện thoại không được vượt quá 20 ký tự"],
  },
  address: {
    type: String,
    trim: true,
    maxlength: [255, "Địa chỉ không được vượt quá 255 ký tự"],
  },
  gender: {
    type: String,
    enum: ["male", "female", "non-binary", "other", "Male", "Female", "Other"],
    default: "Male",
  },
  dob: {
    type: Date,
    validate: {
      validator: function (value) {
        return !value || value < new Date();
      },
      message: "Date of birth must be in the past.",
    },
  },
  dateOfBirth: {
    type: Date,
    validate: {
      validator: function (value) {
        return !value || value < new Date();
      },
      message: "Date of birth must be in the past.",
    },
  },
  role: {
    type: String,
    enum: ["user", "admin","partner"],
    default: "user",
  },
  UserStatus: {
    type: String,
    enum: ["ban","unban"],
    default: "unban"
  },
  status :{
    type: String,
    enum: ["verified","unverify"],
    default: "unverify"
  },
  orderHistory: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
    },
  ],
  cancellationCount: {
    type: Number,
    default: 0,
  },
  signature:{
    type : String
  },
},
{ timestamps: true }
);

UserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    return next();
  }
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

UserSchema.methods.comparePassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};
const User = mongoose.model('User', UserSchema);
module.exports = User;