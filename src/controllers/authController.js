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
);const {
    generateToken,
    storeRefreshToken,
  } = require("../service/tokenService")

const signup = async (req, res) => {
    const { email, password,name} = req.body;
    const isClient = req.query.client === "true";

    try {
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ message: "User already exists" });
        }
        if(isClient){
           const verificationCode = Math.floor(100000 + Math.random() * 900000);

        // Corrected redis.set syntax for ioredis
        await redis.set(
            `signup:${email}`,
            JSON.stringify({ password, verificationCode }),
            'EX', 60 // Set expiration to 60 seconds
        );

        // Send verification email
        await sendVerificationEmail(email, verificationCode);

        res.status(200).json({ message: "Check your email for the OTP" });
        }
        else {
          try {
            const user = await User.create({ email, password,name,role:"partner"});

          const PartneraccessToken = jwt.sign({ userId: user._id, email }, process.env.ACCESS_TOKEN_SECRET, {
            expiresIn: "1d",
          });
          res.cookie("PartneraccessToken", PartneraccessToken, {
            httpOnly: true,
            sameSite: "strict",
            maxAge: 1 * 60 * 60 * 1000,
            secure: process.env.NODE_ENV === "production",
          });

          return res.redirect('/api/auth/login'); // Use redirect instead of render
          } catch (error) {
            console.log("Error in signup controller: ", error.message);

          }
          
        }
    } catch (error) {
        console.log("Error in signup controller: ", error.message);
        res.status(500).json({ message: "Server Error!", error: error.message });
    }
};


const verfiaccount = async(req,res)=>{
    
    const { email, otp } = req.body;
    try {
        const storedData = await redis.get(`signup:${email}`);
        //Lấy data ra check
        if (!storedData) {
            return res.status(400).json({ message: "OTP expired or invalid" });
        }
        const { verificationCode, verificationTokenExpireAt,password } = JSON.parse(storedData);
        
        if (otp !== verificationCode.toString()|| Date.now() > verificationTokenExpireAt) {
            return res.status(400).json({ message: "Invalid OTP" });
          }

        const user = await User.create({ email, password });
        await redis.del(`signup:${email}`);

        const { accessToken, refreshToken } = generateToken(user._id);

        res.cookie("refreshToken", refreshToken, {
            httpOnly: true,
            sameSite: "strict",
            maxAge: 7 * 24 * 60 * 60 * 1000,
            secure: process.env.NODE_ENV === "production",
        });
          await storeRefreshToken(user._id, refreshToken);
          res.status(200).json({
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
      
      if(user.UserStatus === "ban"){
       
        return res.status(400).json({ message:"Your account has been banned. Please contact support." }); // Send error message to client
        
      }
      else if (isClient && user.UserStatus === "unban") {
        // For client-rendered (e.g., SPA) requests
        res.cookie("refreshToken", refreshToken, {
          httpOnly: true,
          sameSite: "strict",
          maxAge: 7 * 24 * 60 * 60 * 1000,
          secure: process.env.NODE_ENV === "production",
        });
        await storeRefreshToken(user._id, refreshToken);

        const { password, ...userDetails } = user._doc; // Exclude password from response
        return res.status(200).json({ ...userDetails, accessToken });
      } 
      
      else {
        // For server-rendered (admin or verified partner) requests
        if (user.role === "admin") {
          const AdminaccessToken = jwt.sign({ userId: user._id, email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "1d" });
          res.cookie("AdminaccessToken", AdminaccessToken, {
            httpOnly: true,
            sameSite: "strict",
            maxAge: 1 * 60 * 60 * 1000,
            secure: process.env.NODE_ENV === "production",
          });
          return res.redirect('/home');
        } else if (user.role === "partner"&&user.status ==="verified" ) {
          const PartneraccessToken = jwt.sign({ userId: user._id, email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "1d" });
          res.cookie("PartneraccessToken", PartneraccessToken, {
            httpOnly: true,
            sameSite: "strict",
            maxAge: 1 * 60 * 60 * 1000,
            secure: process.env.NODE_ENV === "production",
          });
          return res.redirect('/homePartner');
        }else {
          const message = "Your account has not been verified by an admin. Please wait for approval.";
          return res.render('Authen/login', { message }); // Render login page with message
        }
        
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


const signout = async( req, res ) => {
    try {
        console.log("Cookies received:", req.cookies); // Log received cookies
        const refreshToken = req.cookies.refreshToken;
        if (refreshToken) {
          const decoded = jwt.verify(
            refreshToken,
            process.env.REFRESH_TOKEN_SECRET
          );
          await redis.del(`refresh_token:${decoded.userId}`);
        }
        res.clearCookie("refreshToken");
        res.status(200).json({ message: "Logged out successfully" });
    } catch (error) {
        console.log("Error in login controller: ", error.message);
        res.status(500).json({ message: "Server Error!", error: error.message });
    }
}
const forgotPassword = async(req,res)=>{
    const { email } = req.body;
    try {
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(400).json({ success: false, message: "User not found" });
        }

        const resetToken = crypto.randomBytes(20).toString("hex");

        await redis.set(
        `resetpassword:${resetToken}`,
        JSON.stringify({ userId: user._id,resetToken }),  
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

const resetPassword = async(req,res)=>{
    try {
        const { token } = req.params;  
        const { password } = req.body;  
        
        const userData = await redis.get(`resetpassword:${token}`);
        console.log("Redis data:", userData);  
       
        if (!userData) {
          return res.status(400).json({ success: false, message: "Invalid or expired reset token" });
        }
    
        const parsedData = JSON.parse(userData);
        console.log("Parsed data:", parsedData);  
    
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
  
      if (storedToken !== refreshToken) {
        return res.status(401).json({ message: "Invalid refresh token" });
      }
  
      const accessToken = jwt.sign(
        { userId: decoded.userId },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: "15m" }
      );
      const newRefreshToken = jwt.sign(
        { userId: decoded.userId },
        process.env.REFRESH_TOKEN_SECRET
      );
      await storeRefreshToken(decoded.userId, newRefreshToken);
      res.cookie("refreshToken", newRefreshToken, {
        httpOnly: true,
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000,
        secure: process.env.NODE_ENV === "production",
      });
      res
        .status(200)
        .json({ accessToken, message: "Token refreshed successfully" });
    } catch (error) {
      console.log("Error in refreshToken", error);
      res.status(500).json({ message: "Server Error!", error: error.message });
    }
  };
  
const checkEmail = async(req,res)=>{
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
const callback = async (req, res) => {
  try {
    const { code } = req.query;
    console.log("Received code:", code);

    // Exchange the authorization code for an access token
    const accessTokenData = await pointer.getAccessToken(code);
  
    const {user: { email } } = accessTokenData;
    console.log("Access Token Data:", accessTokenData);

    if (!email) {
      return res.status(400).json({ message: "User ID and email are required" });
    }

    // Find or create user
    let user = await User.findOne({ email });
    if (!user) {
      user = await new User({ email }).save();
      console.log("New user created:", user);
    } else {
      user.email = email;
      await user.save();
      console.log("User already exists and was updated:", user );
    }
    const userId = user._id
    // Generate JWT
    const accessToken = jwt.sign({ userId, email}, process.env.ACCESS_TOKEN_SECRET, {
      expiresIn: "1h",
    });

    // Respond with user data
    return res.json({
      login: true,
      role: user.role,
      _id: user._id,
      email: user.email,
      accessToken,
    });
  } catch (error) {
    console.error("Error in callback:", error);  // Log full error object
    return res.status(500).json({ message: "Server Error", error: error.message });
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
  
  console.log(action)
  try {
    if (action === "accept") {
      await User.findByIdAndUpdate(partnerId, { status: 'verified' });
    } else if (action === "decline") {
      await User.findByIdAndDelete(partnerId);
    }
    res.redirect('/home'); // Redirect to refresh the list
  } catch (error) {
    console.error("Error updating partner status:", error);
    res.status(500).send("Server Error");
  }
};
const gePartners = async (req, res) => {
  try {
    const verifiedPartners = await User.find({ role: 'partner', status: 'verified' });
    res.render('User/viewPartner', {pageTitle: 'viewPartner', verifiedPartners });
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
      if (currentUser.cancellationCount >= BAN_THRESHOLD && currentUser.UserStatus == 'ban') {
        // If not banned, automatically ban the user
        await User.findByIdAndUpdate(currentUser._id, { UserStatus: 'ban' });
      }
    }
    res.render('User/viewUser', { pageTitle: 'viewUser',users });
  } catch (error) {
    console.error("Error fetching unverified partners:", error);
    res.status(500).send("Server Error");
  }
};
const banPartner = async(req,res)=>{
  const { partnerId, action } = req.body;
  try {
    await User.findByIdAndUpdate(partnerId, { status: 'unverify' });
    res.redirect('/admin/partners');
  } catch (error) {
    console.error("Error banning partners:", error);
    res.status(500).send("Server Error");
  }
}
const banAndUnbanUser = async(req,res)=>{
  const { userId, action } = req.body;
  try {
    if (action === "ban") {
      await User.findByIdAndUpdate(userId, { UserStatus: 'ban' });
    } else if (action === "unban") {
      await User.findByIdAndUpdate(userId, { UserStatus: 'unban' });
    }
    res.redirect('/admin/users'); // Redirect to refresh the list
  } catch (error) {
    console.error("Error updating partner status:", error);
    res.status(500).send("Server Error");
  }
}

module.exports ={
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
}