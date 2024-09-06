const express = require('express');
const { getHomepage, postCreateAdmin, getCreatePage, getUpdateAdmin, postUpdateAdmin, postDeleteAdmin, postHandleRemoveAdmin } = require('../controllers/homeController');
const { getCreateTourType, postCreateTourType, getUpdateTourType, postUpdateTourType, postDeleteTourType, postHandleRemoveTourType } = require('../controllers/tourtypeController')
const { getCreateTour, postCreateTour, getUpdateTour,postUpdateTour } = require('../controllers/tourController')
const { getCreatePartner, postCreatePartner, getUpdatePartner, postUpdatePartner, postDeletePartner, postHandleRemovePartner } = require('../controllers/partnerController')
const { getCreateDestination, postCreateDestination, getUpdateDestination, postUpdateDestination, postDeleteDestination, postHandleRemoveDestination } = require('../controllers/destinationController')
const router = express.Router();

//config route
router.get('/', getHomepage);
//admin
router.get('/create_admin', getCreatePage);
router.post('/create-user', postCreateAdmin);
router.get('/update_Admin/:id', getUpdateAdmin)
router.post('/update_admin', postUpdateAdmin)
router.post('/delete_admin/:id', postDeleteAdmin)
router.post('/delete_admin', postHandleRemoveAdmin)
//tourtype
router.get('/create_tourtype', getCreateTourType);
router.post('/create_tourtype', postCreateTourType);
router.get('/update_TourType/:id', getUpdateTourType)
router.post('/update_tourtype', postUpdateTourType)
router.post('/delete_tourtype/:id', postDeleteTourType)
router.post('/delete_tourtype', postHandleRemoveTourType)
//Tour
router.get('/create_tour', getCreateTour);
router.post('/create_tour', postCreateTour)
router.get('/update_tour/:id', getUpdateTour)
router.post('/update_tour',postUpdateTour)
//Destination
router.get('/create_destination', getCreateDestination)
router.post('/create_destination', postCreateDestination)
router.get('/update_Destination/:id', getUpdateDestination)
router.post('/update_destination', postUpdateDestination)
router.post('/delete_destination/:id', postDeleteDestination)
router.post('/delete_destination', postHandleRemoveDestination)

//Partner
router.get('/create_partner', getCreatePartner)
router.post('/create_partner', postCreatePartner)
router.get('/update_partner/:id', getUpdatePartner)
router.post('/update_partner', postUpdatePartner)
router.post('/delete_partner/:id', postDeletePartner)
router.post('/delete_partner', postHandleRemovePartner)



module.exports = router;
