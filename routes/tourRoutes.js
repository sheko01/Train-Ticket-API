const express = require('express');
const tourController = require('./../controllers/tourController');
const authConrtoller = require('./../controllers/authController');

const router = express.Router();

// router.param('id', tourController.checkID);

router
  .route('/top-5-cheap')
  .get(tourController.aliasTopTours, tourController.getAllTours);

router.route('/tours-status').get(tourController.getTourStats);
router.route('/monthlyPlan/:year').get(tourController.getMonthlyPlan);

router
  .route('/')
  .get(authConrtoller.protect, tourController.getAllTours) //now we wil add authuraization before give user access to see all tours
  .post(tourController.createTour);

router
  .route('/:id')
  .get(tourController.getTour)
  .patch(tourController.updateTour)
  .delete(
    authConrtoller.protect,
    authConrtoller.restrictTo('admin', 'lead-guide'),
    tourController.deleteTour
  );

module.exports = router;
