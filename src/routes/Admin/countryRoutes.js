const express = require('express');
const router = express.Router();
const countryController = require('../../controllers/Admin/countryController');
const { requireAdmin } = require('../../Middleware/authMiddleware');

router.use(requireAdmin);

router.get('/', countryController.getAllCountries);
router.get('/api/list', countryController.getCountriesAPI);
router.post('/create', countryController.createCountry);
router.post('/edit/:id', countryController.updateCountry);
router.post('/delete/:id', countryController.deleteCountry);

module.exports = router;
