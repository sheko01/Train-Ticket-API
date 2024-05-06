const crypto = require('crypto');
const { promisify } = require('util');
const jwt = require('jsonwebtoken');
const AppError = require('./../utils/appError');
const catchAsync = require('../utils/catchAsync');
const User = require('./../models/userModel');
const sendEmail = require('../utils/email');

//fn to sign token
const signToken = id => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN
  });
};
//fn to create res instead of write it many times
const createSendToken = (user, statusCode, res) => {
  const token = signToken(user._id);
  //now we will create cookie that will store by browser
  // res.cookie('name of cookie',token,[options])
  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ), //we convert days to milliseconds
    // secure: true, //mean that the cookie will be sent on encrypted connection only 'https'
    httpOnly: true //mean that the cookie can't be accessed or modified in any wayby the browser
  };
  //cuz we don;t https in postman so it will not work if secure:true
  //so w put it in production only
  if (process.env.NODE_ENV === 'production') {
    cookieOptions.secure = true; //mean that the cookie will be sent on encrypted connection only 'https'
  }
  res.cookie('jwt', token, cookieOptions);
  //Remove user password from output but still keep it in database
  user.password = undefined;
  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user
    }
  });
};

//if there is err will be catch by catchAsync() and pass to err middleware
exports.signup = catchAsync(async (req, res, next) => {
  //we do dustructing as new User can't sign up as admin
  const {
    name,
    email,
    password,
    passwordConfirm,
    passwordChangedAt,
    phone,
    role
  } = req.body;

  const newUser = await User.create({
    name,
    email,
    password,
    passwordConfirm,
    passwordChangedAt,
    role,
    phone
  });
  //jwt.sign(payload, secretOrPrivateKey, [options, callback])
  //we store secret in config file=>must be greater than 32 character 'more bigger more secure'
  //we do that to make the User log in after sign up
  // const token = jwt.sign({ id: newUser._id }, process.env.JWT_SECRET, {
  //   expiresIn: process.env.JWT_EXPIRE_IN
  // });
  // const token = signToken(newUser._id);
  // res.status(201).json({
  //   status: 'success',
  //   token,
  //   data: {
  //     User: newUser
  //   }
  // });
  createSendToken(newUser, 201, res);
});
exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;
  // console.log(email, password);
  //1) check if email and password exist
  if (!email || !password) {
    console.log(email);
    console.log(password);
    next(new AppError('Please enter email & password', 404));
  }
  //2) check if user exist and password is correct

  const user = await User.findOne({ email }).select('+password');
  //to check password we can do one of these
  // 1)
  // if (!user) next(new AppError('incorrect email or password!!', 401));
  // console.log(password);
  // const correct = await user.correctPassword(password, user.password);
  // console.log(correct);
  // if (!correct) next(new AppError('incorrect password!!', 401));
  // 2)
  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError('Incoorect email or password', 404));
  }
  // 3)if everything is ok,send token to client
  // const token = signToken(user._id);
  // res.status(200).json({
  //   status: 'success',
  //   token
  // });
  createSendToken(user, 200, res);
});
//middleware fn to check token verification
exports.protect = catchAsync(async (req, res, next) => {
  // 1)Getting token and check of it's there

  //it common practice that we send token in header start with "Bearer"
  //console.log(req.headers); //print headers send with https
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    //here we splite req.headers.authorization to take token not "Bearer"
    token = req.headers.authorization.split(' ')[1];

    // console.log(token);
  }
  if (!token)
    return next(
      new AppError('you are not logged in! Please log in to get access.', 401)
    );
  // 2)Verification token
  //.verify() is async fn if have callback fn in 3rd param but if not it is sync
  //we don't wanna break promise pattern that we follow =>so we can convert this fn to promise using built in fn'promisify' in module 'util'
  // let decoded;
  // jwt.verify(token, process.env.JWT_SECRET, (err, result) => {
  //   decoded = result;
  //   console.log(decoded);
  // });
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
  console.log(decoded);
  // 3)check if user still exist
  const currentUser = await User.findById(decoded.id);
  if (!currentUser) {
    return next(
      new AppError('The token belonging to this user is no longer exist.', 401)
    );
  }
  // 4)check if user changed password after the token was issued
  // const x = currentUser.changedPasswordAfter(decoded.iat);
  // console.log('x', x);
  // if (x) {
  if (currentUser.changedPasswordAfter(decoded.iat)) {
    next(
      new AppError('User recently changed password!, Please log in again!', 401)
    );
  }
  //GRANT ACCESS TO PROTECTED ROUTE
  req.user = currentUser; // so we can use it in next middleware fn
  next();
});
/*
now we want to pass parameter but we can't pass parameter to middleware fn 
so we can wrape fn that return middleware to accept parameters and then call middleware function inside of our route
*/
//this fn check user role
exports.restrictTo = (...roles) => {
  //roles ['admin','lead-guide']
  //we can get data of user from the req.user that we do in the previous middleware
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      next(
        new AppError("You don't have permission to perform this action", 403)
      ); //403 =>forbidden ُمحرَّم
    }
    next();
  };
};
exports.forgotPassword = catchAsync(async (req, res, next) => {
  // 1) Get user based on posted email
  const user = await User.findOne({ email: req.body.email });
  console.log(user);
  if (!user) {
    return next(
      new AppError('There is no user with this email address.!', 404)
    );
  }

  // 2)Generate the random reset token
  //we will create instance method since it isn't related to user controller than mongoose (MVC)
  const resetToken = user.createPasswordResetToken();
  //here we save the modification that we do
  await user.save({ validateBeforeSave: false }); //we disable validation because we pass email only not other required fields
  //
  // 3) Send it to user 's email

  //this is the url that will send to user to reset his password
  //req.protocol=>http or https
  //req.get('host')=>host ip 127.0.0.1
  const resetURL = `${req.protocol}://${req.get(
    'host'
  )}/api/v1/users/resetPassword/${resetToken}`;

  const message = `Forgot your password? submit a patch requset with your new password and passwordConfirm to: ${resetURL}.\nIf you didn't forgot your password ,please ignore this email!`;
  //we use try catch =>Bec if the email failed to send then we have to reassgin the value of {passwordResetToken ,passwordResetExpire} to undefined so the user can retry again
  try {
    await sendEmail({
      email: user.email,
      subject: 'your password reset token (valid for 10 min)',
      message
    });
    res.status(200).json({
      status: 'success',
      message: 'Token sent to email'
    });
  } catch (err) {
    user.passwordResetToken = undefined;
    user.passwordResetExpire = undefined;
    // same as we do after createPasswordResetToken();
    await user.save({ validateBeforeSave: false });
    return next(
      new AppError('There was an error sending the email,Try again later!', 500)
    );
  }
});
exports.resetPassword = catchAsync(async (req, res, next) => {
  // 1) Get user based on the token (the unencrypted that we sent in mail to user)
  //we encrypt the token that we send to the user email to compare them
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');
  // console.log('before hashed token');
  // console.log(hashedToken);
  // here we check if there is user and if the passwordResetExpire is greater than now (mean that it is still valid)
  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() }
  });
  // console.log(user);
  // 2)If token has not expired, and there is user , set the new password
  if (!user) {
    // return next(new AppError('Token is invalid or has expired', 400));
    return next(new AppError('The code is invalid or has expired', 400));
  }
  user.password = req.body.password; //set new password from req body
  user.passwordConfirm = req.body.passwordConfirm; //compare with password field
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  //here we save with validators
  await user.save();
  // 3)Update changedPasswordAt property for the user=>we do that in pre save hook that implemtent in userModel

  // 4)Log the user in , send jwt
  createSendToken(user, 200, res);
});
exports.updatePassword = catchAsync(async (req, res, next) => {
  // 1) Get user form collection (database)
  const user = await User.findById(req.user._id).select('+password');

  // 2) Check if Posted current password is correct
  if (!(await user.correctPassword(req.body.passwordCurrent, user.password))) {
    return next(new AppError('Incorrect Password', 400));
  }
  // 3) If so ,update password
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  //validate again
  // const updatedUser = await user.save();
  await user.save();
  // 4)Log user in, send JWt
  createSendToken(user, 200, res);
});
