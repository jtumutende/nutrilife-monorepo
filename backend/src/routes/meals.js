'use strict';
const router = require('express').Router();
const { authenticate, adminOnly } = require('../middleware/auth');

// ── GET /api/meals  (public)
router.get('/', async (req, res) => {
  const { prisma } = require('../../server');
  try {
    const { category, search } = req.query;
    const where = { isAvailable: true };

    if (category && category !== 'all') {
      where.category = category;
    }
    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    const meals = await prisma.meal.findMany({
      where,
      orderBy: [{ isPopular: 'desc' }, { name: 'asc' }]
    });

    res.json(meals);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/meals/admin/all  (admin only — sees unavailable too)
router.get('/admin/all', authenticate, adminOnly, async (req, res) => {
  const { prisma } = require('../../server');
  const meals = await prisma.meal.findMany({
    orderBy: { createdAt: 'desc' }
  });
  res.json(meals);
});

// ── GET /api/meals/:id  (public)
router.get('/:id', async (req, res) => {
  const { prisma } = require('../../server');
  const meal = await prisma.meal.findUnique({
    where: { id: req.params.id }
  });
  if (!meal) return res.status(404).json({ error: 'Meal not found.' });
  res.json(meal);
});

// ── POST /api/meals  (admin only)
router.post('/', authenticate, adminOnly, async (req, res) => {
  const { prisma } = require('../../server');
  try {
    const {
      name, emoji, description, category,
      price, calories, protein, carbs, fat, fiber,
      isPopular
    } = req.body;

    if (!name || !price || !calories || !category) {
      return res.status(400).json({
        error: 'name, category, price and calories are required.'
      });
    }

    const meal = await prisma.meal.create({
      data: {
        name,
        emoji       : emoji       || '🍱',
        description : description || '',
        category,
        price       : parseInt(price),
        calories    : parseInt(calories),
        protein     : parseFloat(protein)  || 0,
        carbs       : parseFloat(carbs)    || 0,
        fat         : parseFloat(fat)      || 0,
        fiber       : parseFloat(fiber)    || 0,
        isPopular   : isPopular            || false,
        isAvailable : true
      }
    });

    res.status(201).json({ message: 'Meal created successfully.', meal });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/meals/:id  (admin only)
router.put('/:id', authenticate, adminOnly, async (req, res) => {
  const { prisma } = require('../../server');
  try {
    const data = { ...req.body };

    // Convert numeric strings to numbers
    if (data.price)    data.price    = parseInt(data.price);
    if (data.calories) data.calories = parseInt(data.calories);
    if (data.protein)  data.protein  = parseFloat(data.protein);
    if (data.carbs)    data.carbs    = parseFloat(data.carbs);
    if (data.fat)      data.fat      = parseFloat(data.fat);
    if (data.fiber)    data.fiber    = parseFloat(data.fiber);

    const meal = await prisma.meal.update({
      where : { id: req.params.id },
      data
    });

    res.json({ message: 'Meal updated successfully.', meal });
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Meal not found.' });
    }
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/meals/:id  (admin only)
router.delete('/:id', authenticate, adminOnly, async (req, res) => {
  const { prisma } = require('../../server');
  try {
    await prisma.meal.delete({ where: { id: req.params.id } });
    res.json({ message: 'Meal deleted successfully.' });
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Meal not found.' });
    }
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;