'use strict';
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding NutriLife database...\n');

  // ── Admin user
  const adminPass = await bcrypt.hash('admin123', 12);
  await prisma.user.upsert({
    where  : { email: 'admin@nutrilife.ug' },
    update : {},
    create : {
      firstName : 'NutriLife',
      lastName  : 'Admin',
      email     : 'admin@nutrilife.ug',
      password  : adminPass,
      phone     : '256700000001',
      role      : 'ADMIN',
      plan      : 'Elite',
      isActive  : true
    }
  });

  // ── Demo user
  const userPass = await bcrypt.hash('password123', 12);
  await prisma.user.upsert({
    where  : { email: 'john@nutrilife.ug' },
    update : {},
    create : {
      firstName : 'John',
      lastName  : 'Doe',
      email     : 'john@nutrilife.ug',
      password  : userPass,
      phone     : '256700123456',
      plan      : 'Pro',
      goal      : 'Weight Loss',
      age       : 28,
      weight    : 72,
      height    : 175,
      gender    : 'Male',
      address   : 'Nakasero, Kampala',
      isActive  : true
    }
  });

  console.log('✅ Users created');

  // ── Meals
  const meals = [
    { name:'Oatmeal Fruit Bowl',      emoji:'🥣', category:'breakfast', price:18000, calories:380, protein:12, carbs:62, fat:8,  fiber:8,  isPopular:true,  description:'Steel-cut oats with fresh tropical fruits, honey and chia seeds.' },
    { name:'Grilled Chicken Rice',    emoji:'🍱', category:'lunch',     price:32000, calories:640, protein:48, carbs:72, fat:14, fiber:4,  isPopular:true,  description:'Herb-marinated grilled chicken breast with jasmine rice and steamed broccoli.' },
    { name:'Avocado Power Salad',     emoji:'🥗', category:'lunch',     price:24000, calories:420, protein:18, carbs:28, fat:32, fiber:12, isPopular:false, description:'Mixed greens, avocado, cherry tomatoes and cucumber with lemon dressing.' },
    { name:'Pan-Seared Salmon',       emoji:'🐟', category:'dinner',    price:48000, calories:520, protein:42, carbs:18, fat:28, fiber:3,  isPopular:true,  description:'Atlantic salmon with roasted vegetables, quinoa and dill butter.' },
    { name:'Vegan Buddha Bowl',       emoji:'🫙', category:'vegan',     price:26000, calories:480, protein:22, carbs:68, fat:16, fiber:14, isPopular:true,  description:'Roasted chickpeas, sweet potato, kale, brown rice with tahini.' },
    { name:'Green Smoothie Bowl',     emoji:'🥬', category:'breakfast', price:16000, calories:290, protein:14, carbs:48, fat:6,  fiber:6,  isPopular:false, description:'Spinach, banana, pineapple, coconut milk topped with granola.' },
    { name:'Beef Stir Fry Noodles',   emoji:'🍜', category:'dinner',    price:38000, calories:720, protein:52, carbs:82, fat:22, fiber:5,  isPopular:false, description:'Lean beef strips with vegetables in savory sauce over rice noodles.' },
    { name:'Protein Snack Box',       emoji:'🥜', category:'snack',     price:12000, calories:220, protein:16, carbs:18, fat:10, fiber:3,  isPopular:false, description:'Mixed nuts, boiled egg, cheese cubes, hummus and fresh fruit.' },
    { name:'Lentil Soup and Bread',   emoji:'🍲', category:'vegan',     price:20000, calories:360, protein:18, carbs:58, fat:6,  fiber:16, isPopular:false, description:'Red lentil soup with turmeric and herbs, whole grain sourdough.' },
    { name:'Turkey Whole Wrap',       emoji:'🌯', category:'lunch',     price:28000, calories:480, protein:36, carbs:52, fat:14, fiber:6,  isPopular:true,  description:'Whole wheat tortilla with turkey, lettuce, tomato and avocado.' },
    { name:'Veggie Omelette',         emoji:'🍳', category:'breakfast', price:22000, calories:340, protein:28, carbs:12, fat:22, fiber:4,  isPopular:false, description:'3-egg omelette with spinach, peppers, mushrooms and goat cheese.' },
    { name:'Jerk Chicken Plantain',   emoji:'🍗', category:'dinner',    price:42000, calories:680, protein:54, carbs:62, fat:20, fiber:6,  isPopular:true,  description:'Ugandan-style jerk chicken with sweet plantain, rice and coleslaw.' },
    { name:'Overnight Oats',          emoji:'🫐', category:'breakfast', price:15000, calories:320, protein:14, carbs:56, fat:8,  fiber:9,  isPopular:false, description:'Rolled oats in almond milk with blueberries, honey and flaxseeds.' },
    { name:'Chicken Caesar Wrap',     emoji:'🥙', category:'lunch',     price:30000, calories:540, protein:42, carbs:48, fat:18, fiber:5,  isPopular:false, description:'Grilled chicken, romaine, parmesan and Caesar dressing in a wrap.' },
    { name:'Fruit and Yoghurt Bowl',  emoji:'🍓', category:'snack',     price:11000, calories:180, protein:10, carbs:28, fat:4,  fiber:4,  isPopular:false, description:'Greek yoghurt with seasonal fruits, granola and honey drizzle.' },
    { name:'Mango Chia Pudding',      emoji:'🥭', category:'snack',     price:14000, calories:260, protein:8,  carbs:42, fat:10, fiber:11, isPopular:false, isAvailable:false, description:'Overnight chia pudding with fresh mango and coconut cream.' },
  ];

  for (const meal of meals) {
    await prisma.meal.upsert({
      where  : { name: meal.name },
      update : {},
      create : {
        ...meal,
        isAvailable : meal.isAvailable ?? true,
        isPopular   : meal.isPopular   ?? false
      }
    });
  }

  console.log(`✅ ${meals.length} meals seeded`);
  console.log('\n🎉 Database ready!\n');
  console.log('👤 Admin:  admin@nutrilife.ug  /  admin123');
  console.log('👤 User:   john@nutrilife.ug   /  password123\n');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());