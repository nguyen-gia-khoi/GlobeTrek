const { addDays, isValid } = require('date-fns');

/**
 * Middleware: Tự động thêm ngày khả dụng dựa trên duration của tour
 * @param {Object} tour - Đối tượng Tour Schema
 * @param {number} availableSeats - Số ghế khả dụng
 * @param {number} daysToGenerate - Số ngày cần tự động tạo (mặc định là 30 ngày)
 */
const autoAvailability = async (tour, availableSeats, daysToGenerate = 30) => {
  if (!tour || !tour.duration || tour.duration <= 0) {
    throw new Error('Duration của tour không hợp lệ');
  }

  const today = new Date(); // Ngày hiện tại
  const availabilities = [];

  // Tạo lịch khả dụng cách nhau duration ngày
  for (let i = 0; i < daysToGenerate; i++) {
    const nextDate = addDays(today, i * tour.duration); // Mỗi ngày cách nhau duration
    availabilities.push({
      date: nextDate,
      availableSeats,
    });
  }

  // Gộp vào danh sách availabilities hiện tại
  tour.availabilities = [...tour.availabilities, ...availabilities];
  await tour.save(); // Lưu tour vào DB
  return tour;
};

/**
 * Middleware: Thêm lịch khả dụng tùy chỉnh
 * @param {Object} tour - Đối tượng Tour Schema
 * @param {Array<string|Date>} customDates - Danh sách ngày tùy chỉnh (dạng string hoặc Date)
 * @param {number} availableSeats - Số ghế khả dụng
 */
const customAvailability = async (tour, customDates, availableSeats) => {
  if (!Array.isArray(customDates) || customDates.length === 0) {
    throw new Error('Danh sách ngày tùy chỉnh không hợp lệ');
  }

  const customAvailabilities = [];

  // Lặp qua danh sách ngày tùy chỉnh
  for (const date of customDates) {
    const parsedDate = new Date(date); // Chuyển đổi sang Date
    if (!isValid(parsedDate)) {
      throw new Error(`Ngày không hợp lệ: ${date}`);
    }

    customAvailabilities.push({
      date: parsedDate,
      availableSeats,
    });
  }

  // Gộp vào danh sách customAvailabilities hiện tại
  tour.customAvailabilities = [...tour.customAvailabilities, ...customAvailabilities];
  await tour.save(); // Lưu tour vào DB
  return tour;
};

/**
 * Middleware: Tạo tour với cả tự động và tùy chỉnh lịch khả dụng
 * @param {Object} TourModel - Mongoose Model của Tour
 * @param {Object} tourData - Dữ liệu của tour mới
 * @param {number} availableSeats - Số ghế khả dụng
 * @param {Object} options - Tùy chọn (autoGenerate: boolean, customDates: Array<string|Date>)
 */
const createTourWithAvailability = async (TourModel, tourData, availableSeats, options = {}) => {
  const newTour = new TourModel(tourData);

  // Tự động tạo lịch khả dụng nếu được yêu cầu
  if (options.autoGenerate) {
    await autoAvailability(newTour, availableSeats);
  }

  // Thêm lịch tùy chỉnh nếu có customDates
  if (options.customDates && Array.isArray(options.customDates)) {
    await customAvailability(newTour, options.customDates, availableSeats);
  }

  return newTour.save();
};

module.exports = {
  autoAvailability,
  customAvailability,
  createTourWithAvailability,
};
