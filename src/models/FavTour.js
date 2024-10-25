const mongoose = require("mongoose");

const FavoriteTourSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId, // hoặc String tùy thuộc vào cách bạn lưu user
    ref: 'User',
    required: true,
  },
  tour: {
    type: mongoose.Schema.Types.ObjectId, // hoặc String tùy thuộc vào cách bạn lưu tour
    ref: 'Tour',
    required: true,
  },
}, { timestamps: true });

const FavoriteTour = mongoose.model("FavoriteTour", FavoriteTourSchema);
module.exports = FavoriteTour;
