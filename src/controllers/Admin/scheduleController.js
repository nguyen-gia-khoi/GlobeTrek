const { Tour } = require('../../models/Tour'); // Import mô hình Tour

// Lấy tất cả lịch trình của một tour và render trang EJS
const getSchedules = async (req, res) => {
  const { tourId } = req.params;
  console.log('Requested tour ID:', tourId);
  try {
    const tour = await Tour.findById(tourId).populate('schedules');
    if (!tour) {
      return res.status(404).render('error', { message: 'Tour not found' });
    }

    res.render('schedules/list', { schedules: tour.schedules, tourId }); // Render file EJS và truyền dữ liệu lịch trình
  } catch (error) {
    res.status(500).render('error', { message: error.message });
  }
};

// Hiển thị trang tạo lịch trình mới
const renderNewSchedulePage = (req, res) => {
  const { tourId } = req.params;
  res.render('Schedules/create', { tourId }); // Render trang tạo lịch trình mới
};

// Tạo lịch trình mới cho một tour (API)
const createScheduleApi = async (req, res) => {
  const { tourId } = req.params; // Lấy ID của tour từ params
  const { startDate, endDate, isActive, itinerary } = req.body;

  try {
    const tour = await Tour.findById(tourId);
    if (!tour) {
      return res.status(404).json({ message: 'Tour not found' });
    }

    const newSchedule = {
      startDate,
      endDate,
      isActive: isActive === 'on', // Convert checkbox to boolean
      itinerary,
    };

    tour.schedules.push(newSchedule); // Thêm lịch trình vào tour
    await tour.save(); // Lưu tour với lịch trình mới

    return res.redirect(`/schedules/tours/${tourId}/schedules`); // Redirect to the schedules list
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
const renderEditSchedulePage = async (req, res) => {
    try {
        const { scheduleId, tourId } = req.params;

        // Find the tour first and then get the schedule
        const tour = await Tour.findById(tourId);
        if (!tour) {
            return res.status(404).send('Tour not found'); // Tour not found
        }

        const schedule = tour.schedules.id(scheduleId); // Get the specific schedule by ID

        if (!schedule) {
            return res.status(404).send('Schedule not found'); // Schedule not found
        }

        res.render('Schedules/edit', { schedule, tourId }); // Render the edit page
    } catch (error) {
        console.error("Error in renderEditSchedulePage:", error.message); // Log error
        res.status(500).send('Internal Server Error'); // Send error response
    }
};

// Update Schedule API
const updateScheduleApi = async (req, res) => {
    try {
        const { scheduleId, tourId } = req.params; // Get tourId from params as well
        const { startDate, endDate, isActive, itinerary } = req.body;

        // Find the tour first
        const tour = await Tour.findById(tourId);
        if (!tour) {
            return res.status(404).send('Tour not found');
        }

        // Find the specific schedule
        const schedule = tour.schedules.id(scheduleId);
        if (!schedule) {
            return res.status(404).send('Schedule not found');
        }

        // Update the schedule fields
        schedule.startDate = startDate;
        schedule.endDate = endDate;
        schedule.isActive = isActive === 'on'; // Convert checkbox to boolean
        schedule.itinerary = itinerary; // Update the itinerary

        await tour.save(); // Save the updated tour

        // Redirect to the updated schedules list
        res.redirect(`/schedules/tours/${tourId}/schedules`);
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error'); // Handle server error
    }
};

// Delete Schedule API
const deleteScheduleApi = async (req, res) => {
    const { tourId, scheduleId } = req.params;
  
    try {
      const tour = await Tour.findById(tourId);
      if (!tour) {
        return res.status(404).json({ message: 'Tour not found' });
      }
  
      const schedule = tour.schedules.id(scheduleId);
      if (!schedule) {
        return res.status(404).json({ message: 'Schedule not found' });
      }
  
      schedule.remove(); // Remove the schedule from the schedules array
      await tour.save(); // Save the tour after removing the schedule
  
      // Redirect to the schedules list
      return res.redirect(`/schedules/tours/${tourId}/schedules`);
    } catch (error) {
      console.error(error); // Log the error for debugging
      res.status(500).json({ message: 'Internal Server Error' }); // Send error response
    }
  };
  
// Export các hàm
module.exports = {
  getSchedules,
  renderNewSchedulePage,
  createScheduleApi,
  renderEditSchedulePage,
  updateScheduleApi,
  deleteScheduleApi,
};
