const mongoose = require('mongoose');
const { Tour } = require('../../models/Tour');
const Order = require('../../models/Order');

// GET: Hiển thị danh sách tour (Admin)
const getTours = async (req, res) => {
  try {
    const tours = await Tour.find().populate('partner'); // Thêm populate để hiển thị thông tin partner
    res.render('Tours/Admin/list', { tours });
  } catch (error) {
    console.error('Lỗi khi lấy danh sách tour:', error);
    res.status(500).send('Lỗi khi lấy danh sách tour');
  }
};


// GET: Hiển thị danh sách yêu cầu thêm tour từ partner (Admin)
const getAddRequests = async (req, res) => {
  try {
    const addRequests = await Tour.find({ isApproved: false }).populate('partner', 'name'); // Chỉ lấy tên partner
    // Chuyển đổi danh sách yêu cầu thành dạng mà bạn muốn hiển thị
    const formattedRequests = addRequests.map(tour => ({
      id: tour._id,
      title: tour.title,
      partnerName: tour.partner ? tour.partner._id : 'N/A', // Lấy tên partner
      // Thêm các thông tin khác nếu cần
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
      isDeleted: false // Chỉ lấy tour chưa bị xóa
    }).populate('partner'); // Nếu cần thêm thông tin về partner
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

    // Kiểm tra xem ID có phải là ObjectId hợp lệ không
    if (!mongoose.Types.ObjectId.isValid(tourId)) {
      return res.status(400).json({ message: 'ID không hợp lệ' });
    }

    const tour = await Tour.findById(tourId);
    if (!tour) {
      return res.status(404).json({ message: 'Không tìm thấy tour' });
    }

    // Kiểm tra xem có đơn hàng nào liên quan đến tour này không
    const existingOrders = await Order.find({ tourId: tourId }); // Tìm các đơn hàng liên quan đến tour
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

    tour.isApproved = true; // Xác nhận thêm tour
    await tour.save();
    res.redirect('Tours/Admin/add-requests');
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

    // Kiểm tra xem có đơn hàng nào liên quan đến tour này không
    const existingOrders = await Order.find({ tourId: tourId });
    if (existingOrders.length > 0) {
      return res.status(400).json({ message: 'Không thể tắt tour đã được đặt' });
    }

    tour.isDisabled = !tour.isDisabled;
    await tour.save();
    res.redirect('/admin/tours/list'); // Sử dụng đường dẫn tuyệt đối
  } catch (error) {
    console.error('Lỗi khi xác nhận bật/tắt tour:', error);
    res.status(500).json({ message: 'Lỗi khi xác nhận bật/tắt tour', error });
  }
};


module.exports = {
  getTours,
  getDeleteRequests,
  getAddRequests,
  confirmDeleteTour,
  confirmAddTour,
  toggleTourStatus,
};
