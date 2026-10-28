# Owner Android feedback — 2026-10-26

No production migration or deployment was performed. Changes are in development branch / draft PR #4.

## Findings from read-only production inspection

- Two `auth.users` records have no corresponding `public.profiles` row. The existing auth-user insert trigger exists, but it does not repair historical gaps. Both `product_saves.user_id` and `demand_requests.user_id` reference profiles. Missing profiles reproduce the FK failure and product-like failure in a disposable authenticated environment. This does not prove every observed like failure has that cause; unrelated network/session errors remain possible.
- `event_likes` and `event_comments` do not exist in the existing project. The preview's discussion UI requires the unapplied v1.1 schema. Changing error copy alone cannot enable it.

## Changes

- Homepage introduces HikmahHub as Al-Hikmah University's marketplace in Ilorin, including vendors, buying/selling, services, item requests, events and opportunities. Search remains prominent; initial modules remain lazy. SEO description updated.
- Promotional artwork retains its natural ratio; each active slide determines track height rather than the tallest offscreen slide. Artwork remains uncropped; unseen artwork still loads only when selected.
- Mobile account header, grouped personal/university fields, sticky save controls, matric placeholder `26/01HUI001`, official faculty/department dropdowns, dependent options, and explicit legacy options. Selecting another faculty does not silently clear an existing department. The server rejects incompatible changes; unchanged historical pairs remain permitted. Approved vendors retain dashboard access without completing historical details. Vendor applications use the same catalogue.
- `ensure_my_profile()` repairs only the authenticated user's missing profile from its authoritative auth row. It never accepts caller-supplied IDs or roles, never overwrites existing profile/vendor rows, and grants no anonymous execution. Demand/save insert triggers enforce matching caller ownership and repair the gap before FK checking. Existing FK/RLS checks stay enabled; no production backfill was run.
- Server-side changed-field validation for name, normalized matric, phone, level and faculty/department combinations. Old academic values remain valid when unchanged. Requests now disable duplicate submits, await profile readiness, and show friendly success/failure text instead of database internals.
- Moderation queue: reason/status, stored content snapshot, vendor where relevant, direct content/comment links, historical current-context fallback explicitly labelled, editable shared message templates, and reason-required decisions. Supports dismiss, request listing changes, reject/hide listing, suspend vendor, reject vendor application, hide event/comment and state-checked restore. Existing detailed admin review panels remain available. Existing deal reports link to their review panel; the new decision RPC deliberately rejects unsupported deal-specific transitions instead of guessing them.
- Decision RPC checks admin role in the database, locks reports/targets, compares expected report status, prevents duplicate/state-invalid actions, and appends administrator/reason/timestamp records to `admin_actions`. Templates and snapshots remain admin-only; comment authors expose first names, never private profile IDs.

## Academic source and naming caveats

Source: https://alhikmahuniversity.edu.ng/programmes/ reviewed 2026-10-26. Its faculty navigation uses Basic Medical Sciences while the programme body uses Health Sciences; Computing department names also differ between body/navigation. The catalogue uses the faculty navigation with listed programme aliases for departments, plus the listed College of Health Sciences. It does not silently rename existing Health Sciences/Sociology/etc. values. Owner/university review of these naming inconsistencies is still recommended. No runtime university-page fetch or new dependency is added.

## Migration order and rollback

Both drafts remain unapplied: `db/v1_1.sql`, then `db/android-fixes.sql`. Generate timestamped migrations with Supabase CLI before any approved application. Review schema drift, backups and the earlier deployment audit first. A real verified production database/Storage recovery plan and separate owner approval remain required. Never reset/seed the existing project. New catalogue/templates are application configuration, not replacement user data.

Do not restore an old snapshot over current user data to roll back UI changes. Roll back app code while retaining schema additions. Any trigger/policy/RPC reversal needs a separate reviewed migration and approval. Preserve report snapshots and moderation audit records. The profile repair is lazy per authenticated caller; no bulk deletion or identity reassignment is involved.

## Verification evidence and limits

CI run 40252647049 passed database draft application/contracts, role checks, backup/restore, dependency audit and **real GoTrue + PostgREST authenticated HTTP tests**, using disposable localhost containers and synthetic users. This does not create a Supabase project or access hosted test accounts. Actual auth schema migrations issue real sign-in tokens; Auth UID helpers read PostgREST JWT claims. Storage remains a compatibility stub and SMTP is not exercised.

The authenticated suite checks sign-up/login, caller-only repair, FK-backed demand insertion, product-like insertion, event likes/comments, private identifier denial, report snapshot, admin hide/restore, audit ownership/reason and duplicate-action rejection. The roles suite tests changed academic pair rejection, valid profile saving, normalized uniqueness, legacy vendor access and student moderation denial. Not every moderation action or every product/upload/email workflow has complete HTTP/browser coverage yet.

Offline browser fixtures cover account header/placeholder, dependent options and legacy retention; these are labelled mocked UI checks. Exact Playwright viewport checks and screenshots are collected at 320/360/390/768/1280px as `android-ui-evidence` CI artifacts, alongside the separate live-read throttled homepage measurement. Synthetic screenshots contain no production student data.

Remaining blockers: production schema is still unchanged, so the current preview's event and missing-profile fixes cannot be confirmed there until migrations receive approval; owner retest on Android; fully connected browser journeys for every moderation action, uploads, SMTP and session expiry; private Storage integration; university naming review; production backup verification. Prior predeployment release gates still apply. Recommendation remains NO-GO for production until those gates are closed. Passing disposable backend tests are evidence of the proposed fixes, not a claim that production is repaired.
