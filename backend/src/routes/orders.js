'use strict';
const router = require('express').Router();
const { authenticate, adminOnly } = require('../middleware/auth');
const { sendOrderConfirmation, sendDeliveryUpdate } = require('../services/whatsapp');

function generateOrderNumber() {
  const timestamp = Date.now().toString().slice(-7);
  return `NL-${timestamp}`;
}

// ── POST /api/orders  (place new order)
router.post('/', authenticate, async (req, res) => {
  const { prisma } = require('../../server');
  const {
    items,
    deliveryAddress,
    deliveryPhone,
    deliveryTime,
    notes
  } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'Your cart is empty.' });
  }

  try {
    // Fetch real prices from database
    const mealIds = items.map(i => i.mealId);
    const meals   = await prisma.meal.findMany({
      where: { id: { in: mealIds }, isAvailable: true }
    });

    if (meals.length !== mealIds.length) {
      return res.status(400).json({
        error: 'One or more meals are no longer available.'
      });
    }

    // Build order items + calculate total
    let totalAmount = 0;
    const orderItems = items.map(item => {
      const meal    = meals.find(m => m.id === item.mealId);
      const lineAmt = meal.price * item.quantity;
      totalAmount  += lineAmt;
      return {
        mealId   : item.mealId,
        quantity : item.quantity,
        price    : meal.price
      };
    });

    // Create order in database
    const order = await prisma.order.create({
      data: {
        orderNumber     : generateOrderNumber(),
        userId          : req.user.id,
        totalAmount,
        deliveryAddress : deliveryAddress || req.user.address || 'Not specified',
        deliveryPhone   : deliveryPhone   || req.user.phone   || 'Not specified',
        deliveryTime    : deliveryTime    || 'ASAP',
        notes           : notes           || '',
        status          : 'PENDING',
        items           : { create: orderItems }
      },
      include: {
        items : { include: { meal: true } },
        user  : true
      }
    });

    // Send WhatsApp notification (non-blocking)
    if (order.user.phone) {
      sendOrderConfirmation(
        order.user.phone,
        order.user.firstName,
        order.orderNumber,
        order.totalAmount
      ).catch(e => console.log('WA order confirm skipped:', e.message));
    }

    res.status(201).json({
      success     : true,
      orderId     : order.id,
      orderNumber : order.orderNumber,
      totalAmount : order.totalAmount,
      status      : order.status,
      items       : order.items
    });
  } catch (err) {
    console.error('Create order error:', err);
    res.status(500).json({ error: 'Failed to place order. Please try again.' });
  }
});

// ── GET /api/orders/my-orders  (logged-in user)
router.get('/my-orders', authenticate, async (req, res) => {
  const { prisma } = require('../../server');
  try {
    const orders = await prisma.order.findMany({
      where   : { userId: req.user.id },
      include : {
        items   : { include: { meal: { select: { name: true, emoji: true } } } },
        payment : { select: { status: true, pesapalTrackId: true } }
      },
      orderBy : { createdAt: 'desc' }
    });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/orders/:id
router.get('/:id', authenticate, async (req, res) => {
  const { prisma } = require('../../server');
  try {
    const order = await prisma.order.findUnique({
      where   : { id: req.params.id },
      include : {
        items   : { include: { meal: true } },
        payment : true,
        user    : { select: { firstName: true, lastName: true, email: true, phone: true } }
      }
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    // Users can only see their own orders
    if (order.userId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied.' });
    }

    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/orders  (admin: all orders)
router.get('/', authenticate, adminOnly, async (req, res) => {
  const { prisma } = require('../../server');
  try {
    const { status, page = 1, limit = 25 } = req.query;
    const where = status ? { status } : {};

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include : {
          user    : { select: { firstName: true, lastName: true, phone: true, email: true } },
          payment : { select: { status: true, pesapalTrackId: true } },
          items   : { select: { quantity: true, price: true, meal: { select: { name: true, emoji: true } } } }
        },
        orderBy : { createdAt: 'desc' },
        skip    : (parseInt(page) - 1) * parseInt(limit),
        take    : parseInt(limit)
      }),
      prisma.order.count({ where })
    ]);

    res.json({ orders, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/orders/:id/status  (admin: update status)
router.patch('/:id/status', authenticate, adminOnly, async (req, res) => {
  const { prisma } = require('../../server');
  const { status } = req.body;
  const validStatuses = ['PREPARING', 'ON_THE_WAY', 'DELIVERED', 'CANCELLED'];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
    });
  }

  try {
    const order = await prisma.order.update({
      where   : { id: req.params.id },
      data    : { status },
      include : { user: true }
    });

    // Notify customer on WhatsApp
    if (['ON_THE_WAY', 'DELIVERED'].includes(status) && order.user.phone) {
      sendDeliveryUpdate(
        order.user.phone,
        order.user.firstName,
        order.orderNumber,
        status
      ).catch(e => console.log('WA delivery update skipped:', e.message));
    }

    res.json({ success: true, message: `Order updated to ${status}`, order });
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Order not found.' });
    }
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;