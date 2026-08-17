# AI StorySprint Editing V2

Production-ready Next.js course platform with PostgreSQL authentication, progress, administration, resources, and embedded YouTube lesson playback.

## Required Vercel environment variables

- `DATABASE_URL`: Supabase PostgreSQL Session Pooler connection string
- `SETUP_SECRET`: a new random password used only on the protected `/setup` page
- `SEED_ADMIN_EMAIL`: your private administrator email
- `SEED_ADMIN_PASSWORD`: a strong unique administrator password
- `SEED_STUDENT_EMAIL`: the demo student's email
- `SEED_STUDENT_PASSWORD`: a strong demo-student password

Never commit their values to GitHub.

## First deployment

1. Import this repository into a **new** Vercel project.
2. Add both environment variables to Production and Preview.
3. Deploy.
4. Open `/setup`, enter `SETUP_SECRET`, and initialize the schema and seed data.
5. Log in and immediately change the seeded passwords.

The seeded administrator and demo-student credentials are the private values configured in Vercel. They are never stored in the repository.

## YouTube lessons

In Admin → Lessons, paste a standard YouTube watch, youtu.be, Shorts, or embed URL. The lesson renders it through `youtube-nocookie.com` in a responsive player. The lesson page remains restricted to authenticated students with Active course access.

## Commands

```bash
npm ci
npm run typecheck
npm run lint
npm run build
```
