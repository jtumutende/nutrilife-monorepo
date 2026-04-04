'use strict';
const jwt = require('jsonwebtoken');

const authenticate = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access denied. Please login.' });
  }
  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { prisma } = require('../../server');
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user)          return res.status(401).json({ error: 'Account not found.' });
    if (!user.isActive) return res.status(401).json({ error: 'Account suspended. Contact support.' });
    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') return res.status(401).json({ error: 'Session expired. Please login again.' });
    return res.status(401).json({ error: 'Invalid token. Please login again.' });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Admin access required.' });
  next();
};

module.exports = { authenticate, adminOnly };
