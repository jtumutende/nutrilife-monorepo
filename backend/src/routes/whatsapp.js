'use strict';
const router = require('express').Router();
const { sendMessage } = require('../services/whatsapp');

// ── POST /api/whatsapp/webhook  (Twilio sends messages here)
router.post('/webhook', async (req, res) => {
  const { prisma } = require('../../server');

  const from = req.body.From || '';
  const body = req.body.Body || '';

  if (!from || !body) return res.sendStatus(200);

  // Extract digits only from phone
  const phone = from.replace('whatsapp:+', '').replace(/\D/g, '');
  const text  = body.trim().toLowerCase();

  console.log(`💬 WhatsApp from +${phone}: ${body}`);

  // Find user by phone number
  const user = await prisma.user.findFirst({
    where: { phone: { contains: phone.slice(-9) } }
  }).catch(() => null);

  const name = user?.firstName || 'there';

  try {
    if (text.match(/^(hi|hello|hey|start)/)) {
      await sendMessage(phone,
        `👋 Hi ${name}! Welcome to *NutriLife* 🥗\n\n` +
        `Reply with any keyword:\n\n` +
        `*MENU* — See today's meals\n` +
        `*ORDER* — Place an order\n` +
        `*TRACK* — Track your order\n` +
        `*CALORIES* — Daily nutrition tips\n` +
        `*HELP* — Talk to our team`
      );
    } else if (text.includes('menu')) {
      const meals = await prisma.meal.findMany({
        where   : { isAvailable: true },
        take    : 6,
        orderBy : { isPopular: 'desc' }
      });
      const list = meals
        .map((m, i) =>
          `${i + 1}. ${m.emoji} *${m.name}*\n` +
          `   UGX ${m.price.toLocaleString()} · ${m.calories} kcal`
        )
        .join('\n\n');
      await sendMessage(phone,
        `🥗 *Today's Menu:*\n\n${list}\n\n` +
        `Visit our website to order:\n` +
        `${process.env.FRONTEND_URL}`
      );
    } else if (text.includes('track')) {
      if (!user) {
        await sendMessage(phone,
          `Please create an account first:\n` +
          `${process.env.FRONTEND_URL}/pages/register.html`
        );
      } else {
        const orders = await prisma.order.findMany({
          where   : { userId: user.id },
          orderBy : { createdAt: 'desc' },
          take    : 3
        });
        if (!orders.length) {
          await sendMessage(phone, `📦 No orders found. Type *MENU* to browse meals!`);
        } else {
          const info = orders
            .map(o => `• *${o.orderNumber}*: ${o.status.replace('_', ' ')} — UGX ${o.totalAmount.toLocaleString()}`)
            .join('\n');
          await sendMessage(phone, `📦 *Your Recent Orders:*\n\n${info}`);
        }
      }
    } else if (text.includes('calories') || text.includes('nutrition')) {
      await sendMessage(phone,
        `📊 *Quick Nutrition Tips:*\n\n` +
        `🔥 Daily calories: 1,800 to 2,200 kcal\n` +
        `💪 Protein: 0.8g per kg of body weight\n` +
        `🌾 Carbs: 45 to 65% of daily intake\n` +
        `🥑 Fat: 20 to 35% of daily intake\n` +
        `💧 Water: 8 glasses per day\n\n` +
        `Log your meals in the NutriLife app!`
      );
    } else if (text.includes('help') || text.includes('human') || text.includes('support')) {
      await sendMessage(phone,
        `👨‍💼 *Connecting you to our team...*\n\n` +
        `Our nutritionist will reply within 30 minutes.\n` +
        `Hours: 7AM to 10PM daily\n\n` +
        `Email: support@nutrilife.ug`
      );
    } else {
      await sendMessage(phone,
        `🤔 I did not understand that, ${name}.\n\n` +
        `Try: *MENU* · *ORDER* · *TRACK* · *HELP*`
      );
    }
  } catch (err) {
    console.error('WhatsApp bot error:', err.message);
  }

  res.sendStatus(200);
});

module.exports = router;