const User = require("../models/User");

const signup = async( req, res ) => {
    const { email, password } = req.body;

    try {
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ message: "User already exists" });
        }
        const verificationCode = Math.floor(100000 + Math.random() * 900000);
        
    } catch (error) {
        console.log("Error in login controller: ", error.message);
        res.status(500).json({ message: "Server Error!", error: error.message });
    }
}

const login = async( req, res ) => {
    
    try {
        
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
module.export ={
    signup,
    login,
    logout,
}