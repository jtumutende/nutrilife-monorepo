'use strict';
const router = require('express').Router();
const { authenticate, adminOnly } = require('../middleware/auth');
const { sendOrderConfirmation, sendDeliveryUpdate } = require('../services/whatsapp');

function genOrderNum() { return 'NL-' + Date.now().toString().slice(-7); }

router.post('/', authenticate, async (req, res) => {
  const { prisma } = require('../../server');
  const { items, deliveryAddress, deliveryPhone, deliveryTime, notes } = req.body;
  if (!items || items.length === 0) return res.status(400).json({ error: 'Cart is empty.' });
  try {
    const mealIds = items.map(i => i.mealId);
    const meals   = await prisma.meal.findMany({ where: { id: { in: mealIds }, isAvailable: true } });
    if (meals.length !== mealIds.length) return res.status(400).json({ error: 'One or more meals are unavailable.' });
    let totalAmount = 0;
    const orderItems = items.map(item => {
      const meal = meals.find(m => m.id === item.mealId);
      totalAmount += meal.price * item.quantity;
      return { mealId: item.mealId, quantity: item.quantity, price: meal.price };
    });
    const order = await prisma.order.create({
      data: { orderNumber: genOrderNum(), userId: req.user.id, totalAmount, deliveryAddress: deliveryAddress || req.user.address || '', deliveryPhone: deliveryPhone || req.user.phone || '', deliveryTime: deliveryTime || 'ASAP', notes: notes || '', status: 'PENDING', items: { create: orderItems } },
      include: { items: { include: { meal: true } }, user: true }
    });
    if (order.user.phone) {
      sendOrderConfirmation(order.user.phone, order.user.firstName, order.orderNumber, order.totalAmount)
        .catch(e => console.log('WA order confirm skipped:', e.message));
    }
    res.status(201).json({ success: true, orderId: order.id, orderNumber: order.orderNumber, totalAmount: order.totalAmount, status: order.status });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to place order.' }); }
});

router.get('/my-orders', authenticate, async (req, res) => {
  const { prisma } = require('../../server');
  const orders = await prisma.order.findMany({
    where: { userId: req.user.id },
    include: { items: { include: { meal: { select: { name: true, emoji: true } } } }, payment: { select: { status: true, pesapalTrackId: true } } },
    orderBy: { createdAt: 'desc' }
  });
  res.json(orders);
});

router.get('/:id', authenticate, async (req, res) => {
  const { prisma } = require('../../server');
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: { items: { include: { meal: true } }, payment: true, user: { select: { firstName: true, lastName: true, email: true, phone: true } } }
  });
  if (!order) return res.status(404).json({ error: 'Order not found.' });
  if (order.userId !== req.user.id && req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Access denied.' });
  res.json(order);
});

router.get('/', authenticate, adminOnly, async (req, res) => {
  const { prisma } = require('../../server');
  const { status, page = 1, limit = 25 } = req.query;
  const where = status ? { status } : {};
  const [orders, total] = await Promise.all([
    prisma.order.findMany({ where, include: { user: { select: { firstName: true, lastName: true, phone: true, email: true } }, payment: { select: { status: true } } }, orderBy: { createdAt: 'desc' }, skip: (parseInt(page) - 1) * parseInt(limit), take: parseInt(limit) }),
    prisma.order.count({ where })
  ]);
  res.json({ orders, total, page: parseInt(page) });
});

router.patch('/:id/status', authenticate, adminOnly, async (req, res) => {
  const { prisma } = require('../../server');
  const { status } = req.body;
  const valid = ['PREPARING', 'ON_THE_WAY', 'DELIVERED', 'CANCELLED'];
  if (!valid.includes(status)) return res.status(400).json({ error: `Invalid status. Must be: ${valid.join(', ')}` });
  try {
    const order = await prisma.order.update({ where: { id: req.params.id }, data: { status }, include: { user: true } });
    if (['ON_THE_WAY', 'DELIVERED'].includes(status) && order.user.phone) {
      sendDeliveryUpdate(order.user.phone, order.user.firstName, order.orderNumber, status)
        .catch(e => console.log('WA delivery update skipped:', e.message));
    }
    res.json({ success: true, order });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Order not found.' });
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
