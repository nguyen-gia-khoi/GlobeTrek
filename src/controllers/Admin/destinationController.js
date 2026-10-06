const { Destination, Country, Region, Tour } = require('../../models/Tour');

// Lấy danh sách tất cả các Destination với phân trang & sắp xếp
const getAllDestinations = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 8;
    const { search, country, region, sortBy = 'createdAt', order = 'desc' } = req.query;

    let filter = {};
    if (country) filter.country = country;
    if (region) filter.region = region;
    if (search && search.trim()) {
      filter.$or = [
        { name: { $regex: search.trim(), $options: 'i' } },
        { description: { $regex: search.trim(), $options: 'i' } },
      ];
    }

    const [destinations, countries, regions] = await Promise.all([
      Destination.find(filter).populate('country').populate('region'),
      Country.find({ isActive: true }).sort({ name: 1 }),
      Region.find({ isActive: true }).populate('country').sort({ name: 1 }),
    ]);

    // Đếm số lượng tour cho từng điểm đến
    const destinationsWithCounts = await Promise.all(
      destinations.map(async (dest) => {
        const tourCount = await Tour.countDocuments({
          destination: dest._id,
          isDeleted: { $ne: true },
        });
        const destObj = dest.toObject();
        destObj.tourCount = tourCount;
        return destObj;
      })
    );

    // Sắp xếp
    destinationsWithCounts.sort((a, b) => {
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

    const totalItems = destinationsWithCounts.length;
    const totalPages = Math.ceil(totalItems / limit) || 1;
    const currentPage = Math.max(1, Math.min(page, totalPages));
    const paginatedDestinations = destinationsWithCounts.slice((currentPage - 1) * limit, currentPage * limit);

    const queryParams = new URLSearchParams();
    if (search) queryParams.set('search', search);
    if (country) queryParams.set('country', country);
    if (region) queryParams.set('region', region);
    if (sortBy) queryParams.set('sortBy', sortBy);
    if (order) queryParams.set('order', order);
    const queryString = queryParams.toString();

    res.render('Destinations/list', {
      destinations: paginatedDestinations,
      countries,
      regions,
      totalItems,
      currentPage,
      totalPages,
      filters: {
        search: search || '',
        country: country || '',
        region: region || '',
        sortBy,
        order,
      },
      queryString: queryString ? `&${queryString}` : '',
    });
  } catch (error) {
    console.error('Lỗi khi lấy danh sách điểm đến:', error);
    res.status(500).send('Error retrieving destinations: ' + error.message);
  }
};

// Hiển thị trang tạo Destination mới
const createDestinationForm = async (req, res) => {
  try {
    const [countries, regions] = await Promise.all([
      Country.find({ isActive: true }).sort({ name: 1 }),
      Region.find({ isActive: true }).populate('country').sort({ name: 1 }),
    ]);
    res.render('Destinations/create', { countries, regions });
  } catch (error) {
    res.status(500).send('Error loading form: ' + error.message);
  }
};

// Tạo một Destination mới
const createDestination = async (req, res) => {
  const { name, description, region, country, isPopular } = req.body;
  try {
    const imageUrl = req.file?.path || req.file?.url || req.body.image || '';
    const newDestination = new Destination({
      name: name ? name.trim() : '',
      description: description ? description.trim() : '',
      country: country || null,
      region: region || null,
      image: imageUrl,
      isPopular: isPopular === 'on' || isPopular === true || isPopular === 'true',
    });
    await newDestination.save();
    res.redirect('/admin/destinations');
  } catch (error) {
    console.error('Lỗi khi tạo điểm đến:', error);
    res.status(400).send('Error creating destination: ' + error.message);
  }
};

// Hiển thị trang chỉnh sửa Destination
const editDestinationForm = async (req, res) => {
  try {
    const [destination, countries, regions] = await Promise.all([
      Destination.findById(req.params.id).populate('country').populate('region'),
      Country.find({ isActive: true }).sort({ name: 1 }),
      Region.find({ isActive: true }).populate('country').sort({ name: 1 }),
    ]);
    if (!destination) {
      return res.status(404).send('Destination not found');
    }
    res.render('Destinations/edit', { destination, countries, regions });
  } catch (error) {
    res.status(500).send('Error retrieving destination: ' + error.message);
  }
};

// Cập nhật Destination
const updateDestination = async (req, res) => {
  const { name, description, region, country, isPopular } = req.body;
  try {
    const updateData = {
      name: name ? name.trim() : '',
      description: description ? description.trim() : '',
      country: country || null,
      region: region || null,
      isPopular: isPopular === 'on' || isPopular === true || isPopular === 'true',
    };
    if (req.file && (req.file.path || req.file.url)) {
      updateData.image = req.file.path || req.file.url;
    } else if (req.body.image) {
      updateData.image = req.body.image;
    }
    await Destination.findByIdAndUpdate(req.params.id, updateData);
    res.redirect('/admin/destinations');
  } catch (error) {
    console.error('Lỗi khi cập nhật điểm đến:', error);
    res.status(400).send('Error updating destination: ' + error.message);
  }
};

// Xóa Destination
const deleteDestination = async (req, res) => {
  try {
    const tourCount = await Tour.countDocuments({ destination: req.params.id, isDeleted: { $ne: true } });
    if (tourCount > 0) {
      return res.status(400).send('Không thể xóa điểm đến đang có tour du lịch hoạt động. Vui lòng chuyển hoặc xóa các tour trước.');
    }

    const result = await Destination.findByIdAndDelete(req.params.id);
    if (!result) {
      return res.status(404).send('Destination not found');
    }
    res.redirect('/admin/destinations');
  } catch (error) {
    console.error('Lỗi khi xóa điểm đến:', error);
    res.status(500).send('Error deleting destination: ' + error.message);
  }
};

// API: Lấy danh sách điểm đến cho Client
const getAllDestinationsAPI = async (req, res) => {
  try {
    const { country, region, isPopular, search } = req.query;
    let filter = { isActive: { $ne: false } };

    if (country) filter.country = country;
    if (region) filter.region = region;
    if (isPopular === 'true' || isPopular === true) filter.isPopular = true;
    if (search && search.trim()) {
      filter.$or = [
        { name: { $regex: search.trim(), $options: 'i' } },
        { description: { $regex: search.trim(), $options: 'i' } },
      ];
    }

    const destinations = await Destination.find(filter)
      .populate('country', 'name code')
      .populate('region', 'name')
      .sort({ name: 1 });

    // Đếm số lượng tour đang hoạt động cho từng điểm đến
    const destinationsWithTourCount = await Promise.all(
      destinations.map(async (dest) => {
        const tourCount = await Tour.countDocuments({
          destination: dest._id,
          isApproved: true,
          isDeleted: { $ne: true },
        });
        const destObj = dest.toObject();
        destObj.tourCount = tourCount;
        return destObj;
      })
    );

    res.status(200).json(destinationsWithTourCount);
  } catch (error) {
    console.error('Lỗi khi lấy danh sách điểm đến cho client:', error);
    res.status(500).json({ error: 'Error fetching destinations: ' + error.message });
  }
};

// API: Lấy chi tiết 1 điểm đến theo ID cho Client
const getDestinationByIdAPI = async (req, res) => {
  try {
    const destination = await Destination.findOne({ _id: req.params.id, isActive: { $ne: false } })
      .populate('country', 'name code')
      .populate('region', 'name');

    if (!destination) {
      return res.status(404).json({ error: 'Destination not found' });
    }

    const tourCount = await Tour.countDocuments({
      destination: destination._id,
      isApproved: true,
      isDeleted: { $ne: true },
    });

    const destObj = destination.toObject();
    destObj.tourCount = tourCount;

    res.status(200).json(destObj);
  } catch (error) {
    console.error('Lỗi khi lấy chi tiết điểm đến cho client:', error);
    res.status(500).json({ error: 'Error fetching destination' });
  }
};

// Hàm để xác nhận xóa
const confirmDeleteDestination = async (req, res) => {
  try {
    const destination = await Destination.findById(req.params.id).populate('country').populate('region');
    res.render('Destinations/delete', { destination });
  } catch (error) {
    res.status(500).send('Error retrieving destination for deletion: ' + error.message);
  }
};

module.exports = {
  getAllDestinations,
  getAllDestinationsAPI,
  getDestinationByIdAPI,
  createDestinationForm,
  createDestination,
  editDestinationForm,
  updateDestination,
  deleteDestination,
  confirmDeleteDestination,
};
