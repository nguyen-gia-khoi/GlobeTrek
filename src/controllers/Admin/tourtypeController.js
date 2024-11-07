const { TourType } = require('../../models/Tour'); 

// Lấy danh sách tất cả các TourType
const getAllTourTypes = async (req, res) => {
  try {
    const tourTypes = await TourType.find();
    res.render('tourTypes/list', { tourTypes });
    // res.json({tourTypes});
  } catch (error) {
    res.status(500).send('Error retrieving tour types');
  }
};
const getAllTourTypesAPI = async (req, res) => {
  try {
    const tourTypes = await TourType.find();
    res.json({tourTypes});
  } catch (error) {
    res.status(500).send('Error retrieving tour types');
  }
};
// Hiển thị trang tạo TourType mới
const createTourTypeForm = (req, res) => {
  res.render('tourTypes/create');
};

const createTourType = async (req, res) => {
  const { name } = req.body;
  try {
    const newTourType = new TourType({ name });
    await newTourType.save();
    res.redirect('/tourtypes'); 
  } catch (error) {
    res.status(400).send('Error creating tour type: ' + error.message);
  }
};

// Hiển thị trang chỉnh sửa TourType
const editTourTypeForm = async (req, res) => {
  try {
    const tourType = await TourType.findById(req.params.id);
    if (!tourType) {
      return res.status(404).send('TourType not found');
    }
    res.render('tourTypes/edit', { tourType });
  } catch (error) {
    res.status(500).send('Error retrieving tour type');
  }
};

// Cập nhật TourType
const updateTourType = async (req, res) => {
  const { name } = req.body;
  try {
    await TourType.findByIdAndUpdate(req.params.id, { name });
    res.redirect('/tourTypes');
  } catch (error) {
    res.status(400).send('Error updating tour type: ' + error.message);
  }
};

// Xóa TourType
const deleteTourType = async (req, res) => {
    console.log('Attempting to delete TourType with ID:', req.params.id); // Log ID
    try {
      const result = await TourType.findByIdAndDelete(req.params.id);
      if (!result) {
        console.log('TourType not found'); // Log nếu không tìm thấy
        return res.status(404).send('TourType not found');
      }
      console.log('Deleted TourType:', result); // Log kết quả xóa
      res.redirect('/tourtypes');
    } catch (error) {
      console.error('Error deleting tour type:', error); // Log lỗi
      res.status(500).send('Error deleting tour type');
    }
  };
  
  
// Hàm để xác nhận xóa
const confirmDeleteTourType = async (req, res) => {
    const tourType = await TourType.findById(req.params.id);
    res.render('tourTypes/delete', { tourType });
};

module.exports = {
  getAllTourTypes,
  getAllTourTypesAPI,
  createTourTypeForm,
  createTourType,
  editTourTypeForm,
  updateTourType,
  deleteTourType,
  confirmDeleteTourType
};
