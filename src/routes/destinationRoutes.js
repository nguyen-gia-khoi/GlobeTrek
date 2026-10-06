const express = require('express');
const router = express.Router();
const destinationController = require('../controllers/Admin/destinationController');

// Public API endpoints for Client (không yêu cầu verifyAdmin)
router.get('/', destinationController.getAllDestinationsAPI); // GET /destinations
router.get('/api', destinationController.getAllDestinationsAPI); // GET /destinations/api
router.get('/api/:id', destinationController.getDestinationByIdAPI); // GET /destinations/api/:id
router.get('/:id', destinationController.getDestinationByIdAPI); // GET /destinations/:id

module.exports = router;
