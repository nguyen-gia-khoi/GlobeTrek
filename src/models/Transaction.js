const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema({
  partner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User", // Liên kết đến mô hình User (Partner)
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  date: {
    type: Date,
    default: Date.now,
  },
  status: {
    type: String,
    enum: ["success", "failed"],
    default: "success",
  },
});

module.exports = mongoose.model("Transaction", transactionSchema);
