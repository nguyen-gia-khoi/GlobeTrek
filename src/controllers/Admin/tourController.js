const mongoose = require('mongoose');
const { Tour, TourAvailability } = require('../../models/Tour'); // Import TourAvailability
const Order = require('../../models/Order');

// GET: Hiển thị danh sách tour (Admin)
const getTours = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;  // Trang hiện tại (mặc định là trang 1)
    const limit = 10;  // Số lượng tour hiển thị mỗi trang
    const skip = (page - 1) * limit;  // Tính số lượng tour cần bỏ qua

    const tours = await Tour.find().skip(skip).limit(limit).populate('partner', 'name email');
    const totalTours = await Tour.countDocuments();  // Tổng số tour trong DB
    const totalPages = Math.ceil(totalTours / limit);  // Tổng số trang

    res.render('Tours/Admin/list', {
      tours,
      currentPage: page,
      totalPages,
    });
  } catch (error) {
    console.error('Lỗi khi lấy danh sách tour:', error);
    res.status(500).send('Lỗi khi lấy danh sách tour');
  }
};

// GET: API để lấy danh sách tour (Admin)
const getToursAPI = async (req, res) => {
  try {
    const tours = await Tour.find().populate('partner', 'name email')
    res.json({ tours });
  } catch (error) {
    console.error('Lỗi khi lấy danh sách tour:', error);
    res.status(500).json({ message: 'Lỗi khi lấy danh sách tour' });
  }
};

// GET: Hiển thị danh sách yêu cầu thêm tour từ partner (Admin)
const getAddRequests = async (req, res) => {
  try {
    const addRequests = await Tour.find({ isApproved: false }).populate('partner', 'name email');
    const formattedRequests = addRequests.map(tour => ({
      id: tour._id,
      title: tour.title,
      partnerName: tour.partner ? tour.partner.name : 'N/A', 
    }));
    res.render('Tours/Admin/addRequests', { addRequests: formattedRequests });
  } catch (error) {
    console.error('Lỗi khi lấy danh sách yêu cầu thêm tour:', error);
    res.status(500).send('Lỗi khi lấy danh sách yêu cầu thêm tour');
  }
};

// GET: Hiển thị danh sách yêu cầu xóa tour từ partner (Admin)
const getDeleteRequests = async (req, res) => {
  try {
    const deleteRequests = await Tour.find({ 
      deletionRequested: true, 
      isDeleted: false 
    }).populate('partner', 'name email'); 
    res.render('Tours/Admin/deleteRequests', { deleteRequests });
  } catch (error) {
    console.error('Lỗi khi lấy danh sách yêu cầu xóa tour:', error);
    res.status(500).send('Lỗi khi lấy danh sách yêu cầu xóa tour');
  }
};

// POST: Xác nhận yêu cầu xóa tour (Admin)
const confirmDeleteTour = async (req, res) => {
  try {
    const tourId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(tourId)) {
      return res.status(400).json({ message: 'ID không hợp lệ' });
    }

    const tour = await Tour.findById(tourId);
    if (!tour) {
      return res.status(404).json({ message: 'Không tìm thấy tour' });
    }

    // Kiểm tra xem tour có đơn hàng nào chưa
    const existingOrders = await Order.find({ tourId: tourId });
    if (existingOrders.length > 0) {
      return res.status(400).json({ message: 'Không thể xóa tour đã được đặt' });
    }

    // Xóa tour
    await Tour.findByIdAndDelete(tourId);
    res.redirect('/admin/tours/delete-requests');
  } catch (error) {
    console.error('Lỗi khi xác nhận xóa tour:', error);
    res.status(500).json({ message: 'Lỗi khi xác nhận xóa tour', error });
  }
};

// POST: Xác nhận thêm tour (Admin)
const confirmAddTour = async (req, res) => {
  const tourId = req.params.id;
  try {
    const tour = await Tour.findById(tourId);
    if (!tour) {
      return res.status(404).json({ message: 'Không tìm thấy tour' });
    }

    // Xác nhận thêm tour
    tour.isApproved = true; 
    await tour.save();
    res.status(200).json({ message: 'Xác nhận tour thành công' });
  } catch (error) {
    console.error('Lỗi khi xác nhận thêm tour:', error);
    res.status(500).json({ message: 'Lỗi khi xác nhận thêm tour', error });
  }
};

// POST: Xác nhận bật/tắt tour (Admin)
const toggleTourStatus = async (req, res) => {
  const tourId = req.params.id;
  try {
    const tour = await Tour.findById(tourId);
    if (!tour) {
      return res.status(404).json({ message: 'Không tìm thấy tour' });
    }

    // Kiểm tra đơn hàng trước khi bật/tắt tour
    const existingOrders = await Order.find({ tourId: tourId });
    if (existingOrders.length > 0) {
      return res.status(400).json({ message: 'Không thể tắt tour đã được đặt' });
    }

    // Chuyển trạng thái bật/tắt
    tour.isDisabled = !tour.isDisabled;
    await tour.save();
    res.redirect('/admin/tours/list'); 
  } catch (error) {
    console.error('Lỗi khi xác nhận bật/tắt tour:', error);
    res.status(500).json({ message: 'Lỗi khi xác nhận bật/tắt tour', error });
  }
};

module.exports = {
  getTours,
  getToursAPI,
  getDeleteRequests,
  getAddRequests,
  confirmDeleteTour,
  confirmAddTour,
  toggleTourStatus,
};
