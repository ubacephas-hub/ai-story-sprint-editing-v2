# Safe content archive and navigation loading delivery

Status: implementation prepared for Staging validation. The migration has not been applied, no live database was accessed, and no Production deployment or operation is part of this change.

## Scope

- Additive, idempotent `migrations/004_content_archiving.sql` adds nullable archive metadata to modules and lessons, nullable `archived_by` user foreign keys, and partial indexes for active content.
- `src/lib/setup-db.ts` applies the same nullable fields, foreign keys, and indexes for fresh and existing databases.
- Module and lesson archive/restore actions update archive metadata only. They do not delete or rewrite lesson/resource/progress rows or change IDs, video URLs, or relationships.
- Student queries, direct lesson access, progress writes, navigation, resource listings, and document downloads exclude archived lessons and lessons whose parent module is archived.
- Admin lesson history retains archived lessons and progress, labels archive state, and computes active course totals without archived lessons.
- Admin Modules and Lessons pages include Active/Archived filters, confirmation messages, restore controls, and empty states.
- A dependency-free top-level navigation bar observes App Router pathname/search changes, eligible internal clicks, and browser history navigation; includes timeout/reset and reduced-motion behavior.

## Staging-only rollout and data checks

1. Confirm the Preview environment points only to the Staging database/storage project. Do not paste secrets into tickets or chat.
2. Take the normal Staging snapshot/backup. Record module and lesson row counts, ID ranges, order/title samples, `lesson_progress` row count/IDs, resource count/IDs, video sources, and course access/student counts.
3. Review `migrations/004_content_archiving.sql`. It uses only nullable `ADD COLUMN IF NOT EXISTS`, idempotent FK checks, and `CREATE INDEX IF NOT EXISTS`; it contains no content updates or automatic archive operation.
4. Apply `004_content_archiving.sql` once to Staging, then run it a second time. Confirm both runs succeed and counts, IDs, content, progress, resources, and relationships remain unchanged.
5. Verify new archive columns are nullable and `archived_by` references `users(id)` with `ON DELETE SET NULL`. Confirm `modules_active_course_position_idx` and `lessons_active_module_position_idx` exist.
6. Refresh the Staging Preview and run the manual acceptance checklist. Do not run setup, seed, migration, reset, storage operation, or test against Production.

## Manual Staging acceptance checklist

### Module archive/restore

- [ ] Create an isolated test module with test lessons, resources, video sources, and student progress. Record all IDs and field values.
- [ ] Archive only the test module by typing `ARCHIVE MODULE`.
- [ ] Confirm the module/lessons disappear from the student Dashboard, My Course, outline, Continue Learning, active module/lesson counts, progress denominator, Resources page, and lesson navigation.
- [ ] Open a saved direct student lesson URL and attempt `/api/progress` and a private-document URL inside the archived module. Student access must be denied; an active lesson elsewhere must still work.
- [ ] Confirm Admin can still see the archived module, inspect its lessons/resources, and view historical progress with an Archived label.
- [ ] Restore with the confirmation dialog. Confirm the same module/lesson/resource/progress IDs, title, saved order, video URLs, relationships, and progress values return.

### Lesson archive/restore and editing

- [ ] Archive an isolated lesson by typing `ARCHIVE LESSON`.
- [ ] Confirm the lesson disappears from student outlines, resources, Continue Learning, Previous/Next navigation, and all active progress counts/denominators.
- [ ] Verify direct lesson page, progress write, and document download access are denied for the archived lesson; pending/suspended/removed/unauthenticated users remain denied.
- [ ] Confirm Admin still sees the archived lesson and its progress/resources/video in the Archived view/history.
- [ ] Restore the lesson with confirmation. Confirm its original ID, title, order, module assignment, description, video URL, resources, progress, and relationships return.
- [ ] Rename and reorder lessons; move a lesson between two active modules. Confirm create/move APIs reject an archived module as a destination and do not alter its source when rejected.
- [ ] Edit video and description on a test lesson, then confirm the existing video and resources still load after archive/restore.

### Navigation loading bar and visual review

- [ ] Test internal navigation on public, login, enrollment, student, and admin pages at desktop and mobile viewport widths.
- [ ] Verify the bar begins near 10%, advances while pending, reaches 100% after pathname or search parameter changes, then fades and resets.
- [ ] Verify browser Back and Forward start and complete it where a route changes.
- [ ] Verify external links, `download` links, document download routes, same-page anchors, modified clicks, and new-tab clicks do not start it.
- [ ] Simulate a cancelled/slow navigation and verify the timeout resets the bar instead of leaving it stuck.
- [ ] Enable `prefers-reduced-motion` and confirm no moving progress animation runs while the indicator still remains understandable.
- [ ] Confirm module cards and headers share one StorySprint purple gradient on Dashboard, My Course, outlines, and Admin Modules; lesson rows/resources retain neutral/lighter backgrounds and readable contrast.

## Rollback guidance

- Routine application rollback does not require dropping the additive fields or indexes. Keep the nullable archive fields in place.
- Important: a prior application version that does not query `archived_at` will ignore archived flags and could make archived material visible again. If Staging has any archived content, keep archive-aware code deployed or review/restore visibility state before rolling application code back.
- Do not reset/recreate the database, delete content/progress rows, or run destructive cascading deletes. Preserve the pre-change backup and verify all IDs/relationships if a Staging restore is ever required.
- The migration contains commented manual `DROP` guidance only for a separately reviewed schema cleanup after confirming no deployed version reads the fields. Do not execute that guidance as routine rollback.
- No Production migration, deployment, content change, setup, seed, or database operation is authorized by this delivery note.

## Automated validation

Run from the repository root:

```bash
npm ci
npm test
npm run typecheck
npm run lint
npm run build
npm audit --omit=dev
```

The automated archive tests cover metadata-only archive/restore semantics, student visibility and access policy, progress denominator/history preservation, and active-module move validation. Route-loading tests cover candidate eligibility, completion/fade/reset states, timeout configuration, and reduced motion. The suite does not replace the Staging-only end-to-end validation above.
