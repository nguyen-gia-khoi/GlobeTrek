const User = require("../models/User");
const jwt = require("jsonwebtoken"); // Add this import
const {
        sendVerificationEmail,
        sendPasswordResetEmail,
        sendResetSuccessEmail
} = require("../service/mailtrap/email");
const redis = require("../config/redis")
const crypto = require("crypto");
const {
    generateToken,
    storeRefreshToken,
  } = require("../service/tokenService")

const signup = async (req, res) => {
    const { email, password } = req.body;

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

const signin = async( req, res ) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({email});
        if(user && (await user.comparePassword(password))){
            const { accessToken, refreshToken } = generateToken(user._id);
           
            res.cookie("refreshToken", refreshToken, {
                httpOnly: true,
                sameSite: "strict",
                maxAge: 7 * 24 * 60 * 60 * 1000,
                secure: process.env.NODE_ENV === "production",
              });

            await storeRefreshToken(user._id, refreshToken);
            res.status(200).json({ accessToken, message: "Login success" });
        }
        else {
            res.status(400).json({ message: "Invalid email or password" });
          }
    } catch (error) {
        console.log("Error in login controller: ", error.message);
        res.status(500).json({ message: "Server Error!", error: error.message });
    }
}

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
  
//update bio

module.exports ={
    signup,
    signin,
    verfiaccount,
    signout,
    refreshToken,
    forgotPassword,
    resetPassword
}


