//here we will add user data update and related routes
const AppError = require('./../utils/appError');
const catchAsync = require('../utils/catchAsync');
const User = require('./../models/userModel');

//fn to filter req.body with allowed fields to security or avoid hack
const filterObj = (obj, ...allowedFields) => {
  const newObj = {};
  // Object.keys(obj)=> returns an array of all the properties in obj object
  Object.keys(obj).forEach(el => {
    // if we find field in allowedFilds array we add it to newObj
    if (allowedFields.includes(el)) newObj[el] = obj[el];
  });
  return newObj;
};

exports.getAllUsers = catchAsync(async (req, res) => {
  const users = await User.find();
  res.status(500).json({
    status: 'success',
    result: users.length,
    data: {
      users
    }
  });
});
exports.getUser = catchAsync(async (req, res, next) => {
  if (!req.params.id) {
    return next(new AppError('invalid request'), 404);
  }
  const user = await User.findById(req.params.id).populate('booked');
  res.status(200).json({
    status: 'success',
    data: {
      user
    }
  });
});
exports.createUser = (req, res) => {
  res.status(500).json({
    status: 'error',
    message: 'This route is not yet defined!'
  });
};
exports.updateUser = (req, res) => {
  res.status(500).json({
    status: 'error',
    message: 'This route is not yet defined!'
  });
};
exports.deleteUser = (req, res) => {
  res.status(500).json({
    status: 'error',
    message: 'This route is not yet defined!'
  });
};
exports.updateMe = catchAsync(async (req, res, next) => {
  // 1)Create error if user POSTs password data
  if (req.body.password || req.body.passwordConfirm) {
    return next(
      new AppError(
        "This route isn't for password updates. please use /updateMyPassword",
        400
      )
    );
  }
  // 2)Filtered out unwanted fields names that are not allowed to be updated
  const filterBody = filterObj(req.body, 'name', 'email', 'booked');
  //  3)Update user document in the database
  const updatedUser = await User.findByIdAndUpdate(req.user.id, filterBody, {
    new: true, //to return new user after update instead of old one
    runValidators: true //to run validatores for fields
  }).populate('booked');
  res.status(200).json({
    status: 'success',
    data: updatedUser
  });
});
//this fn will deactivate user account work as delete
exports.deleteMe = catchAsync(async (req, res, next) => {
  await User.findByIdAndUpdate(req.user.id, { active: false });
  res.status(204).json({
    //204=> mean deleted
    status: 'success',
    data: null
  });
});

exports.myTours = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user);
  res.status(200).json({
    status: 'success',
    data: {
      tours: user.booked
    }
  });
});
exports.addTour = catchAsync(async (req, res, next) => {
  if (!req.params.id) {
    return next(AppError('there is no tour id'), 404);
  }
  const user = await User.findById(req.user);
  const responseObject = JSON.parse(JSON.stringify(user));
  // const booked = responseObject.booked.add(req.params.id);
  const booked = [req.params.id, ...responseObject.booked];
  const result = await User.findByIdAndUpdate(
    req.user,
    { booked: booked },
    {
      new: true
    }
  );
  // console.log(booked);
  res.status(200).json({
    status: 'success',
    results: booked.length,
    data: {
      // tours: updatedBooked
      result
    }
  });
});
exports.removeTour = catchAsync(async (req, res, next) => {
  if (!req.params.id) {
    return next(AppError('there is no tour id'), 404);
  }

  const user = await User.findById(req.user);
  const responseObject = JSON.parse(JSON.stringify(user));

  const updatedBooked = responseObject.booked.filter(
    tour => tour._id !== req.params.id
  );

  await User.findByIdAndUpdate(req.user, { booked: updatedBooked });

  console.log('Tour deleted successfully.');
  res.status(200).json({
    status: 'success',
    data: {
      // tours: updatedBooked
    }
  });
});
