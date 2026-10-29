# Coordinated HikmahHub v1.1 integration — 28 October 2026

This record supersedes historical completion claims in earlier audit notes. Production is **NO-GO for the full v1.1 release** until the gates below pass. No production writes, migration, Auth changes, erasure, password reset, merge or production deployment were performed for this integration.

## Source reconciliation

- Production/main inspected at `911daab43801849b1ed1c8e41706f5364910a2dc`; Vercel's latest production deployment reported READY for this SHA. Live homepage HTTP 200 was inspected through the Vercel connector, not a rendered production browser. READY is not journey verification.
- Development PR #4 inspected at `ad7e0e043358e5561022dba8296fb3512c205f39`: 44 commits ahead, 18 behind main; common ancestor `ca1c452103ed87c5fc5dfc4c0b6e7b630ba48589`.
- Dedicated `codex/hikmahhub-v1-1-integration` starts from main. Selective port preserves main's independent-brand Organization/WebSite structured data, crawlable About page and sitemap, direct About route, auth/event styling, full-artwork carousel and cache update intent. Category links and worker lifecycle are deliberately corrected, not blindly merged. Original development branch and PR #4 remain available.
- Inspected main's history including a0838430, 96dbd6fa, 67b30fd, 877d27ab, 0123b042, 4518dd49 and 911daab4. Repeated identical release commits exist. The only available release/changelog reference is `docs/v1.1-release.md`; the separately described original approved frontend changelog and design screenshots were not found in the recursive repository tree. This task's specification is the detailed UI acceptance reference.
- Issue #3 explicitly says **defer vendor reviews**. Recent development files introduce them experimentally with public reviewer UUIDs, broken relative imports and no audited moderation implementation. They remain disabled and excluded from the migration sequence; not release-ready or approved. Do not apply `db/vendor-reviews.sql`.

## Feature and dependency matrix

Statuses describe code and verification, not a production deployment claim. Browser screenshots and synthetic UI checks do not establish live permissions. The final verification record below supersedes earlier pending-CI notes.

| Feature | Production / development finding | Integration files and work | DB dependency / security | Tests / completion |
|---|---|---|---|---|
| Home hierarchy | Main promos precede hero; dev Weekly precedes fresh and chips follow promos | public.js: hero, All/categories, promos, Fresh Listings ordered newest, compact swipeable Weekly | Existing read APIs; no fabricated production records | Rendered fixture order/screenshots; implemented, pending recorded CI |
| Marketplace | Main decorative chips lose other filters; dev three selects | public.js: state-preserving chip URLs, two selects, selected/aria-current, Clear Filters, counts N+, serialized Load More, dedup | Existing search RPC, logged-out previews retained | Filter/history/pagination/empty/error fixture tests; pending CI |
| Cards and availability | Index suffix defect in original map(card); working dev fix retained | public.js: readable status, thumbnails, escaped content, seller/verification, missing image | Existing objects | Node and rendered fixtures; no new DB |
| Product details | Main lacks sticky bar and existing condition/location display | public.js/CSS: notices, condition, pickup, Visit Store, sticky contact above nav; one handler per tap | Existing API, repaired-profile feature gated | Gallery/like regression, fixture screenshot; connected production acceptance remains |
| Vendor dashboard | Main table, dev CSS-stacked table | vendor.js: actual responsive cards, all existing edit/availability/submit/delete data handlers, named delete confirmation | Existing vendor RLS/RPCs; legacy access preserved | Real role contracts, card fixture; image API/browser editor journey remains acceptance gate |
| Login/signup/recovery | Existing functionality, auth visuals retained | account.js, validate/ui; clear notices; policy links | Existing GoTrue; no Auth configuration edits | Real signup/login/logout HTTP + connected browser tests; actual SMTP delivery unverified |
| Account/academics | Legacy values/incomplete approved vendors exist | account.js, academics.js, vendor-identity.js; preserves legacy pairs, dynamic options | v1_1 + android-fixes validation/unique matric; not public | SQL/HTTP role tests + rendered profile fixture |
| Missing-profile demand/likes | Real Auth rows historically lacked profiles | auth.js repair gated; ensure_my_profile and insertion triggers retained | android-fixes; derived Auth identity, no forged role | Real GoTrue/PostgREST regression; awaits migration |
| Deals/events/promotions/store | Existing reads, moderation and sharing retained | public.js/promos.js; stacked event facts/contact, responsive actions; full artwork/caption/link | Existing objects | Synthetic screen tests; connected live-data acceptance outstanding |
| Event discussion | Absent production tables; dev post/like/report only | event-discussion.js: paged comments, own edit/remove, conflict feedback, report; gated off | v1_1/android/security: active author, first name only, private UUID denied, 30-second/20-hour posting limit, redacted report target | SQL + real Auth HTTP/connected browser tests; migration/acceptance gate |
| Admin moderation | Production old queue; dev audited richer queue | moderation-queue.js/deletion-review.js; templates, snapshot/deep links, reasons, checked versions; old review panels retained in A | android-fixes, privacy requests; active admin DB checks | Cross-role/version/duplicate tests; connected admin UI acceptance gate |
| Privacy/deletion | Email request live; dev online review implementation | account-deletion.js; visible own request, recent password AMR + live session, status/withdrawal; gated email fallback | privacy-requests; request/review only, no destructive executor | Real Auth ownership/stale session/retry/inventory tests; actual erasure explicitly not implemented |
| Retention/notices/16–17 | Draft legal/operational decisions pending | legal.js and retention/privacy audit docs; truthful limits | No automatic schedules; no blanket indefinite hold | Module render + policy tests; legal/operator approval blocked |
| Reviews/ratings | Absent production, recent unapproved experiment contradicts Issue #3 | vendor-reviews.js and SQL preserved as inactive reference | Not in migration list; must redesign identity/privacy/moderation before reconsideration | Deferred with explicit Issue #3 justification |
| Public preview security | Two intentional definer views expose approved/featured allowlists | Keep limited anonymous previews/shared RPCs; revoke preview DML | security-hardening; no private profile columns | Anonymous preview and cross-user/RLS tests |
| Client schema privileges | Confirmed broad TRUNCATE grants including anon site_settings/promotions | Revoke TRUNCATE/REFERENCES/TRIGGER from client/PUBLIC roles and postgres defaults | security-hardening; removes unnecessary non-row privileges, no data mutation | Disposable actual TRUNCATE denial and catalog assertions; unapplied |
| Other definer RPCs | Advisor warns on intentional checked endpoints | Read all 42 production definer definitions/grants/search_path; admin guards present, owner RPCs derive uid, aggregates exclude profile identifiers; no blanket revoke | Empty search_path. Authenticated EXECUTE remains authorization-dependent. snapshot permits null uid only to trusted SQL/service contexts, anon has no grant | Existing and expanded negative permission tests; see security review below |
| PWA | Production v4 skipWaiting/claim/cache navigation; dev waits for tab closure | sw.js/pwa.js: explicit accept-and-reload, return checks, fixed-name asset revalidation, old hh cache removal; no API cache; explicit offline page | Static only; preserve local Auth state, no new Auth config | Exact v4→new real Chromium lifecycle test; physical installed Android acceptance outstanding |
| Low-data/performance | Dev reduced bundles/batches/thumbnail/cache retained | lazy private modules/share/gallery; 12-row marketplace, static cache, bounded realtime | Realtime owner filters and RLS unchanged | Throttled before/after actual measurements artifact; no estimate claim |
| Vercel/routing | Existing static project, production READY at main | Preserve OG crawler routes and About exception; no-cache SW, revalidate JS/CSS/index/manifest, cache artwork | Preview shares production API configuration; no mutation tests there | Config/syntax/dependency checks; authenticated preview mutations prohibited |
| Production backup/recovery | Verified database AND Storage backup not available | Prior disposable pg_dump/restore rehearsal + privacy recovery runbook | No production migration approval can be recommended without verified backup | Blocked; synthetic backup rehearsal is not production backup verification |

## Database comparison and migration engineering

Read-only inspection again confirmed **14 recorded migrations ending `20261020103400 — product_likes`**. All 22 public base tables have RLS; the two limited public views intentionally run as their owner. No event_likes/event_comments, academics, moderation_templates or account_deletion tables exist in production. Existing columns/types/functions are from the schema-only test snapshot; new drafts extend rather than replace existing Auth/profile/vendor/product relationships. Normalized matric duplicate groups: 0 on 28 October (aggregate only; no identifiers exported).

Run once, in this order, only in an isolated rehearsal first:

1. `db/v1_1.sql`: normalized matric unique index/triggers, event likes/comments, report target extension.
2. `db/android-fixes.sql`: trusted profile repair, server academic validation, report snapshots, moderation templates/checked actions.
3. `db/privacy-requests.sql`: request ledger/events, recent-auth checks, own status/withdrawal/admin inventory/review. No erasure.
4. `db/security-hardening.sql`: unnecessary client privileges removed, paged/private-author discussion API, edit/redaction, posting limits/index.

Do not run vendor-reviews.sql. Drafts have explicit transactions and fail if rerun after successful application; this avoids silently accepting incompatible existing definitions. Use migration history to run once. `scripts/prepare-migration.sh` prepares all four via `supabase migration new` in order, never pushes/links/resets. The local CLI is absent, so no fake timestamp was invented. Rehearsal applies the actual SQL, not an invented parallel schema. Storage policies are a read-only schema capture in `tests/storage-policies.sql`; tests exercise PostgreSQL metadata policies, not actual object bytes or the Storage HTTP API.

New constraints preserve existing records except a duplicate normalized matric would safely block the first transaction. Changed academic pairs are validated on update; unchanged legacy pairs and approved vendor flows survive. Comment additions do not rewrite existing comment text. Locks: unique index takes a write-blocking index-build lock; measure against a current restored production-sized copy before approving a window. The security draft uses 5-second lock/60-second statement timeouts; do not repeatedly retry a blocked production migration. No downtime duration has been measured; do not promise zero downtime.

Rollback: prefer app rollback with all feature gates false and retain compatible tables/records. Never drop requests/comments/reports to roll back UI. Preserve previous function definitions/ACLs and exact migration history. If a migration transaction fails, rollback is atomic. After commit, fixes require reviewed forward migrations; undoing RLS or privacy protections blindly is unsafe. Removing or redacting real data remains irreversible without restricted backup restoration, and is not part of these migrations. Restoring a backup requires reconciling post-backup writes and reapplying privacy restrictions. See privacy-deletion-audit.md for future erasure journal, session lockout, file manifest and resumable recovery requirements.

## Security review and boundaries

The preview views' allowlists contain product/store data, not matric/email/phone/private profiles. Shared detail RPCs require approved products/vendors or published events and return limited fields; contact numbers remain signed-in paths. Definer analytics intentionally write to admin-only tables using uid from Auth. Admin RPCs check is_admin; vendor mutations check ownership. Trigger-only helpers have revoked client EXECUTE. Public normalize_phone/slugify are pure transformations. Public next_promo_change returns only active promotion timing. Do not change these endpoints to invoker to silence warnings and break public previews. Follow [Supabase definer-view guidance](https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view) and [function exposure guidance](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

Confirmed TRUNCATE grants bypass RLS at the SQL privilege layer; PostgREST does not normally expose a truncate endpoint. This is unnecessary dangerous authority for client roles, not proof that a public HTTP truncation exploit was performed. It is fixed only in the unapplied draft and disposable tests. No exploitation of production was attempted. Preview DML is removed while SELECT remains. New discussion RPCs never expose author UUIDs and enforce self-ownership server-side; author removal redacts the public row but restricted report snapshots intentionally survive pending approved retention.

Public bucket URLs can survive moderation; account request approval is not erasure. Real Storage cleanup, session-wide post-erasure denial, age/guardian-consent arrangements, provider transfer terms and retention decisions remain release gates. Existing client file cleanup now skips deletion when a reference-count query fails; it never interprets an error as proof of zero references. Leaked-password protection advisor warning needs operator review; no production Auth setting was changed. Ordinary reporting/analytics can still be abused with repeated requests; posting rate limits are not a universal anti-abuse system.

## Release and approval sequence

A: review/test the exact integration SHA with all `js/release.js` flags false; static UI, existing APIs and support email remain compatible with current production schema. Do not publish unapproved legal notices as if legal review occurred.

B: verify an encrypted, access-restricted database backup AND bucket object/version inventory with hashes/counts, restore both into an authorised disposable target, verify Auth/Storage restoration boundaries and complete a timed production-size migration rehearsal. Record owner approval for the exact SQL, existing-data checks, lock window and recovery operator. Apply only after separate explicit permission.

C: after B passes, enable profileRepair, eventDiscussion, moderationQueue and privacyRequests in a separate reviewed commit; run real connected browser/student/vendor/admin/Storage API acceptance against an authorised isolated environment. vendorReviews stays false. Approve legal/minor/retention decisions separately. Migration alone does not justify enabling features.

Before release: recheck main has not moved, SHA/tests/preview/feature flags/routes/SMTP environment scopes, required reviewers and production backup. No direct push to main. Approval must name merge, migrations and production deployment as applicable. Verify the final production build (not only a preview rebuilt with different environment values), then check public discovery, login/logout/recovery mail, vendor editor/upload/review, mobile contact, events/moderation and installed Android update. Monitor Auth/PostgREST/Storage/notification failures and request queues, budget analytics/realtime, and moderation latency; never log passwords/matric/session tokens. Roll back application traffic to the recorded previously working deployment on confirmed regressions, leaving compatible data intact.

## Evidence and limitations

Local Node regressions and JS syntax checks execute; browser binding still fails EPERM, proxy port 8080 is unreachable, Docker is denied, and psql/Supabase CLI are unavailable here. Therefore full browser/PostgreSQL/GoTrue tests run in GitHub Actions on the integration commit; their results must be recorded rather than inferred. Production connector queries were read-only; no real user account was used for destructive tests. Rendered fixture screenshots are synthetic, not approved design-reference comparisons. Physical Android/OS installation, real mail delivery, production-sized data rehearsal, real Storage API backup/restore and complete authenticated preview acceptance have not been established. Those are blockers where relevant, not successful tests.

## Final verification record — 29 October 2026

**Tested code commit:** `9ec1ac5d92f1ef6cc2f1ccc4aec25385933223ab`.
[GitHub Actions run 40849527939](https://github.com/nosifishola-max/HikmahHub/actions/runs/40849527939): **all five jobs passed** (regression, database, authenticated, dependencies, performance). Earlier failed runs discovered and corrected the deletion label, deal CASE parsing, fixture fidelity, and browser-runner lifecycle issues; they are not counted as successful runs.

- **17 Node cases passed**, plus syntax checks and 18 actual-module browser assertions at each of 320, 360, 412, 768 and 1100px.
- **65 rendered page/viewport screenshots**, plus five account screenshots, PWA evidence and one connected-account screenshot. Artifact [android-ui-evidence](https://github.com/nosifishola-max/HikmahHub/actions/runs/40849527939/artifacts/12887070848) contains rendered fixture screenshots and performance.json; [connected-auth-ui-evidence](https://github.com/nosifishola-max/HikmahHub/actions/runs/40849527939/artifacts/12886621231) contains the real local Auth/browser account evidence. Artifacts expire; retain approved evidence in the release record before expiry.
- Synthetic UI checks now require the promotion to actually render (the fixture previously omitted a query method and silently showed no promo). They verify complete artwork, CTA URL, ordered home sections, two filters, state-preserving chips, Back/Forward, counts, deduplication, pagination, Request It, error/empty states, responsive cards, event labels, contact clearance above bottom navigation, immediate WhatsApp opening and one tracking call per tap. These tests cannot prove live marketplace data or backend permissions.
- **Actual mobile browser → pinned Supabase SDK → disposable GoTrue/PostgREST → PostgreSQL** passed signup, password login after logout, profile save, first-name event post/like/edit/remove, recent-password deletion request and logout. The test uses only localhost services, synthetic accounts and a disposable JWT signing secret. It does not contact a hosted project or use a service-role frontend key.
- Actual GoTrue-issued-token HTTP tests passed missing-profile repair, demand requests, product/event likes, private comment identifier denial, cross-user deletion denial, forged state rejection, expired AMR/session denial, idempotent requests/retries, vendor/listing/unresolved-report inventory, admin-only versioned review and signed-out request denial. Deletion requests preserve Auth users and Storage metadata rather than claiming erasure.
- Disposable SQL passed the full four-draft sequence, baseline schema contract, constraints/triggers/RPCs/RLS/role scenarios, actual client-role TRUNCATE denial, legacy approved vendor access, first-name/own edit/removal/rate/conflict checks, private Storage metadata ownership, deal snapshot/hide/duplicate/restore and public preview continuity. The pg_dump/pg_restore rehearsal passed. This is synthetic backup evidence, **not a production database or bucket backup**.
- New `tests/public-indexes.sql` captures 41 secondary indexes already present in production; PK/unique constraints supply the other 31. `tests/schema-snapshot-contract.sql` verifies all 218 baseline column/type/nullability definitions (203 base-table, 15 view), 72 indexes and valid indexes before feature drafts. Read-only catalog inspection found 110 validated constraints and 22 public triggers; constraint/trigger names were present in the original snapshot. Existing product status/date/vendor/category/trigram, event status/date and deal status/expiry indexes were preserved. Production-size timing/lock tests remain outstanding.
- Dependency install, patched Nodemailer compatibility and npm security audit passed.
- **Real Chromium service workers:** exact production v4 → new worker, Later/explicit acceptance/reload, old hh-cache cleanup, unrelated-cache preservation, changed static module delivery, excluded API responses, synthetic device-session persistence, actual test-server connection outage/offline page, and reconnection passed. Physical OS installation and a real Auth-token refresh across an installed-app update remain unverified.

Sample screenshots from earlier successful runs were downloaded from this repository's own CI artifacts and visually inspected for home, marketplace, product, event, vendor and account layouts. This was evidence retrieval, not importing an external implementation ZIP. The review led to removal of the floating profile Save control, larger secondary targets and card-image fallback. Final rendered assertions/screenshots passed after those fixes. No physical Android claim or unavailable design-reference comparison is made.

### Actual network/CPU measurements

Run 40849527939 measured the archived production/main commit `911daab4` against the release candidate, on separate cold anonymous contexts at 360px, **400ms RTT, 50,000 B/s download, 25,000 B/s upload, 4× CPU**, service workers blocked. Live read-only public data/images were used; promotional content and daily feed ordering can vary. This is a measured single before/after sample, not a statistically controlled field benchmark.

| Metric | Before | After |
|---|---:|---:|
| Initial transferred bytes | 652,249 | 345,231 |
| Requests | 52 | 39 |
| Failed requests | 0 | 0 |
| First contentful paint | 3,932ms | 3,688ms |
| Largest contentful paint | 5,312ms | 5,556ms |
| DOMContentLoaded | 4,141.1ms | 3,678.1ms |
| Static transfer | 135,972 B | 143,158 B |
| SDK transfer | 30,303 B | 29,994 B |
| API transfer | 5,994 B | 5,164 B |
| Storage/image transfer | 479,980 B | 166,915 B |

Transfer decreased by approximately 47.1%; requests decreased 25%. **LCP worsened by 244ms** in this sample. The static portion also grew. Do not describe this as an across-the-board speed improvement or imply a physical low-end-device benchmark. Recheck LCP with repeated comparable samples and real device/network acceptance before deployment approval.

### Preview evidence

Code preview: [hikmahhub-l52tg9v7m-nosifishola-maxs-projects.vercel.app](https://hikmahhub-l52tg9v7m-nosifishola-maxs-projects.vercel.app), Vercel deployment `dpl_9Py5uHmBrWyoiNz4cuMo8yU4hMNA`, READY at tested code SHA `9ec1ac5d...`, target preview. Earlier integration preview HTTP checks returned 200 for root, release switches, worker, manifest, privacy SPA route and About; the switches were false. The latest preview has not received full connected authenticated/device acceptance. READY is build evidence only. Previews use the existing project's public configuration; **do not perform mutation tests against production through them**.

### Final completion matrix

These final statuses supersede earlier “pending CI” labels. A verified test scope is named for each item.

| Requirement | Status | Verified scope / remaining condition |
|---|---|---|
| Approved home, chips/two filters, state/history, counts/pager/cards | Implemented but awaiting production deployment | Actual rendered modules/fixtures, URL/history/pagination/error tests at all five required widths |
| Product facts, gallery rendering, availability, Visit Store, mobile contact/share wiring | Implemented but awaiting production deployment | Screenshots, contact clearance and one immediate tracked WhatsApp action; actual external WhatsApp/share acceptance remains |
| Responsive vendor listing cards and named delete confirmation | Implemented but awaiting production deployment | Rendered cards and existing handlers preserved; full connected create/edit/image/delete journey remains unverified |
| Account/mobile privacy, academic choices, navigation/auth presentation | Implemented but awaiting production deployment | Legacy-value fixtures, actual signup/login/profile/logout; recovery-mail delivery remains unverified |
| Storefront/events/deals progressive loading; event metadata/promotions | Implemented but awaiting production deployment | Rendered screen/empty/error checks; storefront queries scoped to vendor, stable pagers and availability preserved |
| Profile repair, matric/academic server validation, legacy vendor access | Implemented but awaiting database migration | Real GoTrue/PostgREST plus SQL contracts; gate remains false |
| Event likes/discussion/reporting, own edit/removal and spam/conflict controls | Implemented but awaiting database migration | Real browser post/like/edit/remove; SQL/HTTP private/cross-user/admin permissions; gate remains false |
| Moderation snapshots/templates/reasons/audit and deal/comment/event actions | Implemented but awaiting database migration | Real RPC/RLS/admin denial and duplicate/version/action tests; complete connected administrative UI acceptance remains unverified |
| Secure deletion request, status/withdrawal, admin review/inventory | Implemented but awaiting database migration | Recent Auth/session/ownership/retry/inventory tests and real browser request; gate remains false |
| Immediate permanent account erasure / actual file cleanup / post-erasure universal token denial | Not completed | Deliberately not activated without verified backups, approved retention and a separately reviewed resumable executor; request-and-review is the safe shipped alternative |
| Automatic retention schedules and final legal/minor decisions | Blocked | Retention proposal and notices prepared; no schedules active; operator/legal approvals required |
| Customer vendor reviews/ratings | Deferred with justification | Issue #3 explicitly defers them; incomplete later experiment remains disabled and excluded from migrations |
| Confirmed client privilege issue and public-preview compatibility | Implemented but awaiting database migration | Actual disposable TRUNCATE denial, preview/RLS tests; production grants unchanged |
| Browser PWA lifecycle/cache/offline behavior | Completed and verified | Exact production-v4 transition in real Chromium/test server; physical installed Android and real Auth refresh continuity remain unverified |
| Database baseline/migration/backup rehearsal | Completed and verified | Isolated schema/index/constraint/role checks and synthetic database restore only |
| Real Storage HTTP/object bytes cleanup and backup/restore | Blocked | Metadata RLS tested; no authorised full Storage service/backup fixture was established in this environment |
| Complete connected vendor/admin/upload/SMTP/recovery/device acceptance | Not completed | Selected real authenticated flows passed; no fully-tested claim |
| Production database AND Storage backup/recovery | Blocked | Must verify restricted copies, manifests, integrity and restore before destructive operations or migration approval |
| Production merge/migrations/release/monitoring | Blocked | Separate owner approval plus all applicable release gates required; no production action performed |

**Recommendation: NO-GO for full v1.1 production release.** The implementation and isolated evidence are reviewable, but the remaining gates above prevent a fully tested/production-complete claim. Release A can be considered independently only after its preview/device/legal acceptance and explicit deployment approval, with all backend switches false. Do not enable Release C merely because code exists or the database rehearsal passed.

The workspace execution environment became unavailable during final evidence collection. Final SQL test additions and documentation were committed through the GitHub API with branch-head leases, preserving main and the original development history. Review the GitHub branch as the authoritative candidate; do not push the old local snapshot. The final documentation commit changes no runtime code relative to the tested code SHA above.
