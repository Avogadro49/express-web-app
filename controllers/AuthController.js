const crypto = require("crypto");
const User = require("../models/User");
const ErrorResponse = require("../utils/ErrorResponse");
const asyncMiddleware = require("../middleware/asyncMiddleware");
const sendTokenResponse = require("../utils/sendTokenResponse");
const sendEmail = require("../utils/sendEmail");
const { validate } = require("../models/Course");

class AuthController {
  //? @desc Register User
  //? @route GET /api/v1/auth/register
  //? @access Public
  static register = asyncMiddleware(async (req, res, next) => {
    const { name, email, password, role } = req.body;

    //Create User
    const user = await User.create({
      name,
      email,
      password,
      role,
    });

    //Create token
    sendTokenResponse(user, 201, res);
  });

  //? @desc      Update user details
  //? @route     PUT /api/v1/auth/updatedetails
  //? @access    Private
  static updateDetails = asyncMiddleware(async (req, res, next) => {
    let fieldsToUpdate = {};

    if (req.body.name)
      fieldsToUpdate = { ...fieldsToUpdate, name: req.body.name };
    if (req.body.email)
      fieldsToUpdate = { ...fieldsToUpdate, email: req.body.email };

    if (Object.keys(fieldsToUpdate).length === 0) {
      return res.status(400).json({
        status: false,
        message: "Please provide name or email to update",
      });
    }

    const user = await User.findByIdAndUpdate(req.user.id, fieldsToUpdate, {
      new: true,
      runValidators: true,
    });

    if (!user) {
      return res.status(404).json({
        status: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      status: true,
      data: user,
    });
  });

  //? @desc      Update user password
  //? @route     PUT /api/v1/auth/updatepassword
  //? @access    Private
  static updatePassword = asyncMiddleware(async (req, res, next) => {
    const user = await User.findById(req.user.id).select("+password");

    if (!(await user.matchPassword(req.body.currentPassword))) {
      return next(new ErrorResponse("Password is incorrect", 401));
    }

    user.password = req.body.newPassword;
    await user.save();

    sendTokenResponse(user, 200, res);
  });

  //? @desc Logout User
  //? @route GET /api/v1/auth/logout
  //? @access private
  static logout = asyncMiddleware(async (req, res, next) => {
    res.cookie("token", "none", {
      expires: new Date(Date.now() + 10 * 1000),
      httpOnly: true,
    });

    res.status(200).json({
      status: "success",
      data: {},
    });
  });

  //? @desc Login User
  //? @route GET /api/v1/auth/login
  //? @access Public
  static login = asyncMiddleware(async (req, res, next) => {
    const { email, password } = req.body;

    //Validate Email and Password
    if (!email || !password) {
      return next(
        new ErrorResponse("Please provide an email and password"),
        400
      );
    }

    //Check for user
    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      return next(new ErrorResponse("Invalid credentials", 401));
    }

    //Check if password matches
    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      return next(new ErrorResponse("Invalid credentials", 401));
    }

    sendTokenResponse(user, 200, res);
  });

  //? @desc Forgot password
  //? @route POST /api/v1/auth/forgotpassword
  //? @access Public
  static forgotPassword = asyncMiddleware(async (req, res, next) => {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return next(
        new ErrorResponse(`There is no user with that email of ${email}`, 404)
      );
    }

    //Get reset Token
    const resetToken = user.getResetPasswordToken();

    await user.save({ validateBeforeSave: false });

    //Create reset url
    //prettier-ignore
    const resetUrl = `${req.protocol}://${req.get("host")}/api/v1/auth/resetPassword/${resetToken}`;

    const message = `You are receiving this email because you (or someone else) has requested the reset of a password. Please make a PUT request to: \n\n ${resetUrl}`;

    try {
      await sendEmail({
        email: user.email,
        subject: "Password reset token",
        message,
      });
      res.status(200).json({ success: true, data: "Email send" });
    } catch (err) {
      console.log(err);
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;

      await user.save({ validateBeforeSave: false });

      return next(new ErrorResponse("Email could not be sent", 500));
    }
  });

  //? @desc Reset password
  //? @route POST /api/v1/auth/resetpassword/:resettoken
  //? @access Private
  static resetPassword = asyncMiddleware(async (req, res, next) => {
    //Get Hashed token
    const resetPasswordToken = crypto
      .createHash("sha256")
      .update(req.params.resettoken)
      .digest("hex");

    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      return next(new ErrorResponse("Invalid token", 400));
    }

    //Set new password
    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordToken = undefined;
    await user.save();

    sendTokenResponse(user, 200, res);
  });
}

module.exports = AuthController;
