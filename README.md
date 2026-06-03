# Innovex Resource Group Limited MERN Website

Complete MERN stack website for Innovex Resource Group Limited, based on the supplied PDF/Figma screen list and requested healthcare recruitment/admin functionality.

## Structure

- `client/` React + Vite frontend
- `server/` Node.js + Express API
- `server/src/models/` MongoDB models
- `server/src/routes/` REST API routes
- `server/uploads/` safely stored CV uploads

## Features

- Public pages: `/`, `/about`, `/services`, `/jobs`, `/testimonials`, `/partners`, `/contact`, `/upload-cv`
- Admin pages: `/admin/login`, `/admin/dashboard`, `/admin/jobs`, `/admin/applications`, `/admin/cv-uploads`, `/admin/testimonials`, `/admin/partners`
- JWT admin authentication with bcrypt password hashing
- Jobs CRUD and public job applications
- CV upload form with multer file storage
- Testimonial submission and admin approval
- Partner CRUD with public active partner listing
- Contact message API
- SEO metadata per page, semantic sections, responsive cards/tables/forms

## Setup

1. Install dependencies:

```bash
npm install
npm run install:all
```

2. Configure the backend:

```bash
cp server/.env.example server/.env
```

Update `server/.env` with your MongoDB connection string, JWT secret, and admin credentials.

3. Seed initial admin, jobs, testimonials, and partners:

```bash
npm run seed --prefix server
```

4. Run the full app:

```bash
npm run dev
```

Frontend: `http://localhost:5173`

Backend: `http://localhost:5000/api/health`

## Production Notes

- Use a long random `JWT_SECRET`.
- Set `CLIENT_URL` to the deployed frontend URL.
- Put MongoDB behind TLS and authenticated credentials.
- Store uploaded files on durable private storage for production, or mount `server/uploads` on persistent disk.
- Add email delivery to `contactRoutes.js` if live notifications are required.

## SEO & Deployment Checklist

- Deploy frontend with SPA fallback enabled. Netlify-style `_redirects` is included in `client/public`.
- Confirm the live domain is `https://innovexresourcegroup.co.uk`; if it changes, update `company.siteUrl` in `client/src/data/content.js`, `client/public/sitemap.xml`, and `client/public/robots.txt`.
- Submit `https://innovexresourcegroup.co.uk/sitemap.xml` in Google Search Console after deployment.
- Keep `/admin/` blocked from indexing via `robots.txt` and admin meta `noindex`.
- Use HTTPS, enable gzip/Brotli at the host, and cache static assets using the included `_headers` file where supported.
- Ranking is not instant: add real partner logos/content, job posts, testimonials, and local Cardiff/UK service copy over time for stronger search performance.
