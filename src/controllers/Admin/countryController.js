const { Country, Region, Destination, Tour } = require('../../models/Tour');

// GET: Lấy danh sách tất cả quốc gia với phân trang & sắp xếp (Admin)
const getAllCountries = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 8;
    const { search, sortBy = 'createdAt', order = 'desc' } = req.query;

    let filter = {};
    if (search && search.trim()) {
      filter.$or = [
        { name: { $regex: search.trim(), $options: 'i' } },
        { code: { $regex: search.trim(), $options: 'i' } },
        { description: { $regex: search.trim(), $options: 'i' } },
      ];
    }

    const countries = await Country.find(filter);
    
    // Đếm số lượng vùng miền, điểm đến và tour của từng quốc gia
    const countriesWithCounts = await Promise.all(
      countries.map(async (country) => {
        const dests = await Destination.find({ country: country._id }).select('_id');
        const destIds = dests.map(d => d._id);

        const [regionCount, destCount, tourCount] = await Promise.all([
          Region.countDocuments({ country: country._id }),
          Destination.countDocuments({ country: country._id }),
          Tour.countDocuments({
            $or: [
              { country: country._id },
              { destination: { $in: destIds } }
            ],
            isDeleted: { $ne: true },
          }),
        ]);
        const countryObj = country.toObject();
        countryObj.regionCount = regionCount;
        countryObj.destCount = destCount;
        countryObj.tourCount = tourCount;
        return countryObj;
      })
    );

    // Sắp xếp
    countriesWithCounts.sort((a, b) => {
      if (sortBy === 'tours' || sortBy === 'tourCount') {
        return order === 'asc' ? (a.tourCount - b.tourCount) : (b.tourCount - a.tourCount);
      } else if (sortBy === 'name') {
        return order === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
      } else if (sortBy === 'regions') {
        return order === 'asc' ? (a.regionCount - b.regionCount) : (b.regionCount - a.regionCount);
      } else if (sortBy === 'destinations') {
        return order === 'asc' ? (a.destCount - b.destCount) : (b.destCount - a.destCount);
      } else {
        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();
        return order === 'asc' ? (dateA - dateB) : (dateB - dateA);
      }
    });

    const totalItems = countriesWithCounts.length;
    const totalPages = Math.ceil(totalItems / limit) || 1;
    const currentPage = Math.max(1, Math.min(page, totalPages));
    const paginatedCountries = countriesWithCounts.slice((currentPage - 1) * limit, currentPage * limit);

    const queryParams = new URLSearchParams();
    if (search) queryParams.set('search', search);
    if (sortBy) queryParams.set('sortBy', sortBy);
    if (order) queryParams.set('order', order);
    const queryString = queryParams.toString();

    res.render('Countries/list', {
      countries: paginatedCountries,
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
    console.error('Lỗi khi lấy danh sách quốc gia:', error);
    res.status(500).send('Lỗi khi lấy danh sách quốc gia: ' + error.message);
  }
};

// GET: API lấy danh sách quốc gia dạng JSON
const getCountriesAPI = async (req, res) => {
  try {
    const countries = await Country.find({ isActive: true }).sort({ name: 1 });
    res.json(countries);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// POST: Tạo quốc gia mới
const createCountry = async (req, res) => {
  try {
    const { name, code, description } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).send('Tên quốc gia không được để trống.');
    }

    const existing = await Country.findOne({ name: name.trim() });
    if (existing) {
      return res.status(400).send('Quốc gia này đã tồn tại trong hệ thống.');
    }

    await Country.create({
      name: name.trim(),
      code: code ? code.trim().toUpperCase() : '',
      description: description ? description.trim() : '',
    });

    res.redirect('/admin/countries');
  } catch (error) {
    console.error('Lỗi khi tạo quốc gia:', error);
    res.status(400).send('Lỗi khi tạo quốc gia: ' + error.message);
  }
};

// POST: Cập nhật quốc gia
const updateCountry = async (req, res) => {
  try {
    const { name, code, description, isActive } = req.body;
    await Country.findByIdAndUpdate(req.params.id, {
      name: name ? name.trim() : '',
      code: code ? code.trim().toUpperCase() : '',
      description: description ? description.trim() : '',
      isActive: isActive === 'on' || isActive === true || isActive === 'true',
    });

    res.redirect('/admin/countries');
  } catch (error) {
    console.error('Lỗi khi cập nhật quốc gia:', error);
    res.status(400).send('Lỗi khi cập nhật quốc gia: ' + error.message);
  }
};

// POST: Xóa quốc gia
const deleteCountry = async (req, res) => {
  try {
    const countryId = req.params.id;
    const dests = await Destination.find({ country: countryId }).select('_id');
    const destIds = dests.map(d => d._id);

    // Kiểm tra xem quốc gia có chứa vùng miền, điểm đến hay tour không
    const [regionCount, destCount, tourCount] = await Promise.all([
      Region.countDocuments({ country: countryId }),
      Destination.countDocuments({ country: countryId }),
      Tour.countDocuments({
        $or: [
          { country: countryId },
          { destination: { $in: destIds } }
        ],
        isDeleted: { $ne: true },
      }),
    ]);

    if (regionCount > 0 || destCount > 0 || tourCount > 0) {
      return res.status(400).send('Không thể xóa quốc gia đang chứa các vùng miền, điểm đến hoặc tour du lịch. Vui lòng chuyển hoặc xóa các mục con trước.');
    }

    await Country.findByIdAndDelete(countryId);
    res.redirect('/admin/countries');
  } catch (error) {
    console.error('Lỗi khi xóa quốc gia:', error);
    res.status(500).send('Lỗi khi xóa quốc gia: ' + error.message);
  }
};

module.exports = {
  getAllCountries,
  getCountriesAPI,
  createCountry,
  updateCountry,
  deleteCountry,
};
