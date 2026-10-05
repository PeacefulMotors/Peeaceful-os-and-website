/**
 * Peaceful Motors commercial Worker script (production 880dba0c).
 *
 * BYTE-IDENTICAL source of truth on the red-team box:
 *   /workspace/redteam-2026-10-05/commercial-ppi/dist/index.js
 *   sha256: 0b0e7ebc2d65509d94ce70f97ba483836f7776fb238916316d3da07662b86500
 * Local git commit with full deploy tree: 684239612eb60cbdd2f7befd62bfcb34ce78b310
 *
 * This path is incomplete on GitHub until `git push` of that commit (no HTTPS
 * credentials on the agent box). Do not deploy this pointer file.
 */
export default { async fetch() { return new Response("deploy/commercial-worker/dist/index.js not synced", { status: 503 }); } };
