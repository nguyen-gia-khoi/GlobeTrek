const User = require("../models/User");
const jwt = require("jsonwebtoken"); // Add this import
const {
        sendVerificationEmail,
        sendPasswordResetEmail,
        sendResetSuccessEmail
} = require("../service/mailtrap/email");
const redis = require("../config/redis")
const crypto = require("crypto");
const { PointerStrategy } = require("sso-pointer");
const pointer = new PointerStrategy("123");
const {
    generateToken,
    storeRefreshToken,
  } = require("../service/tokenService")

const signup = async (req, res) => {
    const { email, password} = req.body;

    try {
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ message: "User already exists" });
        }
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
  const isClient = req.query.client === "true";

  try {
    const user = await User.findOne({ email });
    if (user && (await user.comparePassword(password))) {
      const { accessToken, refreshToken } = generateToken(user._id);
      if (isClient) {
        // Set refresh token in HTTP-only cookie
        res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000,
        secure: process.env.NODE_ENV === "production",
      });
      await storeRefreshToken(user._id, refreshToken);
      const { password, ...others } = user._doc;
      res.status(200).json({ ...others, accessToken, refreshToken });
      
      } else {
        
        if(user.role == "admin"){
          // // Set access token in a cookie and render a protected page
          // const AdminaccessToken = jwt.sign({ userId: user._id, email }, process.env.JWT_SECRET, { expiresIn: '1h' });
          // console.log(AdminaccessToken)
          //   res.cookie("AdminaccessToken", AdminaccessToken, {
          //   httpOnly: true,
          //   sameSite: "strict",
          //   maxAge: 1 * 60 * 60 * 1000,
          //   secure: process.env.NODE_ENV === "production",
          // });
          const AdminaccessToken = jwt.sign({ userId: user._id, email }, process.env.ACCESS_TOKEN_SECRET, {
            expiresIn: "1d",
          })
          res.cookie("AdminaccessToken", AdminaccessToken, {
              httpOnly: true,
              sameSite: "strict",
              maxAge: 1 * 60 * 60 * 1000,
              secure: process.env.NODE_ENV === "production",
            });
          
          res.redirect('/');  // Change to your protected page route
          
        }
        else if(user.role == "partner"){
          console.log("hello")
        }
      }
    } else {
      // Handle invalid credentials
      if (isClient) {
        res.status(400).json({ message: "Invalid email or password" });
      } else {
        res.redirect("/login?message=Invalid email or password");
      }
    }
  } catch (error) {
    if (isClient) {
      res.status(500).json({ message: "Server Error!", error: error.message });
      console.log(error)
    } else {
      res.redirect("/login?message=Server Error!");
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
    console.log("Access Token Data:", accessTokenData);

    const { id: userId, email, accessToken } = accessTokenData;

    if (!userId || !email) {
      return res.status(400).json({ message: "User ID and email are required" });
    }

    // Check if the user already exists in the database
    let user = await User.findOne({ email });

    if (!user) {
      // Create a new user if they don't exist
      const newUser = new User({
        _id: userId,
        email,
      });

      user = await newUser.save();
      console.log("New user created:", user);
    } else {
      // Update existing user information if needed
      user.email = email;
      await user.save();
      console.log("User already exists and was updated:", user);
    }

    // // Generate a JWT token for the user
    

    // return res.json({
    //   login: true,
    //   role: user.role,
    //   email:user.email,
    //   userId: user._id,
    //   accessToken,
    // });
     // Generate a JWT token for the user\


     const token = jwt.sign(
      {userId}, process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: "1h" } // Set an appropriate expiration time
    );

    // const token = generateToken(user._id);

    return res.json({
      login: true,
      role: user.role,
      email:user.email,
      userId: user._id,
      token,
    });
  } catch (error) {
    console.error("Error in callback:", error.message);
    return res.status(500).json({ message: "Server Error", error: error.message });
  }
};
const getLoginPage = (req, res) => {
  const message = req.query.message || ''; // Retrieve any error message from the query params
  res.render('Authen/login', { message });
};
const getRegisterPage = (req, res) => {
  const message = req.query.message || ''; // Retrieve any error message from the query params
  res.render('Authen/Register', { message });
};
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
    getRegisterPage
}