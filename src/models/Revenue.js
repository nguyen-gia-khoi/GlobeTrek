const mongoose = require("mongoose");

const revenueSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
    },
    totalSales: {
      type: Number,
      required: true,
    },
    totalOrders: {
      type: Number,
      required: true,
    },
    dailyRevenue: [
      {
        date: {
          type: Date,
          required: true,
        },
        sales: {
          type: Number,
          required: true,
        },
        orders: {
          type: Number,
          required: true,
        },
      },
    ],
    monthlyRevenue: [
      {
        month: {
          type: Number,
          required: true,
        },
        sales: {
          type: Number,
          required: true,
        },
        orders: {
          type: Number,
          required: true,
        },
      },
    ],
    yearlyRevenue: [
      {
        year: {
          type: Number,
          required: true,
        },
        sales: {
          type: Number,
          required: true,
        },
        orders: {
          type: Number,
          required: true,
        },
      },
    ],
    tourRevenue: [
      {
        tourId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Tour",
          required: true,
        },
        partnerId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        sales: {
          type: Number,
          required: true,
        },
        orders: {
          type: Number,
          required: true,
        },
        tripCount: {
          type: Number,
          required: true,
        },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Revenue", revenueSchema);
