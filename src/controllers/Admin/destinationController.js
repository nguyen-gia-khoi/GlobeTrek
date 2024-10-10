const { Destination } = require('../../models/Tour'); // Điều chỉnh đường dẫn nếu cần

// Lấy danh sách tất cả các Destination
const getAllDestinations = async (req, res) => {
  try {
    const destinations = await Destination.find().populate('tours'); // Đảm bảo tours được populate
    res.render('destinations/list', { destinations });
  } catch (error) {
    res.status(500).send('Error retrieving destinations: ' + error.message);
  }
};

// Hiển thị trang tạo Destination mới
const createDestinationForm = (req, res) => {
  res.render('destinations/create');
};

// Tạo một Destination mới
const createDestination = async (req, res) => {
  const { name } = req.body;
  try {
    const newDestination = new Destination({ name });
    await newDestination.save();
    res.redirect('/destinations'); // Điều chỉnh đường dẫn sau khi tạo thành công
  } catch (error) {
    res.status(400).send('Error creating destination: ' + error.message);
  }
};

// Hiển thị trang chỉnh sửa Destination
const editDestinationForm = async (req, res) => {
  try {
    const destination = await Destination.findById(req.params.id);
    if (!destination) {
      return res.status(404).send('Destination not found');
    }
    res.render('destinations/edit', { destination });
  } catch (error) {
    res.status(500).send('Error retrieving destination: ' + error.message);
  }
};

// Cập nhật Destination
const updateDestination = async (req, res) => {
  const { name } = req.body;
  try {
    await Destination.findByIdAndUpdate(req.params.id, { name });
    res.redirect('/destinations');
  } catch (error) {
    res.status(400).send('Error updating destination: ' + error.message);
  }
};

// Xóa Destination
const deleteDestination = async (req, res) => {
  try {
    const result = await Destination.findByIdAndDelete(req.params.id);
    if (!result) {
      return res.status(404).send('Destination not found');
    }
    res.redirect('/destinations');
  } catch (error) {
    res.status(500).send('Error deleting destination: ' + error.message);
  }
};


// Hàm để xác nhận xóa
const confirmDeleteDestination = async (req, res) => {
  const destination = await Destination.findById(req.params.id);
  res.render('destinations/delete', { destination });
};

module.exports = {
  getAllDestinations,
  createDestinationForm,
  createDestination,
  editDestinationForm,
  updateDestination,
  deleteDestination,
  confirmDeleteDestination,
};
