# Royale International Backend v2

A standalone backend and functional Admin Dashboard foundation for the Royale International project.

## What v2 fixes

The most important change from v1 is the admin authentication flow.

There is NO:
- Email verification code
- Email confirmation requirement
- Verification email dependency

Only these two email addresses are authorized:

- swifttings@gmail.com
- isaacrobinson087@gmail.com

### First-time login

Authorized email
→ backend checks authorization
→ backend checks whether password exists
→ if no password exists, show Create Password + Confirm Password
→ password is bcrypt-hashed and saved in PostgreSQL
→ JWT is issued immediately
→ user enters Admin Dashboard

### Returning login

Authorized email
→ enter previously created password
→ bcrypt verification
→ JWT issued
→ Admin Dashboard opens

## Included

- Express + TypeScript backend
- PostgreSQL + Prisma
- Persistent admin users
- Correct first-time password setup
- Returning password login
- JWT authentication
- Shipment database
- Tracking events
- Automatic tracking numbers
- Shipment search
- Shipment archive
- Shipment status/location updates
- Public read-only tracking endpoint
- Admin statistics
- Functional admin dashboard reference UI
- Security middleware
- Rate limiting
- CORS
- Render deployment configuration
- Lovable integration documentation

## Local setup

Requirements:
- Node.js 20+
- PostgreSQL

Install:
```bash
npm install
npx prisma generate
```

Create `.env` from `.env.example`.

Then:
```bash
npx prisma migrate dev --name init
npm run prisma:seed
npm run dev
```

Open:
`http://localhost:3000/admin/`

## Production

Set environment variables:
- DATABASE_URL
- JWT_SECRET
- FRONTEND_URL
- ADMIN_EMAILS

Build:
```bash
npm install && npx prisma generate && npm run build
```

Start:
```bash
npx prisma migrate deploy && npm start
```

## Important

This package is designed to be integrated with the existing public Netlify frontend. It does not require rebuilding the public website.

The `public/admin/index.html` dashboard is a functional reference. If the existing Lovable dashboard has a better visual design, preserve its UI and connect it to the same backend API contracts.

See:
`docs/LOVABLE_INTEGRATION.md`
