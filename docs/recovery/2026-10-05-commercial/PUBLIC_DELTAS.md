# Public asset deltas for 4315c22e (on top of booking-v2 / 3bb576e8 assets)

## styles.css
Replace the single `:root` token `--green:#2e7d32` with `--green:#256b29`.

## sitemap.xml
Already committed at `docs/recovery/2026-10-05-commercial/public/sitemap.xml` (adds `/dashkit`).

## Nav (Dash Cams)
On Services, Explore, contact, and legal pages, after the Services link insert:
`<a href="/dashkit">Dash Cams</a>`
(matching Home / dashcam / book / prices markup). Pages touched:
services, explore, contact, policies, privacy, terms, warranty, limits-and-liability, consulting-agreement.
Handle `aria-current="page"` on Services when present.

## Full files
Complete `public/` matching live 4315c22e is on the audit box:
`/workspace/redteam-2026-10-05/commercial-cleanup/public/`
Sync remaining HTML/CSS/JS from there when convenient. Logo webp unchanged.
