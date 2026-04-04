'use strict';
const router  = require('express').Router();
const { authenticate, adminOnly } = require('../middleware/auth');
const pesapal = require('../services/pesapal');
const { sendPaymentConfirmation } = require('../services/whatsapp');

router.post('/initiate', authenticate, async (req, res) => {
  const { prisma } = require('../../server');
  const { orderId } = req.body;
  if (!orderId) return res.status(400).json({ error: 'orderId is required.' });
  try {
    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { user: true } });
    if (!order) return res.status(404).json({ error: 'Order not found.' });
    if (order.userId !== req.user.id) return res.status(403).json({ error: 'Not your order.' });
    const { orderTrackingId, redirectUrl } = await pesapal.submitOrder({
      orderId: order.id, orderNumber: order.orderNumber, amount: order.totalAmount,
      currency: 'UGX', email: order.user.email, phone: order.user.phone,
      firstName: order.user.firstName, lastName: order.user.lastName
    });
    await prisma.payment.create({
      data: { userId: req.user.id, orderId: order.id, amount: order.totalAmount, currency: 'UGX', pesapalTrackId: orderTrackingId, status: 'PENDING', description: `Order ${order.orderNumber}` }
    });
    res.json({ success: true, redirectUrl, orderTrackingId });
  } catch (err) {
    console.error('Payment initiate error:', err.message);
    res.status(500).json({ error: 'Payment initiation failed. Try again.' });
  }
});

router.get('/pesapal-ipn', async (req, res) => {
  const { prisma } = require('../../server');
  const { orderTrackingId, orderMerchantReference, orderNotificationType } = req.query;
  try {
    const statusData = await pesapal.getTransactionStatus(orderTrackingId);
    const isPaid = statusData.payment_status_description === 'Completed';
    const payment = await prisma.payment.update({
      where: { pesapalTrackId: orderTrackingId },
      data: { status: isPaid ? 'SUCCESS' : 'FAILED' },
      include: { order: true, user: true }
    });
    if (isPaid) {
      await prisma.order.update({ where: { id: payment.orderId }, data: { status: 'PREPARING' } });
      if (payment.user?.phone) {
        sendPaymentConfirmation(payment.user.phone, payment.user.firstName, payment.amount, payment.order?.orderNumber)
          .catch(e => console.log('WA payment confirm skipped:', e.message));
      }
      console.log(`✅ Payment confirmed: ${orderTrackingId}`);
    }
    res.json({ orderNotificationType, orderTrackingId, orderMerchantReference, status: 200 });
  } catch (err) {
    console.error('IPN error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/status/:trackingId', authenticate, async (req, res) => {
  const { prisma } = require('../../server');
  try {
    const payment = await prisma.payment.findFirst({
      where: { pesapalTrackId: req.params.trackingId },
      include: { order: { select: { orderNumber: true, status: true } } }
    });
    if (!payment) return res.status(404).json({ error: 'Payment not found.' });
    res.json({ status: payment.status, amount: payment.amount, currency: payment.currency, orderNumber: payment.order?.orderNumber, orderStatus: payment.order?.status });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/register-ipn', async (req, res) => {
  try {
    const ipnUrl = `${process.env.BACKEND_URL}/api/payments/pesapal-ipn`;
    const result = await pesapal.registerIPN(ipnUrl);
    res.json({ message: 'IPN registered! Copy ipn_id below to your .env as PESAPAL_IPN_ID', ipn_id: result.ipn_id, ipn_url: ipnUrl });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/history', authenticate, async (req, res) => {
  const { prisma } = require('../../server');
  const payments = await prisma.payment.findMany({
    where: { userId: req.user.id },
    include: { order: { select: { orderNumber: true, status: true } } },
    orderBy: { createdAt: 'desc' }
  });
  res.json(payments);
});

router.get('/', authenticate, adminOnly, async (req, res) => {
  const { prisma } = require('../../server');
  const payments = await prisma.payment.findMany({
    include: { user: { select: { firstName: true, lastName: true, email: true } }, order: { select: { orderNumber: true, status: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100
  });
  res.json(payments);
});

module.exports = router;
