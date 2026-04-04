'use strict';
const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { authenticate } = require('../middleware/auth');

router.post('/register', async (req, res) => {
  const { prisma } = require('../../server');
  const { firstName, lastName, email, phone, password, plan, goal } = req.body;
  if (!firstName || !email || !password) return res.status(400).json({ error: 'First name, email and password are required.' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(400).json({ error: 'Email already registered.' });
    const hashed = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { firstName, lastName: lastName || '', email, phone: phone || null, password: hashed, plan: plan || 'Starter', goal: goal || 'General Wellness', role: 'USER', isActive: true }
    });
    const token = jwt.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    if (phone) {
      const wa = require('../services/whatsapp');
      wa.sendWelcomeMessage(phone, firstName).catch(e => console.log('WA skipped:', e.message));
    }
    res.status(201).json({ message: 'Account created!', token, user: { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, plan: user.plan, role: user.role } });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed. Try again.' });
  }
});

router.post('/login', async (req, res) => {
  const { prisma } = require('../../server');
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required.' });
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: 'Invalid email or password.' });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid email or password.' });
    if (!user.isActive) return res.status(401).json({ error: 'Account suspended. Contact support@nutrilife.ug' });
    const token = jwt.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ message: 'Login successful', token, user: { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, plan: user.plan, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: 'Login failed. Try again.' });
  }
});

router.get('/me', authenticate, async (req, res) => {
  const { prisma } = require('../../server');
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id:true, firstName:true, lastName:true, email:true, phone:true, plan:true, goal:true, role:true, age:true, weight:true, height:true, gender:true, address:true, dietary:true, createdAt:true }
  });
  res.json(user);
});

router.post('/change-password', authenticate, async (req, res) => {
  const { prisma } = require('../../server');
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Both fields are required.' });
  if (newPassword.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters.' });
  try {
    const user  = await prisma.user.findUnique({ where: { id: req.user.id } });
    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) return res.status(400).json({ error: 'Current password is incorrect.' });
    await prisma.user.update({ where: { id: req.user.id }, data: { password: await bcrypt.hash(newPassword, 12) } });
    res.json({ message: 'Password changed successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to change password.' });
  }
});

module.exports = router;
