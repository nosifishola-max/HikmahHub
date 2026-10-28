# HikmahHub v1.0
Static site (HTML/CSS/vanilla JS modules) + Supabase. Deploy on Vercel as-is (vercel.json rewrites all routes to index.html).

## Setup
1. Supabase project: `tqfgrugtgjnxlbqffmgy` (schema, RLS and storage already applied).
2. The anon key is already set in `js/config.js` (public by design). Never use the service-role key here.
3. Supabase → Auth → URL Configuration: add your Vercel URL as Site URL / redirect.
4. Sign up in the app, then make yourself admin once in the Supabase SQL editor:
   `update public.profiles set role='admin' where email='YOUR_EMAIL';`
5. Push to GitHub, import in Vercel (no build step).

## Structure
js/ (config, supabase, auth, router, nav, util) · js/pages/ (public, account, vendor, admin) · css/ · assets/ (logo, PWA icons) · manifest.webmanifest · sw.js

## Image storage and cost control
- Images only (JPG/PNG/WebP in, WebP out). No video is accepted or stored: buckets reject non-image types.
- Compressed in the browser before upload: main image max 1280px (logos 256px), plus a 400px thumbnail used by cards and lists.
- Server limits per bucket (on the compressed file): product-images 1 MB, vendor-logos 512 KB, event-images 1.5 MB.
- Files are named by content hash, so identical uploads are stored once. Max 5 images per listing and 300 listings per store (DB triggers).
- Removing an image, listing or old logo deletes its files. Admin → Storage shows usage and finds/deletes orphaned files.
- Delivery: public buckets, Cache-Control one year (safe because names are content hashes), lazy-loaded thumbnails.

## Smart branding (HikmahHub + store name on every product image)
**How it works (all in the browser, no paid service):** when a vendor picks a photo, `js/branding.js` decodes it (JPEG/PNG/WebP, EXIF-rotated), makes a private *master* (max 1600px, <=350 KB), then draws a white corner badge with the HikmahHub logo and the store name onto a 1280px copy (<=250 KB) and a 400px thumbnail. The vendor sees the branded preview before publishing. The store name is read fresh from the `vendors` row, never from form input.
**Storage:** `product-originals` (PRIVATE; owner + admin only; 512 KB limit) holds masters. `product-images` (public; 1 MB limit) holds branded display image + `_t` thumbnail, named by hash of master+design version+store name, so unchanged images are reused, never re-processed, and viewing a product never triggers processing. `product_images.path` = branded display file, `original_path` = master.
**Server-side rules (DB trigger + storage policies):** files must sit in the uploader's own vendor folder; `brand_store` is always set from the vendors table; listings cap at 5 images; vendors cannot write or read other vendors' files.
**Store renamed / design changed:** vendors press "Refresh branded images" (runs automatically after a rename). Admin -> Branding lists failed, legacy, outdated and renamed images, can regenerate 25 at a time, and "New design version" marks all as outdated after you edit the badge in `branding.js`.
**Failures:** if branding fails the listing is kept with an optimized unbranded image and the error is logged in Admin -> Branding. Failed uploads delete their partial files. Cleanup only deletes files no row references.
**Sharing:** the Share button opens a sheet: WhatsApp message (name, price, store, permanent URL), copy link, download/share the branded image (native file sharing where supported), and a generated 1080x1350 promo card. Link previews: `api/og.js` serves Open Graph tags (branded image <=250 KB) to crawlers only. Set `SUPABASE_ANON_KEY` (and optionally `SUPABASE_URL`) in Vercel env vars. Previews depend on each platform's crawler and cache; WhatsApp may cache an old preview for a while.
**Limits and costs:** masters add roughly 300 KB per photo, so a 1 GB free plan fits very roughly 1,500 photos in total (master + branded + thumb ~ 600 KB). If storage gets tight, delete masters for old listings (they are only needed to regenerate). Free-plan egress is also limited; the 250 KB branded images and 1-year caching keep it down, but heavy traffic can exceed free limits.
**Known limitation:** branding is drawn in the user's browser, so a technically skilled vendor could bypass the app and upload an unbranded image straight to the API. The database guarantees ownership and the recorded store name, not the pixels. Hardening later: move rendering to a Vercel/Edge function using the service-role key server-side.

## Local preview
Requires Node 18+. In the project folder run `npm run dev` (or `node dev-server.js`), then open the printed address (default http://localhost:5173; it moves to the next free port if busy, or set `PORT=4000`). Internet is needed (Supabase and the supabase-js CDN). `api/og.js` link previews only work on Vercel, not locally.

## v1.1: cards, install, promotions, achievements
- **Product cards:** one shared `card()` in `js/pages/public.js` (2 columns on phones, 3/4/5 on larger screens). The 1:1 image box uses `object-fit: contain` so the full photo and the branding badge stay visible. Discount % shows only when a real original price exists (Campus Deals).
- **Install button:** `index.html` captures `beforeinstallprompt` immediately; `js/pwa.js` runs the real prompt, handles accept/dismiss and `appinstalled`, hides in standalone mode, and shows Android / iOS / desktop instructions when no native prompt exists.
- **Promotions:** table `promotions` (RLS: public sees only active + in-date; admins manage), bucket `promo-banners` (public read, admin write, 512 KB). Admin -> Promotions: create, edit, delete, upload (cropped 2:1, WebP <= 200 KB), live mobile/desktop preview, validation. Expired promotions disappear automatically by date. "Sponsored" label is a manual per-promotion flag. Homepage carousel: `js/pages/promos.js`.
- **Achievements:** Vendor dashboard -> Achievements, computed from `get_top_vendors` (last 7 days). Criteria: Top 5 Trending (rank <= 5), Most Viewed (>= 10 views and the highest), Most Saved (>= 3 saves and the highest), Popular New Store (opened < 30 days ago and rank <= 10). Share as branded image or text.
- **Deploy:** no new environment variables. Run the Supabase migration already applied to the project; push and Vercel redeploys. Installed users get the new service worker (`hh-v2`) on next visit.

## v1.2: reliability fixes
- **Phone numbers:** `js/phone.js` and the database function `normalize_phone` use identical rules (08012345678 -> 2348012345678; +234 / spaces / dashes / brackets accepted; other countries need + or 00). A database trigger normalizes every vendor WhatsApp number, so bad values cannot be stored.
- **Passwords:** every password field has a show/hide eye (`js/ui.js`). Sign-up and reset ask twice (the confirmation is checked in the browser and never sent). Minimum 8 characters.
- **Forgot password:** Login -> "Forgot password?" -> email -> Supabase recovery link -> `/reset-password` (new + confirm). Same message whether or not the email exists. Needs `https://YOUR-SITE/**` in Supabase Auth -> URL Configuration -> Redirect URLs.
- **Vendor emails:** `api/notify.js` emails vendors on approve/reject (rejection includes the admin's reason). Every notification is a database row (`vendor_notifications`) so it is sent once, failures are recorded and can be retried from Admin -> Vendors ("Send email"). **Env vars to add in Vercel:** `SMTP_USER` (Gmail address), `SMTP_PASS` (Gmail *app password*), optional `MAIL_FROM`, `SMTP_HOST`, `SMTP_PORT`, `SITE_URL`; `SUPABASE_ANON_KEY` is already needed. Never put these in the code. `npm install` runs automatically on Vercel (nodemailer).
- **Rejected vendors** can edit their whole application and resubmit; review history is kept in `vendor_review_events`.
- **Listings:** drafts need only a title. Category and price are required to submit. Rejection reasons are stored (`products.review_note`) and shown to the vendor. On an approved listing, price/availability/condition/location/images save instantly; title, description, category and type changes wait for admin review in `products.pending_changes` while the live version stays online.
- **Admin:** Review tab (queue counts), vendor and listing detail with required reasons, one-click featuring (approved listings only; hiding/rejecting un-features), full audit trail in `admin_actions`.
- **Mobile bar:** 6 tabs including Sell (logged out -> sign up -> back to /vendor; student -> apply; vendor -> My store; admin -> Admin).

## v1.3: speed, compact UI, live updates
- **Loading:** first paint no longer waits for session/profile queries. Admin, vendor and account code load only when opened. Supabase JS loads as one file (UMD) instead of an ESM chain. The header logo is a 4.6 KB WebP (was 117 KB). Service worker (v3) serves the shell and static files from cache and refreshes them in the background (so after you deploy, visitors get the new version on their next visit).
- **Data:** `js/cache.js` (memory only, per-user keys, cleared on sign-out) with short TTLs: categories 10 min, trending/top vendors 2 min, lists 30-60 s, admin counts 20 s. Identical simultaneous requests are shared. Home, marketplace, deals and events fetch in parallel and never wait on categories.
- **Realtime (`js/live.js`):** signed-in users only; tables products, vendors, campus_deals, events, promotions are in the `supabase_realtime` publication (migration applied). Channels are shared, events are debounced, sockets close after 60 s in a hidden tab, retries are capped at 3. Pages also refresh on tab return and when cache TTLs expire, so everything still updates if realtime is unavailable.
- **Promotions:** the database returns only active + in-window rows; the browser re-checks at the exact next start/end time (`next_promo_change`), every 3 minutes while visible, on tab return, and on realtime changes.
- **Compact UI:** shared tokens in the `v1.3` block of `css/styles.css` (about 20-25% smaller sizes/spacing; 38 px controls, 5:4 card images, shorter banners).
- **Realtime limits:** the free plan allows about 200 concurrent realtime connections. Beyond that, clients fall back to refresh-on-return.

## v1.4: listing autosave, required title + image
- **Autosave** (`js/autosave.js`, `js/pages/listing-form.js`): saves 1.5 s after you stop typing (never per keystroke), only changed fields, one save at a time with the latest data. Status line: Saving… / All changes saved / Couldn't save changes. Retrying… / offline. It also saves when the tab is hidden or closed (a local copy first, then the server). Retries back off (3s to 60s, max 6) and resume instantly when the connection returns.
- **Where progress goes:** new listings and drafts/rejected listings are saved to their own draft row (created once, using a client-made id so a retry can never make a duplicate). Live or in-review listings are autosaved to the private `listing_autosaves` table, so the published version is never touched until the vendor taps **Save changes**. Autosave never submits, publishes or changes a status.
- **Recovery:** a local copy (form text only, no secrets; cleared on sign-out and after a successful sync) plus the server draft. On reopening, unsaved edits are restored; if the server changed the same field meanwhile you choose which version to keep. A write is refused if the row changed elsewhere (optimistic lock).
- **Images:** upload as soon as selected (new/draft listings), with Processing / Uploading / Saved / Failed states and Retry. A row is created only after every upload step succeeds; duplicate photos are skipped; failed uploads clean up their partial files. On live listings new photos are attached when you tap Save changes.
- **Required:** title (2-120 characters, trimmed) and at least one image to submit or publish, enforced in the database (any path, including admin approval). A live or in-review listing cannot lose its last image. Drafts may be incomplete (title can be empty) and are labelled "Incomplete draft".

## v1.5: admin notifications, email status, nav fix
- **Nav bug:** an earlier edit renamed the Home icon key (`home:` became `hosell:`), so `I.home` was undefined and printed "undefined". Fixed in `js/nav.js` (icon map rewritten; tests check every key).
- **Admin notifications:** table `admin_notifications` (one row per admin, own read state). Created only by database triggers when a vendor application is submitted or resubmitted, when a product ENTERS the review queue (status becomes pending), or when a live listing gets its first pending change. Drafts, autosaves, retries and ordinary edits never notify. Admins can read their own rows and mark them read (`mark_admin_notifications_read`); nobody can insert or edit them from the browser. Bell + panel: `js/notifications.js`. Realtime via Supabase Realtime (filtered to your own rows), refresh on tab return, optional device alerts after an explicit tap.
- **Email:** `api/notify.js` is admin-only. `GET /api/notify` reports which settings are missing (names only). Required Vercel variables: `SMTP_USER` (Gmail address) and `SMTP_PASS` (Gmail app password); optional `SITE_URL`, `MAIL_FROM`, `SMTP_HOST`, `SMTP_PORT`. After adding them you MUST redeploy.

## v1.7: mixed feed, link previews, campus hero
- **Mixed feed:** `search_products(..., p_sort => 'mixed', p_seed)` returns products round-robin across vendors (every vendor's first product, then every vendor's second, ...), ordered by `md5(seed || id)`: deterministic for a seed (clean "Load more", no repeats), different for a new seed, no `random()` sort, one windowed query, max 60 rows per call. The browser keeps a seed for as long as you keep browsing and rotates it after 20 minutes away (`js/seed.js`). Default sort is now "Recommended"; Newest / Oldest / price sorts are unchanged. Logged-out previews use the same idea, seeded by the day.
- **Link previews:** `api/og.js` returns real metadata in the first HTML response for crawlers (WhatsApp, Facebook, X, Telegram, Slack, LinkedIn, Discord, Google...) on /shop/:store/:product, /shop/:store, /events/:slug, /events, /deals, /marketplace. The home page's tags are in `index.html` itself (absolute URLs). Add `?og=1` to any of those URLs in a browser to see exactly what crawlers get. Images: product photo, event banner, store cover (a recent product photo) then logo, else `/assets/og-home.jpg` (1200x630).
- **Hero photo:** `assets/hero-campus-720.webp` (20 KB, phones) and `hero-campus-1280.webp` (37 KB, wide screens), cropped from the Al-Hikmah building photo, behind a dark-green gradient; plain green shows if the photo fails.

## v1.8: product gallery, viewer, watermark, likes
- **Gallery** (`js/gallery.js`): native scroll-snap swipe (smooth on low-end phones, vertical page scrolling unaffected), square contain-fit frame so nothing is cropped or stretched, thumbnail strip with highlight, `1/4` counter, desktop arrows, first image eager and neighbours preloaded, the 400px thumbnail shows instantly while the 1280px image fades in. The empty box is reserved as a square, so nothing jumps while loading.
- **Full-screen viewer** (same file): tap the photo. Swipe between photos, pinch-zoom, double-tap zoom, pan, Esc / arrow keys, mouse-wheel zoom, focus trap, scroll lock, phone Back button closes it. Opens on the photo you tapped and returns the gallery to the photo you ended on.
- **Watermark (design v2)** (`js/branding.js`, `assets/logo-wm.png`): small white HikmahHub logo with the store name under it, bottom-right, soft shadow, no box. Baked into the delivered image so downloads and shares carry it; the private original master is never modified. The gallery adds no CSS overlay, so there is no double watermark. After deploying: Admin -> Branding -> **Regenerate all** rebuilds existing images in the new design from the private masters.
- **Likes** reuse the existing favourites table `product_saves` (one row per user and product = no duplicates). `get_product_likes` gives the count + "did I like it" in one call (works logged out), `set_product_like` is idempotent. Only approved products from approved stores can be liked. The old Save button is replaced by the heart; the Saved page is now "Liked products".


## v1.1 development

See [release review, migration, verification and rollback notes](docs/v1.1-release.md). Run `npm test` for offline regression tests. Database changes are review-only and require explicit approval before production application.

Latest release decision: [pre-deployment audit, measured performance and remaining gates](docs/predeployment-audit.md).

Privacy/account deletion development: [workflow, security audit and release checklist](docs/privacy-deletion-audit.md) and [unapproved retention proposal](docs/data-retention-proposal.md). The account feature records reviewed deletion requests; permanent self-service erasure and automatic retention deletion are not enabled.

Coordinated release integration: [current matrix, migration order, security findings and approval gates](docs/integration-release.md). Earlier records describe historical test scopes. Database-dependent controls default off in `js/release.js`; vendor reviews remain deferred per Issue #3.
