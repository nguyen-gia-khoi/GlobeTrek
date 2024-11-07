const mongoose = require('mongoose');
const { Schema } = mongoose;
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { type } = require('os');


const UserSchema = new Schema({
  name: {
    type: String,
  },
  email: {
    type: String,
    required: [true, "Email is required"],
    unique: true,
    trim: true,
  },
  password: {
    type: String,
    // required: [true, "Password is required"],
  },
  phoneNumber: {
    type: String,
  },
  gender: {
    type: String,
    enum: ["male", "female", "non-binary", "other"],
  },
  dateOfBirth: {
    type: Date,
    validate: {
      validator: function (value) {
        // Ensure the date is in the past
        return value < new Date();
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
  resetPasswordTOken: String,
  resetPasswordExpireAt: Date,
  verificationToken: String,
  verificationTokenExpireAt: Date 
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