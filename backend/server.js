'use strict';
require('dotenv').config();
const app = require('./src/app');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const PORT   = process.env.PORT || 4000;

async function startServer() {
  try {
    await prisma.$connect();
    console.log('✅ Database connected successfully');
    app.listen(PORT, () => {
      console.log(`🚀 NutriLife API running on http://localhost:${PORT}`);
      console.log(`📋 Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
}

startServer();
module.exports = { prisma };