# AI StorySprint Editing V2

Next.js course platform with PostgreSQL authentication, student progress, administration, private document resources, and embedded YouTube lesson playback.

## Preview environment variables

Configure these in the **Vercel Preview environment for a staging Supabase project**. Do not copy staging credentials into Production and never commit values to GitHub.

- `DATABASE_URL`: staging Supabase PostgreSQL Session Pooler connection string
- `SETUP_SECRET`: a long random value used only by the protected `/setup` page
- `SEED_ADMIN_EMAIL`: private staging administrator email
- `SEED_ADMIN_PASSWORD`: strong private staging administrator password
- `SEED_STUDENT_EMAIL`: private staging demo-student email
- `SEED_STUDENT_PASSWORD`: strong private staging demo-student password
- `NEXT_PUBLIC_SUPABASE_URL`: staging Supabase project URL; this is public and is used for direct browser uploads
- `SUPABASE_SERVICE_ROLE_KEY`: staging-only server secret; it must never use a `NEXT_PUBLIC_` name or appear in client code
- `SUPABASE_DOCUMENT_BUCKET=course-documents`: private document bucket name

The service role key is read only by server-side Storage routes. It is never returned in an API response, rendered into a page, or used by the browser upload client.

## Staging bucket setup

Perform these steps in the **staging Supabase project only**. Never run them against the Production project.

### Option A: Supabase SQL Editor

Run the following SQL in the staging project's SQL Editor:

```sql
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'course-documents',
  'course-documents',
  false,
  26214400,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'application/zip',
    'application/x-zip-compressed'
  ]::text[]
)
on conflict (id) do update set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
```

### Option B: Supabase Dashboard

1. Open the staging project and go to **Storage → New bucket**.
2. Name it `course-documents`.
3. Leave **Public bucket** turned off.
4. Set the file size limit to `25 MB`.
5. Allow PDF, DOCX, TXT, and ZIP MIME types listed above.
6. Save and confirm the bucket's Public column remains **No**.

The application uses the server service role only to create one-time signed upload URLs and five-minute signed download URLs. No public bucket or permanent public document URL is used. Storage policies are not needed for these service-role operations; if policies are added for other tooling, keep the bucket private.

## First staging setup

1. Create a separate staging Vercel project or Preview deployment connected to the staging database.
2. Add the Preview variables above and the staging bucket.
3. Deploy the Preview branch.
4. Open `/setup` in the staging Preview and enter the private `SETUP_SECRET` only if the staging database has not been initialized.
5. Log in with the staging administrator, change the seeded password, and use the admin interface to create/edit content.

Do not run setup, seed, migrations, or destructive storage/database operations against Production as part of this feature work.

## Content management

- **Admin → Modules** creates, renames, and reorders modules. A module with lessons cannot be deleted; deleting an empty module requires the exact confirmation in the interface.
- **Admin → Lessons** creates lessons in any module and immediately refreshes the list. Lesson editing supports title, description/content, order, module moves, YouTube URLs, and direct HTTP(S) video URLs.
- Lesson IDs and progress rows are updated only through additive content changes; there is no hard-delete lesson action.
- **Admin → Resources** adds links, text, or private documents, edits assignment/title/description/order, and deletes resources with confirmation.
- Document bytes go directly from the browser to the private Supabase bucket using a one-time signed upload URL. The Vercel API receives metadata only.
- Students must have an authenticated session and Active access to the document's course before the server redirects them to a five-minute signed download URL. Pending, suspended, removed, disabled, and unauthenticated users are denied.

## Database migration and rollback

No database migration is required for this change: the existing additive `resources.file_path` column already stores the private object path, and all existing tables, IDs, relationships, progress rows, video URLs, links, and text resources remain intact.

To roll back the application code, revert the pull request or deploy the previous Preview build. Do **not** drop existing tables or reset the database. If staging-only test documents must be removed after rollback, delete only the corresponding objects under `documents/` in the private staging bucket after confirming their resource records are no longer needed. Production data and the Production bucket must not be touched.

## Validation commands

```bash
npm ci
npm run typecheck
npm run lint
npm run build
npm audit --omit=dev
```

## Manual staging checklist

- [ ] Existing administrator login still works.
- [ ] Existing student login still works.
- [ ] Existing progress remains visible and existing videos still play.
- [ ] Existing links and text resources remain accessible.
- [ ] Create an empty test module, rename it, and reorder it.
- [ ] Confirm a module containing lessons cannot be hard-deleted.
- [ ] Add three test lessons and verify they appear immediately in Admin → Lessons.
- [ ] Move one test lesson to another module; edit title, description, order, and video source.
- [ ] Upload a test PDF from Admin → Resources and observe secure URL, direct upload, and success/error states.
- [ ] Confirm the bucket remains private and the database stores only an object path.
- [ ] Confirm an Active student can download the PDF.
- [ ] Confirm Pending, Suspended, removed/disabled, and unauthenticated users cannot download it.
- [ ] Confirm link and text resources continue to work on the central Resources page and lesson page.
- [ ] Test administrator flows on mobile and desktop widths.
- [ ] Confirm no Production deployment, Production setup, Production seed, or Production database reset was performed.
