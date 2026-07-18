# منصة تقويم البرامج التدريبية
منصة عربية RTL لإدارة البرامج والتقييم اليومي والنهائي والتقارير.

## التشغيل
1. `docker compose up -d`
2. انسخ `server/.env.example` إلى `server/.env` ثم `cd server && npm install && npx prisma migrate dev --name init && npm run seed && npm run dev`
3. في نافذة أخرى: `cd client && npm install && npm run dev`

حسابات التجربة: `admin@training.com / Admin@123`، `trainer@training.com / Trainer@123`، `trainee@training.com / Trainee@123`.
