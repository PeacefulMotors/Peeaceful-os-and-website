import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { html } from "./page.ts";
Deno.serve(() => new Response(html, { headers: {
  "content-type": "text/html; charset=utf-8",
  "cache-control": "no-store, max-age=0",
  "x-content-type-options": "nosniff",
}}));
