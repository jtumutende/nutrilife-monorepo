'use strict';
const express = require('express');
const router  = express.Router();

// TODO: Add auth routes (register, login, logout)
router.get('/', (req, res) => {
  res.json({ message: 'Auth routes coming soon' });
});

module.exports = router;