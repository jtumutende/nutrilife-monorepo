'use strict';
const twilio = require('twilio');

function getClient() {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) return null;
  return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

const FROM = `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER || '+14155238886'}`;

async function sendMessage(toPhone, text) {
  const client = getClient();
  if (!client) { console.log('📱 WhatsApp skipped — Twilio not configured'); return; }
  const clean = toPhone.toString().replace(/[\s\-\(\)\+]/g, '');
  await client.messages.create({ from: FROM, to: `whatsapp:+${clean}`, body: text });
  console.log(`📱 WhatsApp sent to +${clean}`);
}

async function sendWelcomeMessage(phone, firstName) {
  await sendMessage(phone,
    `🥗 *Welcome to NutriLife, ${firstName}!*\n\n` +
    `Your account is ready.\n\n` +
    `• Type *MENU* to see today's meals\n` +
    `• Type *ORDER* to place an order\n` +
    `• Type *TRACK* to track your order\n` +
    `• Type *HELP* to talk to our team\n\n` +
    `Eat smart. Live better. 🌿`
  );
}

async function sendOrderConfirmation(phone, firstName, orderNum, amount) {
  await sendMessage(phone,
    `✅ *Order Confirmed, ${firstName}!*\n\n` +
    `📦 Order: *${orderNum}*\n` +
    `💰 Total: *UGX ${Number(amount).toLocaleString()}*\n` +
    `⏱ ETA: *30 to 45 minutes*\n\n` +
    `Our chefs are preparing your food! 👨‍🍳`
  );
}

async function sendPaymentConfirmation(phone, firstName, amount, orderNum) {
  await sendMessage(phone,
    `💳 *Payment Received!*\n\n` +
    `Hi ${firstName}, we received *UGX ${Number(amount).toLocaleString()}* for order *${orderNum}*.\n\n` +
    `Your meal is being prepared now. 🥗`
  );
}

async function sendDeliveryUpdate(phone, firstName, orderNum, status) {
  const msgs = {
    ON_THE_WAY: `🚴 *On the Way, ${firstName}!*\n\nOrder *${orderNum}* is with our rider.\nETA: 15 to 20 minutes. Please be ready! 😊`,
    DELIVERED:  `🎉 *Delivered! Enjoy, ${firstName}!*\n\nOrder *${orderNum}* has been delivered.\nReply 1 to 5 to rate your experience ⭐`
  };
  await sendMessage(phone, msgs[status] || `Order ${orderNum}: ${status}`);
}

module.exports = { sendMessage, sendWelcomeMessage, sendOrderConfirmation, sendPaymentConfirmation, sendDeliveryUpdate };
