const { response } = require("express");
const { mailtrapClient, sender } = require("../mailtrap/mailtrap.config");
const { VERIFICATION_EMAIL_TEMPLATE,
        PASSWORD_RESET_REQUEST_TEMPLATE,
        PASSWORD_RESET_SUCCESS_TEMPLATE } = require("./emailTemplate");

const sendVerificationEmail = async (email, verificationCode) => {
  const htmlContent = VERIFICATION_EMAIL_TEMPLATE.replace(
    "{verificationCode}",
    verificationCode
  );

  const message = {
    to: [{ email: email }],
    from: { email: sender.email, name: sender.name },
    subject: "Email Verification",
    html: htmlContent,
  };

  try {
    await mailtrapClient.send(message);
  } catch (error) {
    console.error("Error sending verification email:", error);
  }
};

const sendPasswordResetEmail = async (email, resetURL) => {
  try {
    const response = await mailtrapClient.send({
      to: [{ email: email }], 
      from: { email: sender.email, name: sender.name },
      subject: "Reset your password",
      html: PASSWORD_RESET_REQUEST_TEMPLATE.replace("{resetURL}", resetURL),
      category: "password reset",
    });
    console.log("Password reset email sent successfully", response);
  } catch (error) {
    console.error("Error sending password reset email:", error);
  }
};

const sendResetSuccessEmail = async(email) =>{
  try{
    const response = await mailtrapClient.send({
      to: [{ email: email }],
      from: { email: sender.email, name: sender.name },
      subject: "Password reset Successful",
      html: PASSWORD_RESET_SUCCESS_TEMPLATE,
      category: "password reset",
    })
    console.log("Password reset email sent successfully", response)
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
