# Video and private-document regression hotfix

This checklist is for the **Preview deployment backed by Staging only**. Do not use Production credentials, the Production database, or the Production `course-documents` bucket.

## Preview environment contract

Configure all of these on the same Preview deployment:

- `DATABASE_URL`: the Staging PostgreSQL connection string.
- `NEXT_PUBLIC_SUPABASE_URL`: the AI StorySprint Staging Supabase project URL.
- `SUPABASE_SERVICE_ROLE_KEY`: the service-role key from that same Staging Supabase project; server-only.
- `SUPABASE_DOCUMENT_BUCKET=course-documents`: the private bucket in that same Staging project.
- Existing application variables: `SETUP_SECRET`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_STUDENT_EMAIL`, and `SEED_STUDENT_PASSWORD` as needed for the Preview.

Before testing, compare the Supabase project reference in `DATABASE_URL` and `NEXT_PUBLIC_SUPABASE_URL`. If they do not identify the same Staging project, stop. Never test a Staging database record against a Production bucket.

## Document regression test

1. Sign in to the Preview as an administrator.
2. In **Admin → Resources**, upload a new small staging PDF to a lesson in the active course.
3. Confirm the browser's upload request goes directly to the Staging Supabase Storage URL after the secure upload URL is created. The PDF body must not be sent to a Vercel API route.
4. In the Staging Supabase dashboard, confirm the object exists in the private `course-documents` bucket. Record its path, for example `documents/<admin-id>/<uuid>-check.pdf`.
5. In the Staging database, confirm the new `resources.file_path` is exactly that object path relative to `course-documents`—not a signed URL, bucket-prefixed `fullPath`, or Production URL.
6. With an **Active** student enrolled in that course, request the resource download. The application response should be a short-lived redirect to a Staging Supabase signed URL and the PDF should download.
7. Repeat as an administrator; the download should succeed.
8. Verify the following requests are denied and no signed URL is created:
   - unauthenticated: `401`;
   - pending student: `403`;
   - suspended student: `403`;
   - removed/disabled student: `401` (the disabled session is not accepted).
9. Confirm the bucket remains private in the Staging dashboard. Do not change it to public.
10. Temporarily make signing fail in a disposable Preview-only test, if approved, and confirm the route returns a user-facing `502`/temporary-unavailable response rather than a misleading `404`. Review server logs for only error name/code/status and a sanitized message; no key, token, signed URL, or database URL may appear.

## Video regression test

1. Open an existing YouTube lesson at desktop and mobile widths.
2. In browser devtools, verify `.video-container` remains the responsive outer element and `.youtube-player-target` is the inner API target. The generated iframe should be inside that wrapper and fill it.
3. Verify the iframe host is `youtube-nocookie.com`, the existing URL formats and stored IDs work, and the player resumes from saved progress.
4. Play, pause, seek forward/back, refresh, navigate away, hide the tab, and return. Progress requests must be same-origin `/api/progress` requests with credentials and must not be sent for every `timeupdate` event.
5. Verify a seek does not add watched time, genuine watched time can auto-complete, and an ended event saves progress.
6. Block the IFrame API in a disposable Preview browser session. The responsive fallback iframe should still play the video and a friendly status should explain that detailed tracking is temporarily unavailable.
7. Test an existing direct MP4 and HLS lesson to confirm the native video path is unchanged.

## Rollback

Rollback application code by reverting this hotfix or selecting the previous Preview build. Do not drop playback columns, run a destructive migration, reset either database, make the bucket public, or delete existing resources. If a disposable Staging upload must be removed, first remove its resource record through the normal admin flow and then delete only that confirmed Staging object.
