require('dotenv').config();
const mongoose = require('mongoose');
const moment = require('moment-timezone');
const { Tour } = require('../src/models/Tour');
const Order = require('../src/models/Order');
const TourDeparture = require('../src/models/TourDeparture');

const VN_TZ = 'Asia/Ho_Chi_Minh';

const dayStart = (value) => moment.tz(value, VN_TZ).startOf('day').toDate();
const dayEnd = (value) => moment.tz(value, VN_TZ).endOf('day').toDate();

const migrate = async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  const tours = await Tour.collection.find({}, { projection: { availabilities: 1 } }).toArray();
  let upserted = 0;
  let linkedOrders = 0;

  for (const tour of tours) {
    const slotsByDay = new Map();
    for (const slot of tour.availabilities || []) {
      if (!slot.date) continue;
      const key = moment(slot.date).tz(VN_TZ).format('YYYY-MM-DD');
      const existing = slotsByDay.get(key);
      const availableSeats = Math.max(0, Number(slot.availableSeats) || 0);
      slotsByDay.set(key, {
        date: dayStart(slot.date),
        availableSeats: existing
          ? Math.max(existing.availableSeats, availableSeats)
          : availableSeats,
      });
    }

    const orderDays = await Order.aggregate([
      { $match: { tour: tour._id } },
      {
        $group: {
          _id: {
            $dateToString: {
              date: '$bookingDate',
              format: '%Y-%m-%d',
              timezone: VN_TZ,
            },
          },
          heldSeats: {
            $sum: {
              $cond: [
                { $in: ['$status', ['pending', 'processing']] },
                { $add: ['$adultCount', '$childCount'] },
                0,
              ],
            },
          },
          soldSeats: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'paid'] },
                { $add: ['$adultCount', '$childCount'] },
                0,
              ],
            },
          },
        },
      },
    ]);

    for (const usage of orderDays) {
      if (!slotsByDay.has(usage._id)) {
        slotsByDay.set(usage._id, {
          date: dayStart(`${usage._id}T00:00:00+07:00`),
          availableSeats: 0,
        });
      }
    }

    for (const [day, slot] of slotsByDay) {
      const usage = orderDays.find((item) => item._id === day) || {
        heldSeats: 0,
        soldSeats: 0,
      };
      const usedSeats = usage.heldSeats + usage.soldSeats;
      const departure = await TourDeparture.findOneAndUpdate(
        { tour: tour._id, departureDate: slot.date },
        {
          $setOnInsert: {
            tour: tour._id,
            departureDate: slot.date,
            capacity: Math.max(1, slot.availableSeats + usedSeats),
            heldSeats: usage.heldSeats,
            soldSeats: usage.soldSeats,
            status: 'open',
          },
        },
        { upsert: true, new: true }
      );
      upserted += 1;

      const result = await Order.updateMany(
        {
          tour: tour._id,
          bookingDate: { $gte: dayStart(slot.date), $lte: dayEnd(slot.date) },
          departure: { $exists: false },
        },
        [
          {
            $set: {
              departure: departure._id,
              seatState: {
                $switch: {
                  branches: [
                    { case: { $eq: ['$status', 'paid'] }, then: 'sold' },
                    {
                      case: { $in: ['$status', ['pending', 'processing']] },
                      then: 'held',
                    },
                  ],
                  default: 'released',
                },
              },
            },
          },
        ]
      );
      linkedOrders += result.modifiedCount || result.nModified || 0;
    }
  }

  const unsetResult = await Tour.collection.updateMany(
    { availabilities: { $exists: true } },
    { $unset: { availabilities: '' } }
  );

  console.log(JSON.stringify({
    departuresProcessed: upserted,
    linkedOrders,
    toursCleared: unsetResult.modifiedCount || unsetResult.nModified || 0,
  }, null, 2));
  await mongoose.disconnect();
};

migrate().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
