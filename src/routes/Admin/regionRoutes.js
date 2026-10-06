const express = require('express');
const router = express.Router();
const regionController = require('../../controllers/Admin/regionController');
const { requireAdmin } = require('../../Middleware/authMiddleware');

router.use(requireAdmin);

router.get('/', regionController.getAllRegions);
router.get('/by-country/:countryId', regionController.getRegionsByCountry);
router.post('/create', regionController.createRegion);
router.post('/edit/:id', regionController.updateRegion);
router.post('/delete/:id', regionController.deleteRegion);

module.exports = router;
