# Royale International Backend v2 — Lovable Integration Guide

## Purpose

This package is a standalone backend and functional admin dashboard foundation intended to replace a broken backend/authentication implementation while preserving the existing public Royale International frontend.

## Non-negotiable rule

Do not rebuild or redesign the existing public frontend.

The existing Netlify frontend remains the source of truth for:
- Public pages
- Branding
- Navigation
- Visual design
- Existing layout
- Public content

The backend in this package is the source of truth for:
- Admin authentication
- Persistent admin accounts
- Shipments
- Tracking events
- Shipment status
- Public tracking data

## Authentication flow

Only these emails are authorized:

- swifttings@gmail.com
- isaacrobinson087@gmail.com

There is no email verification.

There is no verification code.

There is no email confirmation requirement.

Flow:

1. Frontend sends email to `POST /api/auth/check-email`.
2. Backend confirms whether the email is authorized.
3. Backend returns `requiresPasswordSetup`.
4. If true, frontend displays Create Password + Confirm Password.
5. Frontend sends both to `POST /api/auth/setup-password`.
6. Backend hashes the password with bcrypt and stores only the hash.
7. Backend returns an authenticated JWT.
8. Frontend stores the session token using the chosen secure client-side session strategy.
9. User enters the existing Admin Dashboard.
10. Future login uses `POST /api/auth/login`.

Never implement the first login as a normal password login. If `passwordHash` is null, the user must be sent through password setup.

## API endpoints

### Authentication

`POST /api/auth/check-email`

Request:
```json
{"email":"swifttings@gmail.com"}
```

Possible response:
```json
{
  "authorized": true,
  "requiresPasswordSetup": true
}
```

`POST /api/auth/setup-password`

Request:
```json
{
  "email":"swifttings@gmail.com",
  "password":"example-password",
  "confirmPassword":"example-password"
}
```

`POST /api/auth/login`

Request:
```json
{
  "email":"swifttings@gmail.com",
  "password":"example-password"
}
```

### Public tracking

`GET /api/shipments/track/:trackingNumber`

Example:
`GET /api/shipments/track/ROY-2026-000001`

This endpoint is read-only.

### Admin

All admin routes require:
`Authorization: Bearer <JWT>`

Endpoints:

- `GET /api/admin/stats`
- `GET /api/admin/shipments?page=1&limit=20&q=`
- `POST /api/admin/shipments`
- `GET /api/admin/shipments/:id`
- `PUT /api/admin/shipments/:id`
- `DELETE /api/admin/shipments/:id`
- `POST /api/admin/shipments/:id/events`
- `GET /api/admin/shipments/:id/events`

## Database

PostgreSQL models:

### AdminUser
- id
- email
- passwordHash nullable until first-time setup
- createdAt
- updatedAt
- lastLoginAt

### Shipment
- id
- trackingNumber
- shipmentReference
- sender information
- recipient information
- origin
- destination
- currentLocation
- status
- estimatedDeliveryDate
- archivedAt
- createdAt
- updatedAt

### TrackingEvent
- id
- shipmentId
- status
- location
- description
- eventTimestamp
- createdAt

## Deployment

Recommended:
- PostgreSQL: managed PostgreSQL provider
- Backend: Render, Railway, Fly.io, or equivalent Node.js host
- Frontend: existing Netlify deployment

Required environment variables:
- DATABASE_URL
- JWT_SECRET
- FRONTEND_URL
- ADMIN_EMAILS

Run:
```bash
npm install
npx prisma generate
npx prisma migrate deploy
npm run build
npm start
```

Seed authorized admin records:
```bash
npm run prisma:seed
```

The seed creates the two authorized emails with no password. This intentionally triggers first-time password setup.

## Public frontend integration

The existing public tracking page should call:

`GET {BACKEND_BASE_URL}/api/shipments/track/{TRACKING_NUMBER}`

Do not expose the admin JWT on the public tracking page.

Do not allow public users to access admin endpoints.

## Acceptance checklist

Before declaring the integration complete:

- Unauthorized email rejected.
- swifttings@gmail.com accepted.
- isaacrobinson087@gmail.com accepted.
- First login shows password + confirmation.
- No email verification is requested.
- Password is securely hashed.
- Password persists after restart.
- First password creation logs user in immediately.
- Returning login works.
- Wrong password is rejected.
- Admin routes reject unauthenticated requests.
- Admin dashboard uses real database data.
- Shipment creation generates a unique tracking number.
- Tracking events persist.
- Adding a tracking event updates shipment status and current location.
- Public tracking returns only public shipment information.
- Invalid tracking numbers return a clean 404.
- Existing public frontend visual design remains unchanged.

## Important integration note

The admin dashboard in `public/admin/index.html` is a functional reference implementation. If the existing Lovable Admin Dashboard has a better visual design, preserve that design and connect it to these backend contracts rather than replacing it with the simple reference UI.

The goal is:
Existing public frontend + existing/better admin UI + this backend's persistent data and authentication behavior.
