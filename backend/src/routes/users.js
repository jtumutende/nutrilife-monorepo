'use strict';
const router = require('express').Router();
const { authenticate, adminOnly } = require('../middleware/auth');

// ── GET /api/users/meal-log  (my nutrition log)
router.get('/meal-log', authenticate, async (req, res) => {
  const { prisma } = require('../../server');
  try {
    const { date } = req.query;
    const where    = { userId: req.user.id };

    if (date === 'today') {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      where.loggedAt = { gte: start, lte: end };
    }

    const logs = await prisma.mealLog.findMany({
      where,
      orderBy : { loggedAt: 'desc' },
      take    : 50
    });

    // Sum up totals for the day
    const totals = logs.reduce(
      (acc, l) => ({
        calories : acc.calories + l.calories,
        protein  : acc.protein  + l.protein,
        carbs    : acc.carbs    + l.carbs,
        fat      : acc.fat      + l.fat
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );

    res.json({ logs, totals });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/users/meal-log  (log a meal)
router.post('/meal-log', authenticate, async (req, res) => {
  const { prisma } = require('../../server');
  const {
    mealId, mealName, mealType,
    calories, protein, carbs, fat, notes
  } = req.body;

  if (!mealName || !calories) {
    return res.status(400).json({ error: 'mealName and calories are required.' });
  }

  try {
    const log = await prisma.mealLog.create({
      data: {
        userId   : req.user.id,
        mealId   : mealId   || null,
        mealName,
        mealType : mealType || 'Lunch',
        calories : parseInt(calories),
        protein  : parseFloat(protein) || 0,
        carbs    : parseFloat(carbs)   || 0,
        fat      : parseFloat(fat)     || 0,
        notes    : notes               || ''
      }
    });
    res.status(201).json({ message: 'Meal logged successfully.', log });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/users/meal-log/:id
router.delete('/meal-log/:id', authenticate, async (req, res) => {
  const { prisma } = require('../../server');
  try {
    await prisma.mealLog.delete({
      where: { id: req.params.id, userId: req.user.id }
    });
    res.json({ message: 'Meal log entry deleted.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/users/profile  (update my profile)
router.put('/profile', authenticate, async (req, res) => {
  const { prisma } = require('../../server');
  const {
    firstName, lastName, phone,
    age, weight, height,
    gender, address, dietary, goal
  } = req.body;

  try {
    const user = await prisma.user.update({
      where : { id: req.user.id },
      data  : {
        firstName : firstName || undefined,
        lastName  : lastName  || undefined,
        phone     : phone     || undefined,
        age       : age       ? parseInt(age)      : undefined,
        weight    : weight    ? parseFloat(weight) : undefined,
        height    : height    ? parseFloat(height) : undefined,
        gender    : gender    || undefined,
        address   : address   || undefined,
        dietary   : dietary   || undefined,
        goal      : goal      || undefined
      },
      select: {
        id        : true,
        firstName : true,
        lastName  : true,
        email     : true,
        phone     : true,
        plan      : true,
        goal      : true
      }
    });
    res.json({ message: 'Profile updated successfully.', user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/users  (admin: list all users)
router.get('/', authenticate, adminOnly, async (req, res) => {
  const { prisma } = require('../../server');
  try {
    const { plan, page = 1, limit = 25 } = req.query;
    const where = {};
    if (plan) where.plan = plan;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select  : {
          id        : true,
          firstName : true,
          lastName  : true,
          email     : true,
          phone     : true,
          plan      : true,
          role      : true,
          isActive  : true,
          createdAt : true,
          _count    : { select: { orders: true } }
        },
        orderBy : { createdAt: 'desc' },
        skip    : (parseInt(page) - 1) * parseInt(limit),
        take    : parseInt(limit)
      }),
      prisma.user.count({ where })
    ]);

    res.json({ users, total, page: parseInt(page) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/users/:id/suspend  (admin)
router.patch('/:id/suspend', authenticate, adminOnly, async (req, res) => {
  const { prisma } = require('../../server');
  try {
    const user = await prisma.user.update({
      where : { id: req.params.id },
      data  : { isActive: false }
    });
    res.json({ message: `${user.email} has been suspended.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/users/:id/activate  (admin)
router.patch('/:id/activate', authenticate, adminOnly, async (req, res) => {
  const { prisma } = require('../../server');
  try {
    const user = await prisma.user.update({
      where : { id: req.params.id },
      data  : { isActive: true }
    });
    res.json({ message: `${user.email} has been activated.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;