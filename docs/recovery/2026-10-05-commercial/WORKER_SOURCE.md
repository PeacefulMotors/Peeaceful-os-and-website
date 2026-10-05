# Worker source for 4315c22e

Apply on top of `docs/recovery/2026-09-28-worker-corrected.js` (byte-identical to live 3bb576e8):

```bash
patch -o dist/index.js docs/recovery/2026-09-28-worker-corrected.js < academy-redirect.patch
```

Or copy the three-line `/academy` block after the `/about` redirect in `fetch()`.

Full rebuilt `dist/index.js` matching live 4315c22e is on the audit box at `/workspace/redteam-2026-10-05/commercial-cleanup/dist/index.js` (verified against Cloudflare `content/v2`). Upload that file as `dist/index.js` when syncing the full bundle if a large single-file push is deferred.
