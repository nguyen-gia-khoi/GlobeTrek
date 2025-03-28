const jwt = require('jsonwebtoken');
const Order = require('../../models/Order'); // Import model Order
const { Tour } = require('../../models/Tour'); // Import model Tour

// Hàm lấy danh sách đơn hàng của Partner
const getPartnerOrders = async (req, res) => {
  try {
    const token = req.cookies.PartneraccessToken;

    if (!token) {
      return res.status(401).json({ message: 'Token not found, please login' });
    }

    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    const partnerId = decoded.userId;

    if (!partnerId) {
      console.error("Partner ID not found in token:", decoded);
      return res.status(400).json({ message: 'Invalid token, partner ID not found' });
    }

    const partnerTours = await Tour.find({ partner: partnerId }).select('_id');
    const tourIds = partnerTours.map(tour => tour._id);

    if (tourIds.length === 0) {
      return res.status(200).json({ orders: [] });
    }

    const orders = await Order.find({
      tour: { $in: tourIds }
    })
    .populate('tour', 'title')
    .populate('user', 'email')
    .exec();

    res.status(200).json({ orders });
  } catch (error) {
    console.error("Error in getPartnerOrders:", error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Hàm render trang danh sách đơn hàng của Partner
const renderPartnerOrdersPage = async (req, res) => {
  try {
    const token = req.cookies.PartneraccessToken;

    if (!token) {
      return res.redirect('/login'); 
    }
    const page = parseInt(req.query.page) || 1; // Mặc định là trang 1
    const limit = parseInt(req.query.limit) || 10; // Mặc định là 10 đơn hàng mỗi trang
    const skip = (page - 1) * limit;
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    const partnerId = decoded.userId;

    if (!partnerId) {
      console.error("Partner ID not found in token:", decoded);
      return res.status(400).send('Invalid token, partner ID not found');
    }

    const partnerTours = await Tour.find({ partner: partnerId }).select('_id');
    const tourIds = partnerTours.map(tour => tour._id);

 // Tính tổng số đơn hàng của đối tác
 const totalOrders = await Order.countDocuments({
  tour: { $in: tourIds }
});

// Tính số trang
const totalPages = Math.ceil(totalOrders / limit);


    const orders = await Order.find({
      tour: { $in: tourIds }
    })
    .skip(skip)
    .limit(limit)
    .populate('tour', 'title')
    .populate('user', 'email')
    .exec();  
    res.render('Order/partnerOrders', {  orders,
      totalPages,
      currentPage: page });
  } catch (error) {
    console.error("Error in renderPartnerOrdersPage:", error);
    res.status(500).send('Server error');
  }
};

module.exports = {
  getPartnerOrders,
  renderPartnerOrdersPage,
};
