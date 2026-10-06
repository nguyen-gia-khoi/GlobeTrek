const mongoose = require('mongoose');

const tourDepartureSchema = new mongoose.Schema(
  {
    tour: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tour',
      required: true,
      index: true,
    },
    departureDate: {
      type: Date,
      required: true,
    },
    capacity: {
      type: Number,
      required: true,
      min: 1,
    },
    heldSeats: {
      type: Number,
      default: 0,
      min: 0,
    },
    soldSeats: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ['open', 'closed', 'canceled', 'departed'],
      default: 'open',
    },
    note: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },
  },
  { timestamps: true }
);

tourDepartureSchema.index({ tour: 1, departureDate: 1 }, { unique: true });
tourDepartureSchema.index({ tour: 1, departureDate: 1, status: 1 });
tourDepartureSchema.index({ departureDate: 1, status: 1 });

tourDepartureSchema.virtual('availableSeats').get(function getAvailableSeats() {
  return Math.max(0, this.capacity - this.heldSeats - this.soldSeats);
});

tourDepartureSchema.set('toJSON', { virtuals: true });
tourDepartureSchema.set('toObject', { virtuals: true });

module.exports = mongoose.models.TourDeparture
  || mongoose.model('TourDeparture', tourDepartureSchema);
