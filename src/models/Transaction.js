const mongoose = require('mongoose');
const { Schema } = mongoose;

const transactionSchema = new mongoose.Schema(
  {
    partner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", 
      required: true,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    adminAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    partnerAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ["success", "pending", "failed"],
      default: "pending",
    },
    description: {
      type: String,
      trim: true,
    },
    paymentMonth: {
      type: String, // Lưu tháng của giao dịch (VD: "11-2024")
      required: true,
    },
  },
  { timestamps: true }
);

// Middleware trước khi lưu để kiểm tra tính hợp lệ của giao dịch
transactionSchema.pre('save', function (next) {
  if (this.totalAmount !== this.adminAmount + this.partnerAmount) {
    return next(new Error('Total amount must equal admin amount + partner amount'));
  }
  next();
});

// Optional: Thêm index cho trường partner và paymentMonth để tăng tốc truy vấn
transactionSchema.index({ partner: 1, paymentMonth: 1 });

module.exports = mongoose.model('Transaction', transactionSchema);
