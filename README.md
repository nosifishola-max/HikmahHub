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
