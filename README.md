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

- **Admin → Modules** creates, renames, and reorders active modules. Active and Archived tabs provide archive/restore controls. Archiving requires typing `ARCHIVE MODULE`; restore requires confirmation.
- **Admin → Lessons** creates lessons only in active modules and supports title, description/content, order, active-module moves, YouTube URLs, and direct HTTP(S) video URLs. Active and Archived tabs include lessons hidden by an archived parent module.
- Archiving a lesson requires typing `ARCHIVE LESSON`; restore requires confirmation. Archive/restore updates only nullable metadata. Lesson IDs, module relationships, videos, resources, and progress rows are preserved; no lesson delete action is provided.
- Archived content is excluded from student views, navigation, resources, playback/progress writes, and active progress denominators. Administrators retain access to archived content and historical progress, with archive labels.
- **Admin → Resources** adds links, text, or private documents, edits assignment/title/description/order, and deletes resources with confirmation.
- Document bytes go directly from the browser to the private Supabase bucket using a one-time signed upload URL. The Vercel API receives metadata only.
- Students must have an authenticated session and Active access to the document's course and its active lesson/module before the server redirects them to a five-minute signed download URL. Pending, suspended, removed, disabled, and unauthenticated users are denied.

## Content archive migration, rollback, and delivery notes

`migrations/004_content_archiving.sql` is an idempotent additive migration. It adds nullable `modules.archived_at`, `modules.archived_by`, `lessons.archived_at`, and `lessons.archived_by` fields, nullable user foreign keys, and partial indexes for active module/lesson scans. It does not modify existing content, progress, IDs, relationships, or archive any rows automatically. The protected setup/schema helper supports both fresh and existing databases.

Apply the migration to **Staging only**, after the normal Staging backup and data-inventory checks. Run the SQL twice to confirm it is safe to repeat. A rollback of application code alone does not erase archive metadata, but older application versions do not enforce the archive flags and could expose content marked archived by this version. If archived rows exist, keep an archive-aware application deployed or perform a reviewed Staging-only restore/unarchive operation before rolling application code back. Do not drop archive columns/indexes as part of a routine rollback; the migration includes commented manual schema rollback guidance for a separately approved cleanup only.

See [`docs/content-archive-delivery.md`](docs/content-archive-delivery.md) for the Staging checklist, safety checks, loading-bar checks, and rollback guidance. No Staging test or Production operation is performed automatically by this repository change.

## Playback progress migration, rollback, and delivery notes

Playback persistence is additive and is not applied automatically by a Production deploy. The migration in `migrations/003_lesson_playback_progress.sql` uses `ADD COLUMN IF NOT EXISTS`, preserves every existing `lesson_progress.id` and row, adds the latest-watch index, and normalizes legacy `status='completed'` rows to `percent_complete=100`. It does not invent watched time or a duration for old rows. The protected fresh/staging setup path contains the same columns, index, and completed-row backfill.

Apply the migration only to the **staging** Supabase database after taking the normal staging backup/snapshot and checking the migration SQL. Verify that row counts, IDs, completed statuses, and access records are unchanged. Do not run it against Production as part of this work.

Playback saves are same-origin authenticated requests. The server resolves the lesson's module/course, requires the Student role and Active access, validates bounded finite values, derives watched time and percentage server-side, ignores seek jumps for watched time, and keeps completed rows completed. Direct MP4/HLS playback sends throttled progress about every 12 seconds and flushes on pause, ended, visibility change, pagehide, and unmount. YouTube uses the official IFrame API with the `youtube-nocookie.com` host and the same tracking contract. Automatic completion requires 90% genuine watched time or a sufficiently watched ended event; Mark Complete remains available.

To roll back application code, revert the pull request or deploy the previous Preview build. Do **not** drop/recreate `lesson_progress`, remove its new columns, reset the database, or delete historical progress. The additive columns are intentionally harmless to an older application; if a later cleanup is ever required, schedule it as a separately reviewed staging-first migration after confirming no deployed code reads the fields. Production data, storage, and database must not be touched. If staging-only test documents must be removed, delete only the corresponding private staging objects after confirming their resource records are no longer needed.

See [`docs/playback-progress-delivery.md`](docs/playback-progress-delivery.md) for the staging runbook, manual test matrix, monitoring points, and delivery/rollback sign-off notes.

## Validation commands

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run build
npm audit --omit=dev
```

## Manual staging checklist

- [ ] Existing administrator and student logins still work.
- [ ] Existing progress, completed lessons, course access, videos, links, text resources, and private documents remain available.
- [ ] Apply `003_lesson_playback_progress.sql` and `004_content_archiving.sql` to Staging only; run each twice and confirm the second run succeeds without changing row counts or IDs.
- [ ] Confirm lesson-progress row count, IDs, `status`, `completed_at`, users, enrollments, and video/resource metadata are unchanged; legacy completed rows display as 100%.
- [ ] Create a test module, rename it, and reorder it; verify no module containing lessons can be hard-deleted and use archive/restore for removal from student views.
- [ ] In Staging, archive a test module after typing `ARCHIVE MODULE`; confirm students cannot see its outline, lessons, resources, progress denominator, or direct lesson URLs. Confirm Admin retains the module and progress history, then restore it and verify IDs, title, order, lessons, videos, resources, and progress.
- [ ] Archive a test lesson after typing `ARCHIVE LESSON`; confirm it is absent from Continue Learning, progress totals, resource lists, and Previous/Next navigation, and direct page/progress/document access is denied. Restore it and confirm all data returns.
- [ ] Rename/reorder active modules and lessons, move a lesson between active modules, and confirm archived modules are not accepted as move/create targets and existing videos/resources/progress remain linked.
- [ ] Confirm Admin → Modules and Admin → Lessons have clear Active/Archived filters, restore confirmations, and helpful empty states; archived progress rows are labeled and remain visible.
- [ ] Test the route-loading bar on public, login/enrollment, student, and admin routes at desktop/mobile sizes; verify Back/Forward completion, external/download/anchor/modified-click exclusions, reduced-motion behavior, and timeout reset.
- [ ] Confirm module cards/headers use one purple gradient and lesson rows remain visually neutral with readable contrast.
- [ ] Add three test lessons and verify they appear immediately in Admin → Lessons.
- [ ] Test a direct MP4 lesson: metadata, play, pause, seek, resume, ended, refresh, route change, page hide/show, and another browser/device.
- [ ] Test an HLS `.m3u8` source in a browser that supports it and confirm unsupported browsers fail gracefully.
- [ ] Test a YouTube lesson: approved URL/ID only, `youtube-nocookie.com`, resume on ready, play/pause/seek/ended, and no raw arbitrary iframe URL.
- [ ] While watching, verify saves are throttled to approximately 10–15 seconds rather than every `timeupdate`; observe subtle saved/error state and retry after a temporary network failure.
- [ ] Verify a seek does not add watched time, jump to 90% does not complete, genuine 90% watched completes once, ended completion works when sufficiently watched, and delayed saves do not undo completion.
- [ ] Verify Mark Complete remains an idempotent fallback and shows 100% with a completion timestamp.
- [ ] Verify resume position, watched percentage, position/duration, and saved state persist after refresh, sign-out/sign-in, and another browser/device.
- [ ] Verify Dashboard Continue Learning selects the latest incomplete `last_watched_at`, falls back to first incomplete, preserves completed-course review, and calculates partial totals (for example 100% + 50% + six 0% lessons = 18.75%).
- [ ] Verify Admin → Students shows aggregate percentage, completed count, recent lesson, last-watched time, and visibility-aware 20-second polling without full-page flicker or polling while hidden.
- [ ] Verify an administrator's Student Progress view shows every lesson's percentage, position/duration, status, and last-watched time; manually refresh it.
- [ ] Suspend or remove a student and confirm playback writes are rejected while historical progress remains visible to administrators.
- [ ] Confirm Active, Pending, Suspended, removed/disabled, and unauthenticated users cannot access private documents without authorization.
- [ ] Test administrator and student flows on mobile and desktop widths.
- [ ] Confirm no Production deployment, Production setup, Production seed, Production migration, or Production database reset was performed.
