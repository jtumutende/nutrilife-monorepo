# 🥗 NutriLife Uganda — Full Stack Monorepo

Uganda's #1 Nutrition Platform. Meal ordering, nutrition tracking, Pesapal payments (MTN MoMo, Airtel, VISA), WhatsApp bot via Twilio.

## Structure
```
nutrilife/
├── frontend/     → HTML/CSS/JS site  (deploy to Vercel)
└── backend/      → Node.js API       (deploy to Render)
```

## Quick Start

### Backend
```bash
cd backend
cp .env.example .env
# Fill in .env with your Supabase, Pesapal, Twilio keys
npm install
npx prisma generate
npx prisma db push
node prisma/seed.js
npm run dev
# API runs at http://localhost:4000
```

### Frontend
Open `frontend/index.html` with VS Code Live Server
OR
```bash
cd frontend
npx serve . -p 5500
```

## Test Accounts (after seed)
- Admin: admin@nutrilife.ug / admin123
- User:  john@nutrilife.ug  / password123

## Deploy
- Frontend → Vercel (root directory: frontend)
- Backend  → Render  (root directory: backend)
