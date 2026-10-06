require('dotenv').config();
const mongoose = require('mongoose');
const TourDeparture = require('../src/models/TourDeparture');
const Order = require('../src/models/Order');

const audit = async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  const usage = await Order.aggregate([
    { $match: { departure: { $exists: true, $ne: null } } },
    {
      $group: {
        _id: '$departure',
        heldSeats: {
          $sum: {
            $cond: [
              { $eq: ['$seatState', 'held'] },
              { $add: ['$adultCount', '$childCount'] },
              0,
            ],
          },
        },
        soldSeats: {
          $sum: {
            $cond: [
              { $eq: ['$seatState', 'sold'] },
              { $add: ['$adultCount', '$childCount'] },
              0,
            ],
          },
        },
      },
    },
  ]);
  const usageMap = new Map(usage.map((item) => [String(item._id), item]));
  const departures = await TourDeparture.find({}).select(
    'tour departureDate capacity heldSeats soldSeats'
  ).lean();

  const mismatches = departures.flatMap((departure) => {
    const expected = usageMap.get(String(departure._id)) || { heldSeats: 0, soldSeats: 0 };
    const invalidCapacity = departure.capacity < departure.heldSeats + departure.soldSeats;
    if (
      expected.heldSeats === departure.heldSeats
      && expected.soldSeats === departure.soldSeats
      && !invalidCapacity
    ) {
      return [];
    }
    return [{
      departureId: String(departure._id),
      tourId: String(departure.tour),
      departureDate: departure.departureDate,
      stored: { heldSeats: departure.heldSeats, soldSeats: departure.soldSeats },
      expected: { heldSeats: expected.heldSeats, soldSeats: expected.soldSeats },
      invalidCapacity,
    }];
  });

  console.log(JSON.stringify({
    departures: departures.length,
    mismatches: mismatches.length,
    details: mismatches,
  }, null, 2));
  await mongoose.disconnect();
  if (mismatches.length) process.exitCode = 1;
};

audit().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
