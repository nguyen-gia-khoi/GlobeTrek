const { VERIFICATION_EMAIL_TEMPLATE, PASSWORD_RESET_REQUEST_TEMPLATE, PASSWORD_RESET_SUCCESS_TEMPLATE, ORDER_CONFIRMATION_TEMPLATE } = require("./emailTemplate");
const nodemailer = require("nodemailer");
const dotenv = require("dotenv");
dotenv.config();

// Tạo transporter cho Nodemailer
const createTransporter = () => {
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false, // true cho port 465, false cho các port khác
    auth: {
      user: process.env.EMAIL_USERNAME,
      pass: process.env.EMAIL_PASSWORD,
    },
  });
};

const sendVerificationEmail = async (email, verificationCode) => {
  const htmlContent = VERIFICATION_EMAIL_TEMPLATE.replace(
    "{verificationCode}",
    verificationCode
  );

  const transporter = createTransporter();
  
  const mailOptions = {
    from: '"GlobeTrek.huflit" <GlobeTrek.huflit@gmail.com>', // sender address
    to: email, // list of receivers
    subject: "Verification code", // Subject line
    text: "Verification code", // plain text body
    html: htmlContent, // html body
  };

  const info = await transporter.sendMail(mailOptions);
  return info;
};

const sendPasswordResetEmail = async (email, resetURL) => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: '"GlobeTrek.huflit" <GlobeTrek.huflit@gmail.com>', // sender address
      to: email, // list of receivers
      subject: "Reset your password", // Subject line
      text: "Reset your password", // plain text body
      html: PASSWORD_RESET_REQUEST_TEMPLATE.replace("{resetURL}", resetURL), // html body
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Password reset email sent successfully", info);
    return info;
  } catch (error) {
    console.error("Error sending password reset email:", error);
  }
};

const sendResetSuccessEmail = async (email) => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: '"GlobeTrek.huflit" <GlobeTrek.huflit@gmail.com>', // sender address
      to: email, // list of receivers
      subject: "Password reset Successful", // Subject line
      text: "Password reset Successful", // plain text body
      html: PASSWORD_RESET_SUCCESS_TEMPLATE, // html body
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Password reset email sent successfully", info);
    return info;
  } catch (error) {
    console.error(`Error sending password reset success email`, error);
    throw new Error(`Error sending password reset success email: ${error}`);
  }
};

// Hàm gửi email xác nhận đơn hàng
const sendOrderConfirmationEmail = async (userEmail, orderDetails) => {
  try {
    const transporter = createTransporter();
    
    // Tạo nội dung HTML cho email
    const htmlContent = ORDER_CONFIRMATION_TEMPLATE.replace("{orderId}", orderDetails.orderId)
      .replace("{totalValue}", orderDetails.totalValue)
      .replace("{bookingDate}", orderDetails.bookingDate)
      .replace("{tourTitle}", orderDetails.tour.title)
      .replace("{status}", orderDetails.status);

    const mailOptions = {
      from: '"GlobeTrek.huflit" <GlobeTrek.huflit@gmail.com>', // sender address
      to: userEmail, // list of receivers
      subject: 'Order Confirmation - Your Order has been Paid', // Subject line
      text: `Dear Customer,\n\nYour order with ID ${orderDetails.orderId} has been successfully paid.\n\nOrder Details:\n- Total Value: ${orderDetails.totalValue}\n- Booking Date: ${orderDetails.bookingDate}\n- Tour: ${orderDetails.tour.title}\n- Status: ${orderDetails.status}\n\nThank you for your purchase!\n\nBest Regards,\nYour Company Name`,
      html: htmlContent, // html body
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Order confirmation email sent successfully', info);
    return info;
  } catch (error) {
    console.error('Error sending order confirmation email:', error);
    throw new Error(`Failed to send order confirmation email: ${error.message}`);
  }
};

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendResetSuccessEmail,
  sendOrderConfirmationEmail,
};
