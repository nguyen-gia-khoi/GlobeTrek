const User = require("../models/User");
const jwt = require("jsonwebtoken"); // Add this import
const axios = require("axios");

const {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendResetSuccessEmail
} = require("../service/mailtrap/email");
const redis = require("../config/redis")
const crypto = require("crypto");
const { PointerStrategy } = require("sso-pointer");
const pointer = new PointerStrategy(
  process.env.POINTER_CLIENT_ID,
  process.env.POINTER_CLIENT_SECRET
);
const PartnerPointer = new PointerStrategy(
  process.env.POINTER_PARTNER_ID,
  process.env.POINTER_PARTNER_SECRET
);
const {
  generateToken,
  storeRefreshToken,
  storeAccessToken,
  removeAccessToken,
  revokeUserTokens,
  PORTAL_ACCESS_TTL_SECONDS,
  SPA_ACCESS_TTL_SECONDS,
  REFRESH_TTL_SECONDS,
} = require("../service/tokenService");
const { setPortalCookie, setRefreshCookie, setOAuthStateCookie, clearAuthCookies, clearCookie } = require("../Middleware/security/cookies");
const { recordAudit } = require("../service/auditService");
const mongoose = require("mongoose");

const signup = async (req, res) => {
  const { email, password, name, phone, phoneNumber, address, dob, dateOfBirth, gender } = req.body;
  const phoneVal = phone || phoneNumber || "";
  const addressVal = address || "";
  const dobVal = dob || dateOfBirth || null;
  const genderVal = gender || "Male";
  const isClient = req.query.client === "true";

  try {
    const userExists = await User.findOne({ email });
    if (userExists) {
      if (isClient) {
        return res.status(400).json({ message: "User already exists" });
      }
      return res.redirect('/api/auth/register?message=' + encodeURIComponent("Email đã được đăng ký trên hệ thống."));
    }
    if (isClient) {
      const verificationCode = Math.floor(100000 + Math.random() * 900000);

      // Corrected redis.set syntax for ioredis
      await redis.set(
        `signup:${email}`,
        JSON.stringify({ 
          password, 
          verificationCode, 
          name, 
          phone: phoneVal, 
          address: addressVal,
          dob: dobVal,
          dateOfBirth: dobVal,
          gender: genderVal
        }),
        'EX', 60 // Set expiration to 60 seconds
      );

      // Send verification email
      await sendVerificationEmail(email, verificationCode);

      res.status(200).json({ message: "Check your email for the OTP" });
    }
    else {
      try {
        const user = await User.create({
          email,
          password,
          name: name || "Đối tác GlobeTrek",
          phone: phoneVal,
          phoneNumber: phoneVal,
          address: addressVal,
          dob: dobVal ? new Date(dobVal) : undefined,
          dateOfBirth: dobVal ? new Date(dobVal) : undefined,
          gender: genderVal,
          role: "partner",
          status: "unverify"
        });

        return res.redirect('/api/auth/login?message=' + encodeURIComponent("Đăng ký thành công! Vui lòng chờ quản trị viên phê duyệt hồ sơ của bạn."));
      } catch (error) {
        console.log("Error in signup controller: ", error.message);
        return res.redirect('/api/auth/register?message=' + encodeURIComponent("Đăng ký thất bại: " + error.message));
      }

    }
  } catch (error) {
    console.log("Error in signup controller: ", error.message);
    if (isClient) {
      return res.status(500).json({ message: "Server Error!", error: error.message });
    }
    return res.redirect('/api/auth/register?message=' + encodeURIComponent("Lỗi máy chủ: " + error.message));
  }
};


const verfiaccount = async (req, res) => {

  const { email, otp } = req.body;
  try {
    const storedData = await redis.get(`signup:${email}`);
    //Lấy data ra check
    if (!storedData) {
      return res.status(400).json({ message: "OTP expired or invalid" });
    }
    const { verificationCode, verificationTokenExpireAt, password, name, phone, address, dob, dateOfBirth, gender } = JSON.parse(storedData);

    if (otp !== verificationCode.toString() || (verificationTokenExpireAt && Date.now() > verificationTokenExpireAt)) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    const dobVal = dob || dateOfBirth || null;

    const user = await User.create({
      email,
      password,
      name: name || "",
      phone: phone || "",
      phoneNumber: phone || "",
      address: address || "",
      dob: dobVal ? new Date(dobVal) : undefined,
      dateOfBirth: dobVal ? new Date(dobVal) : undefined,
      gender: gender || "Male"
    });
    await redis.del(`signup:${email}`);

    const { accessToken, refreshToken } = generateToken(user._id);

    setRefreshCookie(res, refreshToken, REFRESH_TTL_SECONDS * 1000);
    await storeRefreshToken(user._id, refreshToken);
    await storeAccessToken(user._id, accessToken, SPA_ACCESS_TTL_SECONDS);
    
    const { password: userPassword, ...userDetails } = user._doc;
    res.status(200).json({
      ...userDetails,
      accessToken: accessToken,
      message: "Email verified and user created successfully",
    });

  } catch (error) {
    console.log("Error in login controller: ", error.message);
    res.status(500).json({ message: "Server Error!", error: error.message });
  }
}

const signin = async (req, res) => {
  const { email, password } = req.body;
  const isClient = req.query.client === "true"; // Determines if the request is client-rendered

  try {
    const user = await User.findOne({ email });

    if (user && (await user.comparePassword(password))) {
      // Check if user is a partner and not verified&& !user.verified

      const { accessToken, refreshToken } = generateToken(user._id);

      if (user.UserStatus === "ban") {

        return res.status(400).json({ message: "Your account has been banned. Please contact support." }); // Send error message to client

      }
      else if (isClient && user.UserStatus === "unban") {
        // For client-rendered (e.g., SPA) requests
        await storeRefreshToken(user._id, refreshToken);
        await storeAccessToken(user._id, accessToken, SPA_ACCESS_TTL_SECONDS);
        setRefreshCookie(res, refreshToken, REFRESH_TTL_SECONDS * 1000);

        const { password, ...userDetails } = user._doc; // Exclude password from response
        return res.status(200).json({ ...userDetails, accessToken });
      }

      else {
        // For server-rendered (admin or verified partner) requests
        if (user.role === "admin" || (user.role === "partner" && user.status === "verified")) {
          const area = user.role === "admin" ? "admin" : "partner";
          const accessToken = jwt.sign(
            { userId: user._id, email },
            process.env.ACCESS_TOKEN_SECRET,
            { expiresIn: PORTAL_ACCESS_TTL_SECONDS }
          );
          await storeAccessToken(user._id, accessToken, PORTAL_ACCESS_TTL_SECONDS);
          setPortalCookie(res, area, accessToken, PORTAL_ACCESS_TTL_SECONDS * 1000);
          return res.redirect(area === "admin" ? "/home" : "/homePartner");
        }
        const message = "Your account has not been verified by an admin. Please wait for approval.";
        return res.render('Authen/login', { message });
      }
    } else {
      // Invalid email or password
      const message = "Invalid email or password";

      if (isClient) {
        return res.status(400).json({ message });
      } else {
        return res.render('Authen/login', { message });
      }
    }
  } catch (error) {
    const message = "Server Error!";
    if (isClient) {
      return res.status(500).json({ message, error: error.message });
    } else {
      return res.render('Authen/login', { message });
    }
  }
};

const signout = async (req, res) => {
  try {
    const tokens = [
      req.cookies.AdminaccessToken,
      req.cookies.PartneraccessToken,
      req.headers.authorization ? req.headers.authorization.split(" ")[1] : null,
    ].filter(Boolean);
    const refreshToken = req.cookies.refreshToken;

    if (refreshToken) {
      try {
        const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
        await revokeUserTokens(decoded.userId);
      } catch (error) {
        await redis.del(`refresh_token:${refreshToken}`);
      }
    }

    for (const token of tokens) {
      try {
        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        await revokeUserTokens(decoded.userId);
      } catch (error) {
        continue;
      }
    }

    clearAuthCookies(res);
    if (req.headers.accept && req.headers.accept.includes('application/json') && !req.headers.accept.includes('text/html')) {
      return res.status(200).json({ message: "Logged out successfully" });
    }
    return res.redirect("/api/auth/login");
  } catch (error) {
    console.error("Error in signout:", error.message);
    return res.status(500).json({ message: "Server Error!", error: error.message });
  }
};

const forgotPassword = async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ success: false, message: "User not found" });
    }

    const resetToken = crypto.randomBytes(20).toString("hex");

    await redis.set(
      `resetpassword:${resetToken}`,
      JSON.stringify({ userId: user._id, resetToken }),
      "EX",
      5 * 60
    );

    await sendPasswordResetEmail(user.email, `${process.env.CLIENT_URL}/reset-password/${resetToken}`);
    res.status(200).json({ success: true, message: "Password reset link sent to your email" });
  } catch (error) {
    console.log("Error in forgotPassword", error);
    res.status(500).json({ success: false, message: error.message });
  }
}

const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    const userData = await redis.get(`resetpassword:${token}`);

    if (!userData) {
      return res.status(400).json({ success: false, message: "Invalid or expired reset token" });
    }

    const parsedData = JSON.parse(userData);
    const { userId } = parsedData;
    if (!userId) {
      return res.status(500).json({ success: false, message: "userId not found in Redis data" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    user.password = password;
    await user.save();
    await redis.del(`resetpassword:${token}`);
    await revokeUserTokens(user._id);
    clearAuthCookies(res);

    await sendResetSuccessEmail(user.email);
    return res.status(200).json({ success: true, message: "Password reset successful" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

const refreshToken = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({ message: "No refresh token provided" });
    }

    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    const storedToken = await redis.get(`refresh_token:${decoded.userId}`);

    if (!storedToken || storedToken !== refreshToken) {
      if (decoded.userId) await revokeUserTokens(decoded.userId);
      clearCookie(res, "refreshToken");
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    const accessToken = jwt.sign(
      { userId: decoded.userId },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: SPA_ACCESS_TTL_SECONDS }
    );
    const newRefreshToken = jwt.sign(
      { userId: decoded.userId },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: REFRESH_TTL_SECONDS }
    );
    await storeRefreshToken(decoded.userId, newRefreshToken);
    await storeAccessToken(decoded.userId, accessToken, SPA_ACCESS_TTL_SECONDS);
    setRefreshCookie(res, newRefreshToken, REFRESH_TTL_SECONDS * 1000);
    res
      .status(200)
      .json({ accessToken, message: "Token refreshed successfully" });
  } catch (error) {
    console.log("Error in refreshToken", error);
    res.status(500).json({ message: "Server Error!", error: error.message });
  }
};

const checkEmail = async (req, res) => {
  const { email } = req.body;
  try {
    // Query the database to check if the email exists
    const user = await User.findOne({ email });  // Assuming you're using MongoDB with Mongoose

    if (user) {
      return res.json({ exists: true });  // Email is already registered
    } else {
      return res.json({ exists: false }); // Email is not registered
    }
  } catch (error) {
    console.error("Error checking email:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
const oauthStateMatches = (req, res) => {
  const state = String(req.query.state || '');
  const cookie = String(req.cookies.oauth_state || '');
  if (!state || !cookie || state !== cookie) return false;
  clearCookie(res, 'oauth_state');
  return true;
};

const Partner_callback = async (req, res) => {
  try {
    if (!oauthStateMatches(req, res)) {
      return res.status(400).json({ message: 'OAuth state không hợp lệ' });
    }
    const { code } = req.query;
    if (!code) return res.status(400).json({ message: 'Authorization code is required' });

    const accessTokenData = await PartnerPointer.getAccessToken(code);
    const email = accessTokenData?.user?.email;
    if (!email) return res.status(400).json({ message: 'Không nhận được email đối tác' });

    let user = await User.findOne({ email });
    if (!user) {
      user = await new User({ email, role: 'partner', status: 'unverify' }).save();
    }
    if (user.UserStatus === 'ban' || user.status !== 'verified' || user.role !== 'partner') {
      return res.redirect('/api/auth/login?message=' + encodeURIComponent('Tài khoản đối tác chưa được phê duyệt.'));
    }

    const accessToken = jwt.sign(
      { userId: user._id, email },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: PORTAL_ACCESS_TTL_SECONDS }
    );
    await storeAccessToken(user._id, accessToken, PORTAL_ACCESS_TTL_SECONDS);
    setPortalCookie(res, 'partner', accessToken, PORTAL_ACCESS_TTL_SECONDS * 1000);
    return res.redirect('/homePartner');
  } catch (error) {
    console.error('Error in partner callback:', error.message);
    return res.status(500).json({ message: 'Server Error' });
  }
};
const CheckSSO = async (req, res) => {
  try {
    const token = req.cookies.PartneraccessToken;
    if (token && !req.cookies.AdminaccessToken) {
      try {
        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        const stored = await redis.get(`access_token:${decoded.userId}`);
        const user = await User.findById(decoded.userId).select('role status UserStatus');
        if (
          stored === token
          && user
          && user.role === 'partner'
          && user.status === 'verified'
          && user.UserStatus !== 'ban'
        ) {
          return res.redirect('/partner/revenue');
        }
      } catch (error) {
        clearCookie(res, 'PartneraccessToken');
      }
    }

    const state = crypto.randomBytes(16).toString('hex');
    setOAuthStateCookie(res, state);
    const clientId = process.env.POINTER_PARTNER_ID || '';
    const authorizeUrl = process.env.POINTER_SSO_URL || 'https://sso-pointer.vercel.app/authorize';
    return res.redirect(`${authorizeUrl}?clientId=${encodeURIComponent(clientId)}&state=${state}`);
  } catch (error) {
    console.error('Error in CheckSSO:', error.message);
    return res.status(500).json({ message: 'Server Error' });
  }
}
const callback = async (req, res) => {
  try {
    const { code, state } = req.query;
    if ((state || req.cookies.oauth_state) && !oauthStateMatches(req, res)) {
      return res.status(400).json({ message: 'OAuth state không hợp lệ' });
    }
    if (!code) {
      return res.status(400).json({ message: "Authorization code is required" });
    }

    const accessTokenData = await pointer.getAccessToken(code);
    const email = accessTokenData?.user?.email;

    if (!email) {
      return res.status(400).json({ message: "User ID and email are required" });
    }

    // Find or create the user in the database
    let dbUser = await User.findOne({ email });
    if (!dbUser) {
      dbUser = new User({ email });
      await dbUser.save();
    }
    if (dbUser.UserStatus === 'ban') {
      return res.status(403).json({ message: 'Tài khoản đã bị khóa' });
    }
    const userId = dbUser._id;
    const jwtToken = jwt.sign({ userId, email }, process.env.ACCESS_TOKEN_SECRET, {
      expiresIn: SPA_ACCESS_TTL_SECONDS,
    });
    await storeAccessToken(userId, jwtToken, SPA_ACCESS_TTL_SECONDS);
    const { password, ...userDetails } = dbUser._doc;

    return res.status(200).json({
      ...userDetails, // Include all user details except the password
      accessToken: jwtToken, // Add the generated JWT token
    });
  } catch (error) {
    console.error("Error in callback:", error.message);
    return res.status(500).json({ message: "Server Error" });
  }
};


const getLoginPage = (req, res) => {
  const message = req.query.message || ''; // Retrieve any error message from the query params
  res.render('Authen/Login', { message });
};
const getRegisterPage = (req, res) => {
  const message = req.query.message || ''; // Retrieve any error message from the query params
  res.render('Authen/Register', { message });
};

const getHomePage = async (req, res) => {
  try {
    const unverifiedPartners = await User.find({ role: 'partner', status: 'unverify' });
    res.render('home', {
      pageTitle: 'Home',
      unverifiedPartners
    });
  } catch (error) {
    console.error("Error fetching unverified partners:", error);
    res.status(500).send("Server error");
  }
};
const getUnverifiedPartners = async (req, res) => {
  try {
    const unverifiedPartners = await User.find({ role: 'partner', status: 'unverify' });
    res.render('home', { unverifiedPartners });
  } catch (error) {
    console.error("Error fetching unverified partners:", error);
    res.status(500).send("Server Error");
  }
};

const getHomePartnerPage = (req, res) => {
  const message = req.query.message || ''; // Retrieve any error message from the query params
  const pageTitle = 'homePartner'; // Set a default page title
  res.render('homePartner', { message, pageTitle }); // Pass the pageTitle to the view
};



// Verify or decline a partner
const verifyPartner = async (req, res) => {
  const { partnerId, action } = req.body;
  try {
    if (!['accept', 'decline'].includes(action) || !mongoose.Types.ObjectId.isValid(partnerId)) {
      return res.status(400).send('Yêu cầu không hợp lệ');
    }
    const partner = await User.findById(partnerId);
    if (!partner || partner.role !== 'partner') return res.status(404).send('Không tìm thấy đối tác');

    if (action === 'accept') {
      partner.status = 'verified';
      partner.UserStatus = 'unban';
    } else {
      partner.status = 'unverify';
      partner.UserStatus = 'ban';
      await revokeUserTokens(partner._id);
    }
    await partner.save();
    await recordAudit(req, action === 'accept' ? 'partner.verify' : 'partner.decline', {
      type: 'User',
      id: partner._id,
    });
    return res.redirect('/home');
  } catch (error) {
    console.error('Error updating partner status:', error.message);
    return res.status(500).send('Server Error');
  }
};
const gePartners = async (req, res) => {
  try {
    const verifiedPartners = await User.find({ role: 'partner', status: 'verified' });
    res.render('User/viewPartner', { pageTitle: 'viewPartner', verifiedPartners });
  } catch (error) {
    console.error("Error fetching unverified partners:", error);
    res.status(500).send("Server Error");
  }
};
const getUser = async (req, res) => {
  try {
    const users = await User.find({ role: 'user' });
    const BAN_THRESHOLD = 100; // Set the cancellation count threshold for auto-ban
    for (let currentUser of users) {
      // Check if the user meets the ban threshold and is not already banned
      if (currentUser.cancellationCount >= BAN_THRESHOLD && currentUser.UserStatus !== 'ban') {
        currentUser.UserStatus = 'ban';
        await currentUser.save();
        await revokeUserTokens(currentUser._id);
        await recordAudit(req, 'user.autoban', { type: 'User', id: currentUser._id });
      }
    }
    res.render('User/viewUser', { pageTitle: 'viewUser', users });
  } catch (error) {
    console.error("Error fetching unverified partners:", error);
    res.status(500).send("Server Error");
  }
};
const banPartner = async (req, res) => {
  const { partnerId } = req.body;
  try {
    if (!mongoose.Types.ObjectId.isValid(partnerId) || String(partnerId) === String(req.user._id)) {
      return res.status(400).send('Không thể khóa tài khoản này');
    }
    const partner = await User.findById(partnerId);
    if (!partner || partner.role !== 'partner') return res.status(404).send('Không tìm thấy đối tác');
    partner.status = 'unverify';
    partner.UserStatus = 'ban';
    await partner.save();
    await revokeUserTokens(partner._id);
    await recordAudit(req, 'partner.ban', { type: 'User', id: partner._id });
    return res.redirect('/admin/partners');
  } catch (error) {
    console.error('Error banning partners:', error.message);
    return res.status(500).send('Server Error');
  }
};
const banAndUnbanUser = async (req, res) => {
  const { userId, action } = req.body;
  try {
    if (!['ban', 'unban'].includes(action) || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).send('Yêu cầu không hợp lệ');
    }
    if (String(userId) === String(req.user._id)) return res.status(400).send('Không thể tự khóa tài khoản quản trị');
    const target = await User.findById(userId);
    if (!target || target.role !== 'user') return res.status(404).send('Không tìm thấy người dùng');
    target.UserStatus = action === 'ban' ? 'ban' : 'unban';
    await target.save();
    if (action === 'ban') await revokeUserTokens(target._id);
    await recordAudit(req, action === 'ban' ? 'user.ban' : 'user.unban', { type: 'User', id: target._id });
    return res.redirect('/admin/users');
  } catch (error) {
    console.error('Error updating user status:', error.message);
    return res.status(500).send('Server Error');
  }
};

const updateProfile = async (req, res) => {
  try {
    const userId = req.user._id;

    const {
      name,
      fullName,
      profileName,
      phone,
      phoneNumber,
      address,
      city,
      gender,
      dob,
      dateOfBirth,
      birthDate,
      birthYear,
      birthMonth,
      birthDay,
    } = req.body;

    const updateData = {};
    if (name !== undefined || fullName !== undefined) {
      updateData.name = (name || fullName || "").trim();
    }
    if (phone !== undefined || phoneNumber !== undefined) {
      const p = (phone || phoneNumber || "").trim();
      updateData.phone = p;
      updateData.phoneNumber = p;
    }
    if (address !== undefined || city !== undefined) {
      updateData.address = (address || city || "").trim();
    }
    if (gender !== undefined) {
      updateData.gender = gender;
    }

    // Process Date of birth
    let parsedDob = null;
    if (dob) {
      parsedDob = new Date(dob);
    } else if (dateOfBirth) {
      parsedDob = new Date(dateOfBirth);
    } else if (birthDate) {
      parsedDob = new Date(birthDate);
    } else if (birthYear && birthMonth && birthDay) {
      parsedDob = new Date(`${birthYear}-${String(birthMonth).padStart(2, '0')}-${String(birthDay).padStart(2, '0')}`);
    }

    if (parsedDob && !isNaN(parsedDob.getTime())) {
      updateData.dob = parsedDob;
      updateData.dateOfBirth = parsedDob;
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select("-password");

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({
      message: "Cập nhật hồ sơ thành công",
      user: updatedUser,
      ...updatedUser._doc,
    });
  } catch (error) {
    console.error("Error in updateProfile:", error);
    return res.status(500).json({ message: "Server Error!", error: error.message });
  }
};

module.exports = {
  signup,
  signin,
  verfiaccount,
  signout,
  refreshToken,
  forgotPassword,
  resetPassword,
  checkEmail,
  callback,
  getLoginPage,
  getRegisterPage,
  getHomePage,
  getHomePartnerPage,
  getUnverifiedPartners,
  verifyPartner,
  gePartners,
  getUser,
  banPartner,
  banAndUnbanUser,
  Partner_callback,
  CheckSSO,
  updateProfile,
}