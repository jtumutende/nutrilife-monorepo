'use strict';
const axios = require('axios');

const BASE = process.env.NODE_ENV === 'production'
  ? 'https://pay.pesapal.com/v3'
  : 'https://cybqa.pesapal.com/pesapalv3';

let cachedToken = null;
let tokenExpiry = null;

async function getToken() {
  if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) return cachedToken;
  const res = await axios.post(`${BASE}/api/Auth/RequestToken`,
    { consumer_key: process.env.PESAPAL_CONSUMER_KEY, consumer_secret: process.env.PESAPAL_CONSUMER_SECRET },
    { headers: { 'Content-Type': 'application/json', Accept: 'application/json' } }
  );
  cachedToken = res.data.token;
  tokenExpiry = Date.now() + 4 * 60 * 1000;
  return cachedToken;
}

async function registerIPN(ipnUrl) {
  const token = await getToken();
  const res = await axios.post(`${BASE}/api/URLSetup/RegisterIPN`,
    { url: ipnUrl, ipn_notification_type: 'GET' },
    { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' } }
  );
  return res.data;
}

async function submitOrder({ orderId, orderNumber, amount, currency = 'UGX', description, email, phone, firstName, lastName }) {
  const token = await getToken();
  const res = await axios.post(`${BASE}/api/Transactions/SubmitOrderRequest`,
    {
      id: orderId,
      currency,
      amount: parseFloat(amount),
      description: description || `NutriLife Order ${orderNumber}`,
      callback_url: `${process.env.FRONTEND_URL}/pages/payment-confirm.html`,
      notification_id: process.env.PESAPAL_IPN_ID || '',
      billing_address: { email_address: email || '', phone_number: phone || '', first_name: firstName || '', last_name: lastName || '' }
    },
    { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' } }
  );
  return { orderTrackingId: res.data.order_tracking_id, redirectUrl: res.data.redirect_url };
}

async function getTransactionStatus(orderTrackingId) {
  const token = await getToken();
  const res = await axios.get(`${BASE}/api/Transactions/GetTransactionStatus?orderTrackingId=${orderTrackingId}`,
    { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }
  );
  return res.data;
}

module.exports = { getToken, registerIPN, submitOrder, getTransactionStatus };
