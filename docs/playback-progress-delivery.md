# Playback progress delivery notes

Status: implementation prepared for staging validation. No migration has been applied and no Production deployment or database operation is part of this change.

## Scope delivered

- Additive `lesson_progress` playback fields and `lesson_progress_user_last_watched_idx` in `migrations/003_lesson_playback_progress.sql`.
- Fresh/staging setup support in `src/lib/setup-db.ts`; the migration and setup path preserve old IDs, rows, statuses, completion timestamps, users, enrollments, lessons, and video/resource metadata.
- Same-origin `/api/progress` saves for authenticated Students with Active course access. Lesson ownership is resolved server-side through its module and course. Browser-supplied percentage, watched time, furthest position, and status are diagnostic inputs only; the server normalizes aggregates.
- Bounded finite values, unique-row upsert, row locking, seek-jump protection, 90% genuine-watch completion, ended handling, idempotent manual completion, and completed-state preservation.
- Direct HTML5 MP4/HLS tracking and official YouTube IFrame API tracking. Saves are throttled to approximately 12 seconds, and flush on pause, ended, visibility change, pagehide, and unmount. Resume seeks to the saved position unless the lesson is already completed.
- Student lesson/dashboard/course views with watched percentage, position/duration, save state, resume behavior, partial course totals, and latest-incomplete Continue Learning selection.
- Administrator aggregate and per-lesson progress views with 20-second visibility-aware polling and manual refresh. Disabled/removed student records remain available for historical progress review.

## Staging rollout

1. Confirm the Vercel Preview deployment points only to the staging Supabase/Postgres project. Check `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_DOCUMENT_BUCKET`; do not paste credentials into tickets or chat.
2. Take the normal staging database snapshot/backup and record the current `lesson_progress` row count, ID range, completed count, and a sample of completed IDs/statuses/completion timestamps.
3. Review `migrations/003_lesson_playback_progress.sql` in the staging change window.
4. Apply it once in the staging SQL editor or approved migration runner. Do not run setup, seed, or the migration against Production.
5. Run the same SQL a second time in staging only and confirm it succeeds without changing row counts or IDs. `ADD COLUMN IF NOT EXISTS`, the completed-row predicate, and `CREATE INDEX IF NOT EXISTS` are intentionally idempotent.
6. Deploy/refresh the Preview build and run the manual checklist below. Check browser Network requests for same-origin `/api/progress` only; no service key or document body should appear in a browser request.
7. Monitor staging API errors, progress write responses, database row count, and completed-row count while exercising direct-video and YouTube lessons.

## Manual acceptance matrix

### Data and authorization

- [ ] Existing completed rows remain `status='completed'`, retain `completed_at`, and display as 100%; no existing progress ID changes.
- [ ] A Student with Active access can save only lessons belonging to an enrolled course.
- [ ] Unauthenticated, Admin, Pending, and Suspended sessions receive the appropriate rejection from `/api/progress`.
- [ ] A lesson ID from another course or a lesson not owned by the resolved module/course cannot be written.
- [ ] A student cannot write another student's row by changing the request body.
- [ ] Removing/disabling a student prevents new saves but does not erase the historical admin snapshot.
- [ ] Invalid IDs, negative/NaN/infinite values, durations over 24 hours, percentages over 100, and malformed timestamps are rejected with no database mutation.

### Playback and completion

- [ ] Direct MP4: `loadedmetadata`, `play`, throttled `timeupdate`, `pause`, `seeked`, `ended`, `visibilitychange`, `pagehide`, unmount, refresh, and route navigation all behave without a blocking UI.
- [ ] HLS source is retained as `application/x-mpegURL`; unsupported native browsers show their normal media failure without breaking the lesson page.
- [ ] YouTube uses the official API, seeks on ready, uses the `youtube-nocookie.com` host, and accepts only a validated URL or 11-character video ID.
- [ ] Network requests are approximately one per 10–15 seconds during active playback, plus lifecycle flushes; there is no request for every `timeupdate`.
- [ ] The panel shows a subtle saving/saved/retry state and the latest position/duration and percentage. Temporarily failed saves do not prevent playback and recover on later saves.
- [ ] Seeking forward does not increase `watched_seconds`, `percent_complete`, or `furthest_position_seconds` incorrectly; a seek to 95% followed immediately by pause does not complete the lesson.
- [ ] Genuine watched time at 90% completes automatically once. A sufficiently watched natural ended event completes once. Delayed/concurrent events cannot change a completed row back to `in_progress`.
- [ ] Mark Complete remains available, is idempotent, sets `percent_complete=100`, and retains a completion timestamp.
- [ ] Resume works after reload, a second browser, and a second device/session. A completed lesson is not forced back to its old resume point.

### Student and administrator UI

- [ ] Dashboard Continue Learning chooses the most recent incomplete `last_watched_at`; with none, it chooses the first incomplete ordered lesson; with all complete, it offers review without changing completion.
- [ ] Partial totals use lesson percentages: eight lessons at 100%, 50%, 0%, 0%, 0%, 0%, 0%, 0% show 18.75% overall.
- [ ] Admin Students shows aggregate percentage, completed/total count, current/recent lesson, and last-watched time.
- [ ] Admin Student Progress shows every lesson's percentage, position/duration, watched status, and last-watched time; manual refresh updates without a full-page flicker.
- [ ] Admin polling runs about every 20 seconds while visible and pauses while hidden. Historical rows remain visible after suspension/removal.

## Rollback and incident guidance

- **Application-only regression:** stop the Preview promotion and redeploy the previous Preview build or revert the pull request. The old application can safely ignore the additive columns.
- **Migration/app mismatch:** do not drop columns or recreate `lesson_progress`. Restore the staging database from the pre-change snapshot only if the staging incident requires it and the normal approval is recorded; verify IDs, rows, users, enrollments, and completion timestamps after restoration.
- **High write/error rate:** disable the Preview promotion or temporarily remove playback UI at the application layer. Do not delete progress rows. Investigate `/api/progress` response codes and database locks in staging.
- **Incorrect completion:** preserve the row and audit request timing. A completed status must not be downgraded. Correct only with a reviewed, explicit staging data repair if needed; never bulk-reset progress.
- **Production:** no Production migration, setup, seed, database reset, storage change, or deployment is authorized by this delivery note.

## Automated checks

Run from the repository root:

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run build
npm audit --omit=dev
```

`tests/progress.test.ts` covers normalization and invalid values, seek protection, ended deltas, 90% completion, completed-row non-regression, authorization/suspended access policy, Continue Learning selection, and partial course totals. Full route/database authorization testing still requires staging credentials and a disposable staging fixture; it must not be substituted with Production testing.

## Delivery sign-off

- [ ] Typecheck, lint, tests, and build pass.
- [ ] Staging migration applied and rerun safely.
- [ ] Manual acceptance matrix completed with browser/device details recorded in the staging release ticket.
- [ ] No Production deployment or database operation performed.
- [ ] Existing PR remains open for review; do not merge as part of this task.
