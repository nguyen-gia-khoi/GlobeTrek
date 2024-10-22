
const { VERIFICATION_EMAIL_TEMPLATE,
  PASSWORD_RESET_REQUEST_TEMPLATE,
  PASSWORD_RESET_SUCCESS_TEMPLATE } = require("./emailTemplate");
const nodemailer = require("nodemailer");
const dotenv = require("dotenv");
dotenv.config();

const sendVerificationEmail = async (email, verificationCode) => {

const htmlContent = VERIFICATION_EMAIL_TEMPLATE.replace(
  "{verificationCode}",
   verificationCode
 );
const transporter = nodemailer.createTransport({
host: "smtp.gmail.com",
port: 587,
secure: false, // true for port 465, false for other ports
auth: {
user: process.env.EMAIL_USERNAME,
pass: process.env.EMAIL_PASSWORD,
},
});
const info = await transporter.sendMail({
from: '"GlobeTrek.huflit" <GlobeTrek.huflit@gmail.com>', // sender address
to: email, // list of receivers
subject: "Verification code", // Subject line
text: "Verification code", // plain text body
html: htmlContent, // html body
});
return info

}

const sendPasswordResetEmail = async (email, resetURL) => {
try {
const transporter = nodemailer.createTransport({
host: "smtp.gmail.com",
port: 587,
secure: false, // true for port 465, false for other ports
auth: {
  user: process.env.EMAIL_USERNAME,
  pass: process.env.EMAIL_PASSWORD,
},
});
const info = await transporter.sendMail({
from: '"GlobeTrek.huflit" <GlobeTrek.huflit@gmail.com>', // sender address
to: email, // list of receivers
subject: "Reset your password", // Subject line
text: "Reset your password", // plain text body
html: PASSWORD_RESET_REQUEST_TEMPLATE.replace("{resetURL}", resetURL), // html body
});
console.log("Password reset email sent successfully", info);
return info

} catch (error) {
console.error("Error sending password reset email:", error);
}
};

const sendResetSuccessEmail = async(email) =>{
try{
const transporter = nodemailer.createTransport({
host: "smtp.gmail.com",
port: 587,
secure: false, // true for port 465, false for other ports
auth: {
  user: process.env.EMAIL_USERNAME,
  pass: process.env.EMAIL_PASSWORD,
},
});
const info = await transporter.sendMail({
from: '"GlobeTrek.huflit" <GlobeTrek.huflit@gmail.com>', // sender address
to: email, // list of receivers
subject: "Password reset Successful", // Subject line
text: "Password reset Successful", // plain text body
html: PASSWORD_RESET_SUCCESS_TEMPLATE
});
console.log("Password reset email sent successfully", info)
return info
}

catch(error){
console.error(`Error sending password reset success email`, error);
throw new Error(`Error sending password reset success email:${error} `)
}
}
module.exports = {
sendVerificationEmail,
sendPasswordResetEmail,
sendResetSuccessEmail
};