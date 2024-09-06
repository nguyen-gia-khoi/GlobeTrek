// const mongoose = require('mongoose');
// const { Schema } = mongoose; // Import Schema from mongoose
// const TourType = require('./TourType');

// // Define the TourSchema
// const TourSchema = new Schema({
//   tourName: String,
//   thumbnail: String,
//   tourType: {
//     type: Schema.Types.ObjectId,
//     ref: 'TourType',
//     required: true
//   }
// });

// // Create the Tour model
// const Tour = mongoose.model('Tour', TourSchema); // Change 'TourType' to 'Tour'

// module.exports = Tour;
// const mongoose = require('mongoose');
// const Schema = mongoose.Schema;

// const TourSchema = new Schema({
//   tourname: {
//     type: String,
//     required: true,
//   },
//   tourtype: {  // Ensure this matches the field you're trying to populate
//     type: Schema.Types.ObjectId,
//     ref: 'TourType',
//     required: true,
//   }
// });

// const Tour = mongoose.model('Tour', TourSchema);
// module.exports = Tour;
const mongoose = require('mongoose');

const TourSchema = new mongoose.Schema({
  tourname: String,
  tourtype: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TourType'
  }
});

const Tour = mongoose.model('Tour', TourSchema);
module.exports = Tour;
