'use strict';
const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const morgan    = require('morgan');
const rateLimit = require('express-rate-limit');

const app = express();

app.use(helmet());
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://127.0.0.1:5500',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5500',
    'https://nutrilife-website.vercel.app'
  ],
  credentials: true
}));
app.use(rateLimit({
  windowMs : 15 * 60 * 1000,
  max      : 300,
  message  : { error: 'Too many requests. Please try again later.' }
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth',     require('./routes/auth'));
app.use('/api/meals',    require('./routes/meals'));
app.use('/api/orders',   require('./routes/orders'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/users',    require('./routes/users'));
app.use('/api/whatsapp', require('./routes/whatsapp'));

app.get('/health', (req, res) => {
  res.json({
    status  : 'ok',
    service : 'NutriLife Uganda API',
    version : '1.0.0',
    time    : new Date().toISOString()
  });
});

app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

app.use((err, req, res, next) => {
  console.error('Server error:', err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

module.exports = app;