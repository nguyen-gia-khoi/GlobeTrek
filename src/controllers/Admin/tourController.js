const mongoose = require('mongoose');
const moment = require('moment-timezone');
const User = require('../../models/User');
const { Tour, Destination, Country, Region } = require('../../models/Tour');
const Order = require('../../models/Order');
const TourDeparture = require('../../models/TourDeparture');
const { attachDepartures } = require('../../service/departureService');
const { recordAudit } = require('../../service/auditService');

// GET: Hiển thị danh sách tour (Admin) với đầy đủ bộ lọc
const getTours = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const skip = (page - 1) * limit;

    const {
      partner,
      status,
      country,
      region,
      destination,
      date,
      duration,
      search,
    } = req.query;

    const filter = { isDeleted: { $ne: true } };

    // 1. Lọc theo đối tác
    if (partner && mongoose.Types.ObjectId.isValid(partner)) {
      filter.partner = new mongoose.Types.ObjectId(partner);
    }

    // 2. Lọc theo trạng thái
    if (status === 'active') {
      filter.isApproved = true;
      filter.isDisabled = false;
    } else if (status === 'disabled') {
      filter.isApproved = true;
      filter.isDisabled = true;
    } else if (status === 'pending') {
      filter.isApproved = false;
    }

    // 3. Lọc theo Quốc gia
    if (country && mongoose.Types.ObjectId.isValid(country)) {
      filter.country = new mongoose.Types.ObjectId(country);
    }

    // 4. Lọc theo Vùng miền
    if (region && mongoose.Types.ObjectId.isValid(region)) {
      filter.region = new mongoose.Types.ObjectId(region);
    }

    // 5. Lọc theo Điểm đến
    if (destination && mongoose.Types.ObjectId.isValid(destination)) {
      filter.destination = new mongoose.Types.ObjectId(destination);
    }

    // 6. Lọc theo ngày có lịch khởi hành
    if (/^\d{4}-\d{2}-\d{2}$/.test(date || '')) {
      const departureTourIds = await TourDeparture.distinct('tour', {
        departureDate: {
          $gte: moment.tz(date, 'Asia/Ho_Chi_Minh').startOf('day').toDate(),
          $lte: moment.tz(date, 'Asia/Ho_Chi_Minh').endOf('day').toDate(),
        },
      });
      filter._id = { $in: departureTourIds };
    }

    // 7. Lọc theo số ngày (duration)
    if (duration) {
      if (duration === '6+') {
        filter.duration = { $gte: 6 };
      } else {
        const numDuration = parseInt(duration);
        if (!isNaN(numDuration)) {
          filter.duration = numDuration;
        }
      }
    }

    // 8. Tìm kiếm theo tên hoặc địa điểm
    if (search && search.trim()) {
      filter.$or = [
        { title: { $regex: search.trim(), $options: 'i' } },
        { location: { $regex: search.trim(), $options: 'i' } },
      ];
    }

    // Lấy danh sách tour
    const tours = await Tour.find(filter)
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limit)
      .populate('partner', 'name email')
      .populate('destination', 'name')
      .populate('country', 'name code')
      .populate('region', 'name')
      .populate('tourType', 'name');

    const totalTours = await Tour.countDocuments(filter); // Tổng số tour thỏa mãn bộ lọc
    const totalPages = Math.ceil(totalTours / limit) || 1; // Tổng số trang

    // Lấy danh sách đối tác, điểm đến, quốc gia & vùng miền để hiển thị các tùy chọn trong select
    const [partnersList, destinationsList, countriesList, regionsList] = await Promise.all([
      User.find({ role: 'partner' }).select('_id name email').sort({ name: 1 }),
      Destination.find().populate('country region').select('_id name country region').sort({ name: 1 }),
      Country.find({ isActive: true }).select('_id name code').sort({ name: 1 }),
      Region.find({ isActive: true }).populate('country').select('_id name country').sort({ name: 1 }),
    ]);

    const toursWithDepartures = await attachDepartures(tours);
    const toursWithOrders = await Promise.all(
      toursWithDepartures.map(async (tour) => {
        tour.hasOrders = Boolean(await Order.exists({ tour: tour._id }));
        return tour;
      })
    );

    // Xây dựng query string cho phân trang để giữ nguyên các filter đã chọn
    const queryParams = new URLSearchParams();
    if (partner) queryParams.set('partner', partner);
    if (status) queryParams.set('status', status);
    if (country) queryParams.set('country', country);
    if (region) queryParams.set('region', region);
    if (destination) queryParams.set('destination', destination);
    if (date) queryParams.set('date', date);
    if (duration) queryParams.set('duration', duration);
    if (search) queryParams.set('search', search);

    const queryString = queryParams.toString();

    res.render('Tours/Admin/list', {
      tours: toursWithOrders,
      currentPage: page,
      totalPages,
      totalTours,
      partnersList,
      destinationsList,
      countriesList,
      regionsList,
      filters: {
        partner: partner || '',
        status: status || '',
        country: country || '',
        region: region || '',
        destination: destination || '',
        date: date || '',
        duration: duration || '',
        search: search || '',
      },
      queryString: queryString ? `&${queryString}` : '',
    });
  } catch (error) {
    console.error('Lỗi khi lấy danh sách tour:', error);
    res.status(500).send('Lỗi khi lấy danh sách tour');
  }
};

// GET: API để lấy danh sách tour (Admin)
const getToursAPI = async (req, res) => {
  try {
    const tours = await Tour.find()
      .populate('partner', 'name email')
      .sort({ createdAt: 1 });
    res.json({ tours });
  } catch (error) {
    console.error('Lỗi khi lấy danh sách tour:', error);
    res.status(500).json({ message: 'Lỗi khi lấy danh sách tour' });
  }
};

// GET: Hiển thị danh sách yêu cầu thêm tour từ partner (Admin)
const getAddRequests = async (req, res) => {
  try {
    const addRequests = await attachDepartures(await Tour.find({ isApproved: false })
      .populate('partner', 'name email')
      .populate('tourType', 'name')
      .populate('destination', 'name')
      .populate('country', 'name code')
      .populate('region', 'name')
      .sort({ createdAt: 1 }));

    res.render('Tours/Admin/addRequests', { addRequests });
  } catch (error) {
    console.error('Lỗi khi lấy danh sách yêu cầu thêm tour:', error);
    res.status(500).send('Lỗi khi lấy danh sách yêu cầu thêm tour');
  }
};

const getDeleteRequests = async (req, res) => {
  try {
    const deleteRequests = await Tour.find({ 
      deletionRequested: true, 
      isDeleted: false 
    })
      .populate('partner', 'name email')
      .sort({ createdAt: 1 }); 
    const formattedRequests = deleteRequests.map(tour => ({
      id: tour._id,
      title: tour.title,
      partnerName: tour.partner ? tour.partner.name : 'N/A', 
    }));
    console.log(formattedRequests); // Kiểm tra xem dữ liệu có trả về không
    res.render('Tours/Admin/deleteRequests', { formattedRequests });
  } catch (error) {
    console.error('Lỗi khi lấy danh sách yêu cầu xóa tour:', error);
    res.status(500).send('Lỗi khi lấy danh sách yêu cầu xóa tour');
  }
};

// POST: Xác nhận yêu cầu xóa tour (Admin)
const confirmDeleteTour = async (req, res) => {
  try {
    const tourID = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(tourID)) {
      return res.status(400).json({ message: 'ID không hợp lệ' });
    }

    const tour = await Tour.findById(tourID);
    if (!tour) {
      return res.status(404).json({ message: 'Không tìm thấy tour' });
    }

    // Check if the tour has any orders
    const existingOrders = await Order.find({ 'tour': tourID });
    if (existingOrders.length > 0) {
      return res.status(400).json({ message: 'Không thể xóa tour đã được đặt' });
    }

    // Delete the tour
    await Tour.findByIdAndDelete(tourID);
    await recordAudit(req, 'tour.confirm-delete', { type: 'Tour', id: tourID });
    res.redirect('/admin/tours/delete-requests'); // Redirect after deletion
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
    await recordAudit(req, 'tour.confirm-add', { type: 'Tour', id: tourId });

    if (req.xhr || req.headers.accept?.includes('application/json') || req.is('json')) {
      return res.status(200).json({ message: 'Xác nhận tour thành công' });
    }
    return res.redirect('/admin/tours/add-requests');
  } catch (error) {
    console.error('Lỗi khi xác nhận thêm tour:', error);
    res.status(500).json({ message: 'Lỗi khi xác nhận thêm tour', error });
  }
};

// POST: Xác nhận bật/tắt tour (Admin)
const toggleTourStatus = async (req, res) => {
  const tourID = req.params.id;
  try {
    const tour = await Tour.findById(tourID);
    if (!tour) {
      return res.status(404).json({ message: 'Không tìm thấy tour' });
    }

    // Kiểm tra đơn hàng trước khi bật/tắt tour
    const existingOrders = await Order.find({ 'tour': tourID });
    console.log('Existing Orders:', existingOrders);  
    if (existingOrders.length > 0) {
      return res.status(400).json({ message: 'Không thể tắt tour đã được đặt' });
    }

    // Chuyển trạng thái bật/tắt
    tour.isDisabled = !tour.isDisabled;
    await tour.save();
    res.redirect('/Admin/tours/list'); 
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
