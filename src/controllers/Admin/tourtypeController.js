const { Tour, TourType } = require('../../models/Tour'); 

// Lấy danh sách tất cả các TourType với phân trang & sắp xếp
const getAllTourTypes = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 8;
    const { search, sortBy = 'createdAt', order = 'desc' } = req.query;

    let filter = {};
    if (search && search.trim()) {
      filter.$or = [
        { name: { $regex: search.trim(), $options: 'i' } },
        { description: { $regex: search.trim(), $options: 'i' } },
      ];
    }

    const tourTypes = await TourType.find(filter);

    // Đếm số lượng tour thuộc từng loại tour
    const tourTypesWithCounts = await Promise.all(
      tourTypes.map(async (tourType) => {
        const tourCount = await Tour.countDocuments({
          tourType: tourType._id,
          isDeleted: { $ne: true },
        });
        const typeObj = tourType.toObject();
        typeObj.tourCount = tourCount;
        return typeObj;
      })
    );

    // Sắp xếp
    tourTypesWithCounts.sort((a, b) => {
      if (sortBy === 'tours' || sortBy === 'tourCount') {
        return order === 'asc' ? (a.tourCount - b.tourCount) : (b.tourCount - a.tourCount);
      } else if (sortBy === 'name') {
        return order === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
      } else {
        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();
        return order === 'asc' ? (dateA - dateB) : (dateB - dateA);
      }
    });

    const totalItems = tourTypesWithCounts.length;
    const totalPages = Math.ceil(totalItems / limit) || 1;
    const currentPage = Math.max(1, Math.min(page, totalPages));
    const paginatedTourTypes = tourTypesWithCounts.slice((currentPage - 1) * limit, currentPage * limit);

    const queryParams = new URLSearchParams();
    if (search) queryParams.set('search', search);
    if (sortBy) queryParams.set('sortBy', sortBy);
    if (order) queryParams.set('order', order);
    const queryString = queryParams.toString();

    res.render('tourTypes/list', {
      tourTypes: paginatedTourTypes,
      totalItems,
      currentPage,
      totalPages,
      filters: {
        search: search || '',
        sortBy,
        order,
      },
      queryString: queryString ? `&${queryString}` : '',
    });
  } catch (error) {
    res.status(500).send('Error retrieving tour types: ' + error.message);
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
  const { name, description, isFeatured } = req.body;
  try {
    const newTourType = new TourType({
      name,
      description: description ? description.trim() : '',
      isFeatured: isFeatured === 'on' || isFeatured === true || isFeatured === 'true',
    });
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
  const { name, description, isFeatured } = req.body;
  try {
    const updateData = {
      name,
      description: description ? description.trim() : '',
      isFeatured: isFeatured === 'on' || isFeatured === true || isFeatured === 'true',
    };
    await TourType.findByIdAndUpdate(req.params.id, updateData);
    res.redirect('/tourTypes');
  } catch (error) {
    res.status(400).send('Error updating tour type: ' + error.message);
  }
};

// Xóa TourType
const deleteTourType = async (req, res) => {
    console.log('Attempting to delete TourType with ID:', req.params.id); // Log ID
    try {
      const tourCount = await Tour.countDocuments({ tourType: req.params.id, isDeleted: { $ne: true } });
      if (tourCount > 0) {
        return res.status(400).send('Không thể xóa loại tour đang có tour du lịch liên kết. Vui lòng chuyển hoặc xóa các tour trước.');
      }

      const result = await TourType.findByIdAndDelete(req.params.id);
      if (!result) {
        console.log('TourType not found'); // Log nếu không tìm thấy
        return res.status(404).send('TourType not found');
      }
      console.log('Deleted TourType:', result); // Log kết quả xóa
      res.redirect('/tourtypes');
    } catch (error) {
      console.error('Error deleting tour type:', error); // Log lỗi
      res.status(500).send('Error deleting tour type: ' + error.message);
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
