const { Country, Region, Destination, Tour } = require('../../models/Tour');

// GET: Lấy danh sách tất cả vùng miền với phân trang & sắp xếp (Admin)
const getAllRegions = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 8;
    const { countryId, search, sortBy = 'createdAt', order = 'desc' } = req.query;
    
    const filter = {};
    if (countryId) {
      filter.country = countryId;
    }
    if (search && search.trim()) {
      filter.$or = [
        { name: { $regex: search.trim(), $options: 'i' } },
        { description: { $regex: search.trim(), $options: 'i' } }
      ];
    }

    const [regions, countries] = await Promise.all([
      Region.find(filter).populate('country'),
      Country.find({ isActive: true }).sort({ name: 1 }),
    ]);

    // Đếm số lượng điểm đến và tour thuộc từng vùng miền
    const regionsWithCounts = await Promise.all(
      regions.map(async (region) => {
        const dests = await Destination.find({ region: region._id }).select('_id');
        const destIds = dests.map(d => d._id);

        const [destCount, tourCount] = await Promise.all([
          Destination.countDocuments({ region: region._id }),
          Tour.countDocuments({
            $or: [
              { region: region._id },
              { destination: { $in: destIds } }
            ],
            isDeleted: { $ne: true },
          }),
        ]);
        const regionObj = region.toObject();
        regionObj.destCount = destCount;
        regionObj.tourCount = tourCount;
        return regionObj;
      })
    );

    // Sắp xếp
    regionsWithCounts.sort((a, b) => {
      if (sortBy === 'tours' || sortBy === 'tourCount') {
        return order === 'asc' ? (a.tourCount - b.tourCount) : (b.tourCount - a.tourCount);
      } else if (sortBy === 'name') {
        return order === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
      } else if (sortBy === 'destinations') {
        return order === 'asc' ? (a.destCount - b.destCount) : (b.destCount - a.destCount);
      } else {
        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();
        return order === 'asc' ? (dateA - dateB) : (dateB - dateA);
      }
    });

    const totalItems = regionsWithCounts.length;
    const totalPages = Math.ceil(totalItems / limit) || 1;
    const currentPage = Math.max(1, Math.min(page, totalPages));
    const paginatedRegions = regionsWithCounts.slice((currentPage - 1) * limit, currentPage * limit);

    const queryParams = new URLSearchParams();
    if (countryId) queryParams.set('countryId', countryId);
    if (search) queryParams.set('search', search);
    if (sortBy) queryParams.set('sortBy', sortBy);
    if (order) queryParams.set('order', order);
    const queryString = queryParams.toString();

    res.render('Regions/list', {
      regions: paginatedRegions,
      countries,
      selectedCountry: countryId || '',
      totalItems,
      currentPage,
      totalPages,
      filters: {
        search: search || '',
        countryId: countryId || '',
        sortBy,
        order,
      },
      queryString: queryString ? `&${queryString}` : '',
    });
  } catch (error) {
    console.error('Lỗi khi lấy danh sách vùng miền:', error);
    res.status(500).send('Lỗi khi lấy danh sách vùng miền: ' + error.message);
  }
};

// GET: API lấy danh sách vùng miền theo Quốc gia (JSON)
const getRegionsByCountry = async (req, res) => {
  try {
    const { countryId } = req.params;
    const filter = { isActive: true };
    if (countryId && countryId !== 'all') {
      filter.country = countryId;
    }
    const regions = await Region.find(filter).populate('country').sort({ name: 1 });
    res.json(regions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// POST: Tạo vùng miền mới
const createRegion = async (req, res) => {
  try {
    const { name, country, description } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).send('Tên vùng miền không được để trống.');
    }
    if (!country) {
      return res.status(400).send('Vui lòng chọn quốc gia trực thuộc.');
    }

    await Region.create({
      name: name.trim(),
      country,
      description: description ? description.trim() : '',
    });

    res.redirect('/admin/regions');
  } catch (error) {
    console.error('Lỗi khi tạo vùng miền:', error);
    res.status(400).send('Lỗi khi tạo vùng miền: ' + error.message);
  }
};

// POST: Cập nhật vùng miền
const updateRegion = async (req, res) => {
  try {
    const { name, country, description, isActive } = req.body;
    await Region.findByIdAndUpdate(req.params.id, {
      name: name ? name.trim() : '',
      country,
      description: description ? description.trim() : '',
      isActive: isActive === 'on' || isActive === true || isActive === 'true',
    });

    res.redirect('/admin/regions');
  } catch (error) {
    console.error('Lỗi khi cập nhật vùng miền:', error);
    res.status(400).send('Lỗi khi cập nhật vùng miền: ' + error.message);
  }
};

// POST: Xóa vùng miền
const deleteRegion = async (req, res) => {
  try {
    const regionId = req.params.id;
    const dests = await Destination.find({ region: regionId }).select('_id');
    const destIds = dests.map(d => d._id);

    const [destCount, tourCount] = await Promise.all([
      Destination.countDocuments({ region: regionId }),
      Tour.countDocuments({
        $or: [
          { region: regionId },
          { destination: { $in: destIds } }
        ],
        isDeleted: { $ne: true },
      }),
    ]);

    if (destCount > 0 || tourCount > 0) {
      return res.status(400).send('Không thể xóa vùng miền đang chứa các điểm đến hoặc tour du lịch. Vui lòng chuyển hoặc xóa các mục con trước.');
    }

    await Region.findByIdAndDelete(regionId);
    res.redirect('/admin/regions');
  } catch (error) {
    console.error('Lỗi khi xóa vùng miền:', error);
    res.status(500).send('Lỗi khi xóa vùng miền: ' + error.message);
  }
};

module.exports = {
  getAllRegions,
  getRegionsByCountry,
  createRegion,
  updateRegion,
  deleteRegion,
};
