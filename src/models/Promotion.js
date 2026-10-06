const mongoose = require('mongoose');

const promotionSchema = new mongoose.Schema(
  {
    partner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    kind: {
      type: String,
      enum: ['code', 'automatic'],
      required: true,
    },
    code: {
      type: String,
      trim: true,
      uppercase: true,
      default: '',
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    discountType: {
      type: String,
      enum: ['percent', 'fixed'],
      required: true,
    },
    discountValue: {
      type: Number,
      required: true,
      min: 0,
    },
    tourIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tour',
    }],
    bookingStart: Date,
    bookingEnd: Date,
    departureStart: Date,
    departureEnd: Date,
    minSubtotal: {
      type: Number,
      default: 0,
      min: 0,
    },
    usageLimit: {
      type: Number,
      min: 1,
      default: null,
    },
    perUserLimit: {
      type: Number,
      min: 1,
      default: null,
    },
    usedCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ['active', 'paused', 'expired'],
      default: 'active',
    },
  },
  { timestamps: true }
);

promotionSchema.index(
  { partner: 1, code: 1 },
  { unique: true, partialFilterExpression: { kind: 'code' } }
);
promotionSchema.index({ partner: 1, kind: 1, status: 1 });

module.exports = mongoose.models.Promotion
  || mongoose.model('Promotion', promotionSchema);
