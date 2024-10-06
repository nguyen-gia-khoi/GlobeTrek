const User = require("../models/User");
const jwt = require("jsonwebtoken"); // Add this import
const {sendVerificationEmail} = require("../service/mailtrap/email");
const e = require("express");
let verificationStore = {};

const signup = async( req, res ) => {
    const { email, password } = req.body;

    try {
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ message: "User already exists" });
        }
        const verificationCode = Math.floor(100000 + Math.random() * 900000);
        const verificationTokenExpireAt = Date.now() + 5*60*1000; //5 phút


        verificationStore[email] = {
            verificationCode,
            verificationTokenExpireAt,
            password
        };

        await sendVerificationEmail(email, verificationCode);

        res.status(200).json({ message: "Check your email for the OTP" });
        
    } catch (error) {
        console.log("Error in login controller: ", error.message);
        res.status(500).json({ message: "Server Error!", error: error.message });
    }
}

const verfiaccount = async(req,res)=>{
    
    const { email, otp } = req.body;
    try {
        const storedData = verificationStore[email]
        //Lấy data ra check
        if (!storedData) {
            return res.status(400).json({ message: "OTP expired or invalid" });
        }
        const { verificationCode, verificationTokenExpireAt,password } = storedData;
        
        if (otp !== verificationCode.toString()|| Date.now() > verificationTokenExpireAt) {
            return res.status(400).json({ message: "Invalid OTP" });
          }
        const user = await User.create({ email, password });

        delete verificationStore[email];

        res.status(200).json({ message: "user created!"});
    } catch (error) {
        console.log("Error in login controller: ", error.message);
        res.status(500).json({ message: "Server Error!", error: error.message });
    }
}

const login = async( req, res ) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({email});
        if(user||(await User.comparePassword(password))){
            //Generate access token
            const accessToken = authController.generateAccessToken(user);
            //Generate refresh token
            const refreshToken = authController.generateRefreshToken(user);



            res.cookie("refreshToken", refreshToken, {
                httpOnly: true,
                secure:false, // đổi thành true khi deploy
                path: "/",
                sameSite: "strict",
              });

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

const logout = async( req, res ) => {
   
    try {
        
    } catch (error) {
        console.log("Error in login controller: ", error.message);
        res.status(500).json({ message: "Server Error!", error: error.message });
    }
}


const generateAccessToken = (user) => {
    return jwt.sign(
      {
        id: user.id,
        isAdmin: user.isAdmin,
      },
      process.env.JWT_ACCESS_KEY,
      { expiresIn: "30s" }
    );
  }

const generateRefreshToken = (user) => {
    return jwt.sign(
      {
        id: user.id,
        isAdmin: user.isAdmin,
      },
      process.env.JWT_REFRESH_KEY,
      { expiresIn: "365d" }
    );
  }


module.exports ={
    signup,
    login,
    verfiaccount,
    logout,
}


