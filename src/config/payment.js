require('dotenv').config();
const paypal = require('@paypal/checkout-server-sdk');

// PayPal configuration
const paypalClient = new paypal.core.PayPalHttpClient(
  new paypal.core.SandboxEnvironment(
    process.env.PAYPAL_CLIENT_ID,
    process.env.PAYPAL_CLIENT_SECRET
    
  )
  
);

module.exports = {
  paypalClient
};