"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import { parsePastedParts } from "../lib/parse-parts.mjs";
import {
  Camera, Plus, Trash2, Loader2, AlertTriangle, Copy, Download, Printer,
  Car, Wrench, X, Search, MapPin, ChevronDown, Store, Stethoscope, ImagePlus,
  CheckCircle2, Circle, User, FileText, BarChart3, ShieldCheck, Save, Check, Mail
} from "lucide-react";

const C_DAY = {
  // Light theme. Brand maroon/green are unchanged - they still read well as
  // solid button fills against a light page.
  maroon: "#7A1F1F", maroonDark: "#5E1515", green: "#2E7D32",
  ink: "#FBF8F5", panel: "#FFFFFF", line: "#E2DAD2", amber: "#B8860B", red: "#B3261E",
};
const C_NIGHT = {
  // Night theme: same brand colors, dark surfaces, accents brightened just
  // enough to stay legible on dark. Toggled from the header; saved per shop.
  maroon: "#7A1F1F", maroonDark: "#5E1515", green: "#43A047",
  ink: "#161311", panel: "#221D1A", line: "#3B332E", amber: "#D9A441", red: "#EF5350",
};
const C = C_DAY;
// PLATFORM_HQ: true only in the SOLO app build. The solo app is command —
// it carries the Platform HQ panel that manages every licensed shop's tier.
const PLATFORM_HQ = true;

// ---- WHITE-LABEL BRAND CONFIG ----------------------------------------
// To sell this to another shop, this block (plus SERVICE_MENU and LOCAL
// below) is everything that changes. One edit, whole app rebrands.
// Shared app-level API token, sent on every call to a protected route so the
// Worker can tell a real app instance from an anonymous internet request.
// Baked in at BUILD time from NEXT_PUBLIC_APP_TOKEN (this is a static-export
// app - any client-side value ends up in the shipped JS, visible to anyone
// who inspects it). This is a real, meaningful step up from nothing: it
// blocks casual/automated abuse (bots scanning for open endpoints, scripted
// spam) that doesn't bother reading the app's own code. It is NOT equivalent
// to per-technician login-verified sessions - a determined attacker who
// extracts this token from the bundle could still call the routes with it.
// True per-user, revocable authentication needs a real server-side session
// store (Supabase) checking who is actually logged in on every request -
// that's the next real step, not a replacement for this one.
const APP_TOKEN = process.env.NEXT_PUBLIC_APP_TOKEN || "";
function apiFetch(url, opts = {}) {
  return fetch(url, { ...opts, headers: { ...(opts.headers || {}), "X-App-Token": APP_TOKEN } });
}

const BRAND = {
  name: "PEACEFUL MOTORS",
  tagline: "An Ease of Mind is Simply Divine.",
  phone: "314-919-7456",
  email: "frederickm@peacefulmotors.com",
  site: "peacefulmotors.com",
};

// ---- Secure backend call target. In your real Next.js deployment this hits
// YOUR api route (app/api/claude/route.js, included alongside this file),
// which holds the Anthropic key server-side. It will 404 in a bare claude.ai
// preview since that route only exists once you deploy — that's expected.
const API_BASE = "/api/claude";

// ---- Storage abstraction. Uses the artifact's built-in window.storage when
// present (claude.ai preview only). On your real deployment this is a stub —
// swap it for real calls to your Supabase `estimates` table.
import { createClient } from "@supabase/supabase-js";

// ---- Storage abstraction. Real server-side persistence via Supabase once
// NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set (see
// Supabase_Setup.pdf for the exact table to create) - falls back to browser
// localStorage, unchanged from how this app has always worked, when they
// aren't set. Deliberately a binary choice, never a silent mix of both, so
// there's never a question of which one is the real data.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = (SUPABASE_URL && SUPABASE_ANON_KEY) ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const store = supabase ? {
  async set(key, value) {
    try {
      const { error } = await supabase.from("app_data").upsert({ key, value: JSON.stringify(value), updated_at: new Date().toISOString() });
      if (error) throw error;
      return true;
    } catch (e) { return null; }
  },
  async get(key) {
    try {
      const { data, error } = await supabase.from("app_data").select("value").eq("key", key).maybeSingle();
      if (error) throw error;
      return data ? { value: data.value } : null;
    } catch (e) { return null; }
  },
  async list(prefix) {
    try {
      const { data, error } = await supabase.from("app_data").select("key").like("key", (prefix || "") + "%");
      if (error) throw error;
      return { keys: (data || []).map((r) => r.key) };
    } catch (e) { return null; }
  },
  async delete(key) {
    try {
      const { error } = await supabase.from("app_data").delete().eq("key", key);
      if (error) throw error;
      return true;
    } catch (e) { return null; }
  },
} : {
  async set(key, value) { try { localStorage.setItem("pm:" + key, JSON.stringify(value)); return true; } catch (e) { return null; } },
  async get(key) { try { const v = localStorage.getItem("pm:" + key); return v == null ? null : { value: v }; } catch (e) { return null; } },
  async list(prefix) { try { const keys = Object.keys(localStorage).filter(k => k.startsWith("pm:" + (prefix || ""))).map(k => k.slice(3)); return { keys }; } catch (e) { return null; } },
  async delete(key) { try { localStorage.removeItem("pm:" + key); return true; } catch (e) { return null; } },
};

const CATEGORIES = [
  { key: "domestic", label: "Domestic" }, { key: "foreign", label: "Foreign" },
  { key: "exotic", label: "Exotic" }, { key: "diesel", label: "Diesel" },
  { key: "lawn", label: "Lawn & Equipment" },
];
const OP_GROUPS = [
  { key: "body", label: "Body" }, { key: "paint", label: "Paint" },
  { key: "mechanical", label: "Mechanical" }, { key: "frame", label: "Frame" },
];
const STATUSES = ["Draft", "Review", "Approved", "In Progress", "Completed"];
const FOLDERS = ["New", "Waiting", "Finished", "Closed"];

// Customer community guidelines — members sign these to get in; owner can pause anyone.
const CUST_GUIDELINES = [
  "Be decent — no harassment, hate, or personal attacks.",
  "Everyone's welcome here regardless of how much you know about cars going in — no condescension, no talking down to anyone for asking a basic question.",
  "No spam, scams, or selling — swap posts are for members' own parts only.",
  "Advice here is neighbor-to-neighbor: verify anything safety-critical with a professional before relying on it.",
  "No posting anyone's personal info, photos of people without permission, or private pricing.",
  "Keep it legal — no stolen parts, odometer tricks, or inspection dodges. Ever.",
  "Breaking these can pause or remove access — the shop's call is final.",
];

// Academy — in-house training modules (premium feature; per-tech completion tracked).
const ACADEMY = [
  ["Safety first", "PPE every job. Jack stands always — never wheels-off on a jack alone. Battery disconnected before electrical work. No body parts under unsupported loads."],
  ["Customer-home conduct", "Drop cloths and clean hands at every home. No promises beyond the written estimate — pricing questions go to the owner. Leave it cleaner than you found it."],
  ["Estimating standard", "Photograph cause AND correction. Verify prices with the supplier before quoting. Check hours against the licensed guide. Approve drafted lines only when you'd stake your name on them."],
  ["Documentation", "Before, during, after — every job. Label photos in Media. The customer report is what turns a repair into a referral."],
  ["Messaging compliance", "Text only when the consent box is checked. Every message honors STOP the moment it arrives. Never argue by text — call."],
  ["Authorization & supplements", "Signature before wrenches turn. Found more damage? STOP — supplement approved in writing before continuing. Replaced parts saved for the customer."],
  ["ADAS calibration awareness", "Any windshield, bumper, or alignment job on a newer vehicle may disturb a camera or radar sensor the driver-assist features depend on. If the vehicle has lane-keep, adaptive cruise, or automatic braking, check whether the job you just did requires a calibration before it goes back to the customer — this is a real, billable service category now, not an afterthought."],
  ["One-time-use parts", "Some fasteners and parts are engineered to be replaced, not reused, once removed: torque-to-yield head bolts, stake/crimp-style axle nuts, self-locking nuts, cotter pins and safety wire, crush washers on drain plugs and banjo fittings, and any airbag/SRS component that was disturbed. Flag these on the estimate as parts, not just labor — reusing them is a comeback waiting to happen."],
  ["Key programming basics", "Know the difference before you quote it: adding a key when a working key exists is usually straightforward. All-keys-lost is a different job — it often needs a security bypass or dealer-level access, and takes real extra time. Confirm which situation you're in before giving a customer a number."],
];

// ASE certification study track — in-house study outlines written for this
// shop. NOT affiliated with or endorsed by ASE; these are original prep
// notes describing what each certification area covers so a tech knows what
// to study. Official tests, registration, and prep: ase.com. No ASE test
// content is reproduced here — that material is theirs.
const ASE_TRACK = [
  ["G1 — Auto Maintenance & Light Repair", "The entry cert — where a new tech or a service writer building credibility starts. Study focus: fluid types and where each goes, filter and belt inspection, tire wear patterns and rotation, battery testing and safe jump procedure, wiper/bulb/fuse service, and reading a maintenance schedule. If you can walk a customer through WHY each 30k/60k/90k item exists, you're ready.", "1 year hands-on OR relevant training"],
  ["A1 — Engine Repair", "Mechanical health of the engine itself. Study focus: compression and leak-down testing and what the numbers mean, cooling system diagnosis (thermostat, water pump, head gasket symptoms), lubrication system and oil pressure diagnosis, timing components, valve train noise identification, and gasket/seal replacement practice. Know how to tell a mechanical problem from a management problem — that call decides the whole estimate.", "2 years hands-on (1 with training)"],
  ["A2 — Automatic Transmission / Transaxle", "Study focus: fluid condition as a diagnostic tool, pressure testing, torque converter symptoms vs. internal clutch symptoms, shift solenoid and valve body electrical diagnosis, and when a fluid service helps vs. when it's too late. Mobile reality: know precisely which jobs are driveway-doable (external sensors, coolers, mounts, service) and which need a lift and a bench.", "2 years hands-on (1 with training)"],
  ["A3 — Manual Drive Train & Axles", "Study focus: clutch diagnosis (slip vs. chatter vs. release problems), hydraulic vs. cable actuation, CV axle and U-joint inspection, differential noise diagnosis by load condition, and transfer case basics for 4WD trucks. Axle and clutch work is core mobile territory — this cert maps directly to jobs we already sell.", "2 years hands-on (1 with training)"],
  ["A4 — Suspension & Steering", "Study focus: reading tire wear like a report card, ball joint and tie rod measurement (not just the shake test — actual spec), strut vs. shock diagnosis, steering rack leak assessment, wheel bearing noise isolation, and alignment angle theory — caster, camber, toe, and what each does to the car. We inspect this on every Tier 2; certifying makes those findings carry weight.", "2 years hands-on (1 with training)"],
  ["A5 — Brakes", "The highest-volume cert for this shop. Study focus: hydraulic theory and pedal-feel diagnosis, measuring rotors and drums against spec instead of eyeballing, brake noise root causes, ABS wheel-speed sensor testing, electronic parking brake service procedures, and brake fluid testing/flush intervals. Every tech writing brake estimates should hold this one — it's the cert customers understand instantly.", "2 years hands-on (1 with training)"],
  ["A6 — Electrical / Electronic Systems", "Study focus: voltage drop testing (the skill that separates parts-changers from diagnosticians), reading wiring diagrams, parasitic draw hunting, charging and starting system testing in the correct order, ground circuit faults, and network/CAN basics — why one dead module can take down three systems. Pairs directly with our audio/electronics install work.", "2 years hands-on (1 with training)"],
  ["A7 — Heating & Air Conditioning", "Study focus: pressure readings and what each pair means, refrigerant identification and why cross-contamination wrecks equipment, EPA 609 certification (legally required to buy and handle refrigerant — get this FIRST), compressor clutch vs. internal failure, blend door and actuator diagnosis, and heater core flow testing. Note: 609 is a separate EPA credential from this ASE cert — we require 609 before any tech touches a charged system.", "2 years hands-on (1 with training)"],
  ["A8 — Engine Performance", "The driveability cert. Study focus: five-gas theory and what each reading points to, fuel trim interpretation (the fastest window into an engine's health), misfire isolation, ignition system scope patterns, O2/AF sensor behavior, EVAP system logic, and catalytic converter efficiency diagnosis. This is the cert behind our diagnostic tiers — it's how the $95/$150/$295 levels earn their prices.", "2 years hands-on (1 with training)"],
  ["A9 — Light Vehicle Diesel Engines", "Our $225/hr flag says diesel — this cert backs it up. Study focus: high-pressure common rail theory and safety (never crack a live HP line), glow plug system diagnosis, DPF regeneration logic and why deleted trucks are refused, DEF/SCR system faults, turbo diagnosis (boost leaks vs. actuator vs. bearing), and hard-start diagnosis order on a diesel. The 2-hour minimum exists because diesel diagnosis done right takes real time — this module is why.", "2 years hands-on (1 with training)"],
  ["C1 — Automobile Service Consultant", "The service-writer cert — built for the front of the house, no wrench time required. Study focus: translating tech findings into customer language, estimate construction and presentation, warranty and authorization law basics, telephone and complaint-handling skill, and shop workflow management. For a writer who didn't come up under a hood, this is the credential that says: I speak both languages.", "2 years service-consultant experience (1 with training)"],
  ["Master Technician path", "Hold A1 through A8 simultaneously and ASE recognizes Master Automobile Technician status. Realistic order for this shop's work mix: A5 brakes → A4 suspension → A6 electrical → A8 performance → A7 HVAC (with EPA 609 first) → A1 engine → A3 manual → A2 automatic — then A9 to match the diesel flag. Certs renew every 5 years; the owner tracks expiration dates in the crew matrix below.", "A1–A8 all current"],
];

// Platform release notes — owner-only panel; product voice, no personal names.
// Business Shield — owner-only legal template library (starting points; attorney finalizes).
const SHIELD_DOCS = [
  ["Technician Conduct & Disclaimer Acknowledgment", "TECHNICIAN ACKNOWLEDGMENT\n\nI will: follow the written estimate — no extra work without documented customer approval; photograph cause and correction on every job; obtain the customer's signature before repairs begin; only text customers whose consent box is checked, honoring STOP immediately; keep replaced parts for customer return; report any injury, damage, or dispute to the owner the same day.\nI understand drafted estimate content requires my human review before it reaches a customer, and that pay, scheduling, and discipline are governed by shop policy, not this app.\n\nTechnician: __________________  Signature: __________________  Date: ________"],
  ["Shop Warranty Policy Statement", "LIMITED REPAIR WARRANTY\n\nThis shop warrants its repairs for 12 months or 12,000 miles, whichever comes first, covering the parts installed and the labor to install them. The warranty excludes: unrelated failures, customer-supplied parts (parts warranty only, per the supplier), damage from misuse, racing, commercial overload, or continued operation after a warning sign. Warranty service requires the original invoice; remedy is repair or replacement of the covered work. This statement supplements, and does not replace, rights under state law. Attorney finalizes before public posting."],
  ["Warranty / Insurance Claim Checklist", "CLAIM FILE CHECKLIST — attach to the job\n\n1. Customer authorization signed BEFORE teardown. 2. Warranty company / insurer name + contract or claim number on the estimate. 3. Cause-and-correction photos (before, during, after). 4. Administrator contacted BEFORE repairs for authorization number: ______  Rep: ______  Date/time: ______. 5. Approved amount and any customer-pay difference documented in writing. 6. Final invoice + photos + authorization number submitted together. 7. Payment terms noted (administrator pays in ___ days; customer signs responsibility for non-covered balance)."],
  ["Vehicle Release & Storage Notice", "VEHICLE RELEASE\n\nI accept return of my vehicle and acknowledge the work performed as invoiced. Personal property was removed or is my responsibility. Vehicles left more than ___ days after completed-work notice may accrue storage of $___/day as permitted by law, and unclaimed-vehicle remedies may apply. Balance due before release unless arranged in writing.\n\nCustomer: __________________  Signature: __________________  Date: ________"],
  ["Sublet / Overflow Job Referral Agreement", "SUBLET AGREEMENT — between " + BRAND.name + " and the receiving shop\n\nWhen this shop is at capacity, a job may be referred to another shop under these terms:\n1. The customer is told plainly which shop is doing the work and consents before the vehicle transfers.\n2. The referring shop discloses its referral fee (if any) to the customer if required by law.\n3. The receiving shop carries its own garage liability and labor/parts warranty — this shop makes no warranty on work it did not perform.\n4. Payment for the sublet job is collected by the shop that actually did the work, unless otherwise agreed in writing.\n5. Any dispute about the sublet job's quality is between the customer and the receiving shop; the referring shop is not liable for another shop's workmanship.\n6. Both shops keep a signed copy of this agreement plus the specific job details (customer, vehicle, date, scope) on a per-job addendum.\n\nReferring shop: __________________  Signature: __________________  Date: ________\nReceiving shop: __________________  Signature: __________________  Date: ________"],
  ["Inspection Service Agreement", "PRE-PURCHASE / CONDITION INSPECTION AGREEMENT\n\nThis inspection is a visual and operational check at the tier selected (Essential/Standard/Comprehensive), performed without disassembly, at the time and place stated. It is not a guarantee against future failure, not a warranty, and not a substitute for the buyer's own review of title and history reports. Findings reflect only what was reasonably observable that day — conditions can change or be discovered only after disassembly or extended use. The customer's decision to purchase, repair, or decline the vehicle is their own.\n\nCustomer: __________________  Signature: __________________  Date: ________"],
];

const RELEASE_NOTES = [
  ["3.7", "Owner menu · account vs shop settings · subscribed-shops view · roles & pay on the roster · community board + parts swap · messaging service with on-my-way and reminder texts · assistant upgrade · automated self-check workflow"],
  ["3.6", "Desktop and tablet layouts · on-screen assistant on every page · added legal notices"],
  ["3.5", "Per-shop feature switches · shop update log · consent gate on every outbound text"],
  ["3.0–3.4", "Schedule board redesign · one-time terms acceptance · login emails with temporary-code reset · document library in web and print formats"],
  ["2.x", "Photo estimating with line-by-line approval · invoicing & payment collection · signatures · bookings · parts catalog · media reports · guides · dispatch · customer portal"],
  ["1.x", "Core estimator · labor rates by area · printable customer documents"],
];

// Licensed labor-guide / wiring sources — launchers only. No guide content is
// ever copied into this app: that's what keeps it copyright-clean & sellable.
const GUIDE_SOURCES = [
  { key: "motor", name: "MOTOR (US/Canada labor times — data API available)", url: "https://www.motor.com" },
  { key: "prodemand", name: "Mitchell 1 ProDemand (US cars/light trucks + wiring)", url: "https://www.prodemand.com" },
  { key: "alldata", name: "ALLDATA (OEM procedures + wiring diagrams)", url: "https://www.alldata.com" },
  { key: "truckseries", name: "Mitchell 1 TruckSeries (Class 4-8 diesel labor + wiring)", url: "https://www.mitchell1.com" },
  { key: "haynespro", name: "HaynesPro (UK/EU coverage + wiring schematics)", url: "https://www.haynespro.com" },
  { key: "autodata", name: "Autodata (broad overseas coverage)", url: "https://www.autodata-group.com" },
  { key: "emanuals", name: "eManuals (wiring diagrams + repair manuals, paid subscription)", url: "https://www.emanuals.com" },
  { key: "laborguides", name: "Labor-Guides.com (labor time reference, paid subscription)", url: "https://labor-guides.com" },
  { key: "napaestimator", name: "NAPA Auto Care Repair Estimator (free, general ballpark)", url: "https://www.napaonline.com/en/auto-care/car-repair-estimator" },
  { key: "laborratehero", name: "LaborRateHero (free, ZIP-based - body/collision labor rates specifically, not general mechanical)", url: "https://www.laborratehero.com" },
];
const CONDITIONS = ["OEM", "Aftermarket", "Recycled"];

// Peaceful Motors service menu — flat items use your set price; hourly items
// price at the active area's labor rate. Edit freely to match your website menu.
const SERVICE_MENU = [
  { label: "Mobile Diagnostic Visit (incl. 1 hr — $40 credits toward repair)", flat: 100 },
  { label: "Level 2 Full Diagnosis ($40 credits toward repair)", flat: 150 },
  { label: "Front brake pads & rotors", hrs: 1.5, group: "mechanical" },
  { label: "Rear brake pads & rotors", hrs: 1.5, group: "mechanical" },
  { label: "A/C evac & recharge", hrs: 1.5, group: "mechanical" },
  { label: "A/C leak check & diagnosis", hrs: 1, group: "mechanical" },
  { label: "Oil change & inspection", hrs: 0.5, group: "mechanical" },
  { label: "Battery test & replacement", hrs: 0.5, group: "mechanical" },
  { label: "Starter replacement", hrs: 2, group: "mechanical" },
  { label: "Alternator replacement", hrs: 2, group: "mechanical" },
  { label: "Engine swap (same engine) — teardown confirm & deposit required", hrs: 16, group: "mechanical" },
];

const LOCAL = {
  car: [
    { name: "NAPA / O'Reilly / AutoZone", meta: "local counters — domestic & foreign" },
    { name: "OEM dealer / online OEM", meta: "exotic & OEM-specific parts" },
  ],
  diesel: [
    { name: "Degel Truck Center", meta: "Hazelwood · Hino/Isuzu, OEM + aftermarket" },
    { name: "Truck Parts & Sales Co.", meta: "St. Louis · since 1948, Mack & hard-to-find" },
    { name: "Rush Truck Centers", meta: "Pontoon Beach · online + local inventory check" },
  ],
  lawn: [
    { name: "Art's Lawn Mower Shop", meta: "Florissant 63033 · (314) 741-1055 · Deere/Kubota/Toro/Stihl/Echo/Briggs" },
    { name: "Eljay Lawn Products", meta: "St. Louis · (314) 727-1171 · mower & OPE parts" },
  ],
};

let ID = 1;
const newRow = (over = {}) => ({
  id: ID++, desc: "", part: "", opGroup: "mechanical",
  cost: "", markup: "40", price: "", manualPrice: false,
  condition: "Aftermarket", supplier: "", availability: "", priceDate: "",
  core: "", hrs: "", teardown: false,
  aiDraft: false, confidence: "", note: "", priceBusy: false, priceSrc: "",
  // The overrides MUST come last. Without this spread every value passed in
  // (description, hours, part cost) was silently discarded and every "Add"
  // button produced a blank line.
  ...over,
});
// Original starting-point time ranges, reasoned independently — not copied or adapted from
// Mitchell, ALLDATA, Chilton, or any other published labor guide. Deliberately given as
// ranges, not false-precision decimals, because real time varies by vehicle, access, and
// condition. Always confirm against the actual job.
// Fleet canned job packages - each bundles several line items (labor + a
// placeholder parts line) that get added to an estimate in one click, for
// fast build-outs on repeat fleet work. Prices are ranges/starting points,
// same honest-range approach as the rest of the labor guide - confirm exact
// parts cost per vehicle before invoicing.
const FLEET_PACKAGES = [
  { name: "Fleet PM Package - Light Duty", desc: "Oil/filter change, tire rotation, fluid top-off, 21-point inspection", items: [
    { desc: "Oil & filter change", hrs: 0.5, part: "Oil + filter (typical)", partCost: 45 },
    { desc: "Tire rotation", hrs: 0.4, part: "", partCost: 0 },
    { desc: "Multi-point fluid check & top-off", hrs: 0.3, part: "Misc. fluids", partCost: 15 },
    { desc: "21-point inspection", hrs: 0.3, part: "", partCost: 0 },
  ]},
  { name: "Fleet PM Package - Diesel/Work Truck", desc: "Diesel oil/filter change, fuel filter, DEF check, brake inspection, 21-point inspection", items: [
    { desc: "Diesel oil & filter change", hrs: 0.8, part: "Diesel oil + filter (typical)", partCost: 85 },
    { desc: "Fuel filter replacement", hrs: 0.5, part: "Fuel filter", partCost: 35 },
    { desc: "DEF level check & top-off", hrs: 0.2, part: "DEF fluid", partCost: 15 },
    { desc: "Brake inspection (all 4 corners)", hrs: 0.4, part: "", partCost: 0 },
    { desc: "21-point inspection", hrs: 0.3, part: "", partCost: 0 },
  ]},
  { name: "Fleet Brake Package", desc: "Front or rear pads + rotors, brake fluid flush", items: [
    { desc: "Brake pads & rotors, one axle", hrs: 1.5, part: "Pads + rotors (typical)", partCost: 140 },
    { desc: "Brake fluid flush", hrs: 0.5, part: "Brake fluid", partCost: 15 },
  ]},
  { name: "Fleet Pre-Trip Safety Package", desc: "DOT-style pre-trip inspection, tire/brake/light check, fluid top-off", items: [
    { desc: "Pre-trip safety inspection", hrs: 0.7, part: "", partCost: 0 },
    { desc: "Tire tread & pressure check", hrs: 0.2, part: "", partCost: 0 },
    { desc: "Lights & signals check", hrs: 0.2, part: "", partCost: 0 },
    { desc: "Fluid top-off", hrs: 0.2, part: "Misc. fluids", partCost: 15 },
  ]},
];

const COMMON_REPAIRS = [
// Original starting-point time ranges, reasoned independently - not copied or adapted
// from Mitchell, ALLDATA, Chilton, or any other published labor guide. Given as ranges,
// not false-precision decimals, because real time varies by vehicle, access, and
// condition. These are GENERAL job-type estimates, not vehicle-specific - a brake job
// on a compact car and a 3500-series truck are not the same job. Always confirm against
// the actual vehicle in front of you.
  { cat: "Body & Frame", name: "Front bumper cover R&R", lo: 0.8, hi: 1.5 },
  { cat: "Body & Frame", name: "Rear bumper cover R&R", lo: 0.8, hi: 1.5 },
  { cat: "Body & Frame", name: "Fender replacement (bolt-on)", lo: 1.0, hi: 2.0 },
  { cat: "Body & Frame", name: "Door skin / shell replacement", lo: 3.0, hi: 6.0 },
  { cat: "Body & Frame", name: "Hood replacement & align", lo: 1.0, hi: 2.0 },
  { cat: "Body & Frame", name: "Windshield replacement", lo: 1.0, hi: 2.0 },
  { cat: "Body & Frame", name: "Frame measurement (initial pull setup & diagnosis)", lo: 1.5, hi: 3.0 },
  { cat: "Body & Frame", name: "Frame straightening (per section pulled)", lo: 2.0, hi: 5.0 },
  { cat: "Body Refinish/Paint", name: "Single panel refinish (blend into 1 adjacent)", lo: 3.0, hi: 5.0 },
  { cat: "Body Refinish/Paint", name: "Bumper cover refinish", lo: 2.5, hi: 4.0 },
  { cat: "Body Refinish/Paint", name: "Full vehicle repaint (base/clear)", lo: 16.0, hi: 30.0 },
  { cat: "Brakes", name: "Front brake pads (both sides)", lo: 0.8, hi: 1.3 },
  { cat: "Brakes", name: "Rear brake pads (both sides)", lo: 0.8, hi: 1.3 },
  { cat: "Brakes", name: "Front pads & rotors (both sides)", lo: 1.2, hi: 1.8 },
  { cat: "Brakes", name: "Rear pads & rotors (both sides)", lo: 1.2, hi: 1.8 },
  { cat: "Brakes", name: "Brake caliper (one side)", lo: 0.8, hi: 1.5 },
  { cat: "Brakes", name: "Master cylinder", lo: 1.2, hi: 2.2 },
  { cat: "Brakes", name: "Brake fluid flush", lo: 0.5, hi: 0.8 },
  { cat: "Brakes", name: "Parking brake shoes/cable", lo: 1.0, hi: 2.0 },
  { cat: "Electrical", name: "Battery replacement & test", lo: 0.3, hi: 0.6 },
  { cat: "Electrical", name: "Alternator", lo: 1.0, hi: 2.5 },
  { cat: "Electrical", name: "Starter", lo: 1.0, hi: 2.5 },
  { cat: "Electrical", name: "Diagnose check engine light (no repair)", lo: 0.5, hi: 1.5 },
  { cat: "Electrical", name: "Ignition switch / lock cylinder", lo: 1.0, hi: 2.5 },
  { cat: "Electrical", name: "Power window regulator/motor (one door)", lo: 1.0, hi: 2.0 },
  { cat: "Engine", name: "Water pump", lo: 1.5, hi: 3.5 },
  { cat: "Engine", name: "Serpentine belt", lo: 0.4, hi: 1.0 },
  { cat: "Engine", name: "Timing belt (interference engine)", lo: 3.0, hi: 6.0 },
  { cat: "Engine", name: "Spark plugs (4-cyl)", lo: 0.6, hi: 1.2 },
  { cat: "Engine", name: "Spark plugs (6-cyl)", lo: 1.0, hi: 2.0 },
  { cat: "Engine", name: "Spark plugs (8-cyl, rear-of-engine access)", lo: 2.0, hi: 4.0 },
  { cat: "Engine", name: "Oil change (conventional)", lo: 0.3, hi: 0.5 },
  { cat: "Engine", name: "Valve cover gasket (one side)", lo: 1.0, hi: 2.5 },
  { cat: "Engine", name: "Head gasket (single head)", lo: 8.0, hi: 16.0 },
  { cat: "Engine", name: "Oil pan gasket / seal", lo: 1.5, hi: 4.0 },
  { cat: "Engine", name: "Engine overhaul, in-frame (gasoline)", lo: 20.0, hi: 40.0 },
  { cat: "Engine", name: "Engine replacement (short/long block swap)", lo: 8.0, hi: 16.0 },
  { cat: "Cooling & HVAC", name: "Radiator", lo: 1.2, hi: 2.5 },
  { cat: "Cooling & HVAC", name: "Thermostat", lo: 0.6, hi: 1.5 },
  { cat: "Cooling & HVAC", name: "Radiator hose (upper or lower)", lo: 0.4, hi: 1.0 },
  { cat: "Cooling & HVAC", name: "A/C compressor", lo: 2.0, hi: 4.0 },
  { cat: "Cooling & HVAC", name: "A/C recharge & leak check", lo: 1.0, hi: 1.5 },
  { cat: "Cooling & HVAC", name: "Blower motor", lo: 1.0, hi: 2.5 },
  { cat: "Steering & Suspension", name: "Front strut (one side)", lo: 1.2, hi: 2.2 },
  { cat: "Steering & Suspension", name: "Shock absorber (one side)", lo: 0.8, hi: 1.5 },
  { cat: "Steering & Suspension", name: "Control arm / ball joint (one side)", lo: 1.0, hi: 2.0 },
  { cat: "Steering & Suspension", name: "Wheel bearing / hub assembly (one side)", lo: 1.0, hi: 2.0 },
  { cat: "Steering & Suspension", name: "Power steering rack", lo: 2.0, hi: 4.0 },
  { cat: "Steering & Suspension", name: "Tie rod end (one side)", lo: 0.8, hi: 1.5 },
  { cat: "Steering & Suspension", name: "Wheel alignment", lo: 0.8, hi: 1.2 },
  { cat: "Exhaust", name: "Muffler / exhaust section", lo: 0.8, hi: 1.8 },
  { cat: "Exhaust", name: "Catalytic converter", lo: 1.5, hi: 3.0 },
  { cat: "Exhaust", name: "Oxygen sensor", lo: 0.5, hi: 1.0 },
  { cat: "Drivability/Fuel", name: "Fuel pump", lo: 1.5, hi: 3.5 },
  { cat: "Drivability/Fuel", name: "Fuel injector (one)", lo: 0.8, hi: 2.0 },
  { cat: "Drivability/Fuel", name: "ABS module R&R (programming included)", lo: 1.0, hi: 2.0 },
  { cat: "Diesel", name: "Fuel filter/water separator service", lo: 0.5, hi: 1.0 },
  { cat: "Diesel", name: "Glow plugs (set)", lo: 1.0, hi: 2.5 },
  { cat: "Diesel", name: "EGR valve/cooler", lo: 1.5, hi: 4.0 },
  { cat: "Diesel", name: "DPF (diesel particulate filter) service/R&R", lo: 2.0, hi: 5.0 },
  { cat: "Diesel", name: "Turbocharger R&R", lo: 3.0, hi: 8.0 },
  { cat: "Diesel", name: "Injector (one, high-pressure common-rail)", lo: 1.5, hi: 4.0 },
  { cat: "Diesel", name: "Engine overhaul, in-frame (diesel)", lo: 30.0, hi: 55.0 },
  { cat: "Small Engine", name: "Mower blade sharpen/balance & oil change", lo: 0.5, hi: 1.0 },
  { cat: "Small Engine", name: "Mower deck belt / idler pulley", lo: 0.5, hi: 1.2 },
  { cat: "Small Engine", name: "Small engine carburetor clean/rebuild", lo: 1.0, hi: 2.5 },
  { cat: "Small Engine", name: "Small engine full teardown/overhaul", lo: 3.0, hi: 6.0 },
  { cat: "Small Engine", name: "Push mower - full tune-up (plug, filter, oil, blade)", lo: 0.8, hi: 1.3 },
  { cat: "Small Engine", name: "Push mower - carburetor rebuild", lo: 1.0, hi: 1.8 },
  { cat: "Small Engine", name: "Push mower - recoil/pull cord starter", lo: 0.6, hi: 1.2 },
  { cat: "Small Engine", name: "Push mower - primer bulb/fuel line replacement", lo: 0.4, hi: 0.8 },
  { cat: "Small Engine", name: "Push mower - won't start, full diagnosis", lo: 0.5, hi: 1.2 },
  { cat: "Small Engine", name: "Push mower - blade brake clutch cable", lo: 0.5, hi: 1.0 },
  { cat: "Small Engine", name: "Riding mower/zero-turn - full tune-up", lo: 1.0, hi: 1.8 },
  { cat: "Small Engine", name: "Riding mower - deck belt replacement", lo: 0.8, hi: 1.5 },
  { cat: "Small Engine", name: "Riding mower - drive belt replacement", lo: 0.8, hi: 1.5 },
  { cat: "Small Engine", name: "Riding mower - spindle/pulley assembly (each)", lo: 0.7, hi: 1.3 },
  { cat: "Small Engine", name: "Riding mower - PTO clutch", lo: 1.0, hi: 2.0 },
  { cat: "Small Engine", name: "Riding mower - hydrostatic transmission fluid service", lo: 0.6, hi: 1.0 },
  { cat: "Small Engine", name: "Riding mower - hydrostatic transmission R&R", lo: 2.5, hi: 5.0 },
  { cat: "Small Engine", name: "Riding mower - steering component/tie rod", lo: 0.7, hi: 1.3 },
  { cat: "Small Engine", name: "Riding mower - seat safety switch", lo: 0.4, hi: 0.8 },
  { cat: "Small Engine", name: "Riding mower - battery & charging check", lo: 0.4, hi: 0.7 },
  { cat: "Small Engine", name: "Riding mower - starter motor", lo: 0.8, hi: 1.5 },
  { cat: "Small Engine", name: "Riding mower - deck leveling/adjustment", lo: 0.5, hi: 0.9 },
  { cat: "Small Engine", name: "Riding mower - wheel bearing (each)", lo: 0.6, hi: 1.1 },
  { cat: "Small Engine", name: "String trimmer - carburetor clean/rebuild", lo: 0.6, hi: 1.2 },
  { cat: "Small Engine", name: "String trimmer - trimmer head replacement", lo: 0.3, hi: 0.6 },
  { cat: "Small Engine", name: "String trimmer - drive shaft/cable", lo: 0.6, hi: 1.1 },
  { cat: "Small Engine", name: "String trimmer - won't start diagnosis", lo: 0.5, hi: 1.0 },
  { cat: "Small Engine", name: "Leaf blower - carburetor service", lo: 0.6, hi: 1.2 },
  { cat: "Small Engine", name: "Leaf blower - impeller/fan housing", lo: 0.6, hi: 1.2 },
  { cat: "Small Engine", name: "Leaf blower - ignition coil", lo: 0.5, hi: 1.0 },
  { cat: "Small Engine", name: "Chainsaw - chain & bar service", lo: 0.3, hi: 0.6 },
  { cat: "Small Engine", name: "Chainsaw - clutch/sprocket replacement", lo: 0.7, hi: 1.3 },
  { cat: "Small Engine", name: "Chainsaw - oiler pump repair", lo: 0.6, hi: 1.2 },
  { cat: "Small Engine", name: "Chainsaw - carburetor rebuild", lo: 0.7, hi: 1.3 },
  { cat: "Small Engine", name: "Chainsaw - won't start, full diagnosis", lo: 0.5, hi: 1.1 },
  { cat: "Small Engine", name: "Snow blower - auger belt/cable", lo: 0.7, hi: 1.3 },
  { cat: "Small Engine", name: "Snow blower - shear pins", lo: 0.3, hi: 0.6 },
  { cat: "Small Engine", name: "Snow blower - chute/cable assembly", lo: 0.6, hi: 1.1 },
  { cat: "Small Engine", name: "Snow blower - skid shoe adjustment", lo: 0.3, hi: 0.5 },
  { cat: "Small Engine", name: "Snow blower - full pre-season tune-up", lo: 0.8, hi: 1.5 },
  { cat: "Small Engine", name: "Pressure washer - pump replacement/rebuild", lo: 1.0, hi: 2.0 },
  { cat: "Small Engine", name: "Pressure washer - unloader valve", lo: 0.6, hi: 1.1 },
  { cat: "Small Engine", name: "Pressure washer - won't build pressure diagnosis", lo: 0.5, hi: 1.1 },
  { cat: "Small Engine", name: "Generator - full tune-up", lo: 0.8, hi: 1.5 },
  { cat: "Small Engine", name: "Generator - brushes/voltage regulator", lo: 0.8, hi: 1.5 },
  { cat: "Small Engine", name: "Generator - carburetor service", lo: 0.7, hi: 1.3 },
  { cat: "Small Engine", name: "Generator - won't produce power diagnosis", lo: 0.6, hi: 1.3 },
  { cat: "Small Engine", name: "Tiller/cultivator - tines & gearbox service", lo: 0.8, hi: 1.6 },
  { cat: "Small Engine", name: "Tiller - carburetor rebuild", lo: 0.7, hi: 1.3 },
  { cat: "Small Engine", name: "Hedge trimmer - blade sharpen/gearbox service", lo: 0.5, hi: 1.0 },
  { cat: "Small Engine", name: "Edger - blade & drive service", lo: 0.5, hi: 0.9 },
  { cat: "Small Engine", name: "Log splitter - hydraulic pump/valve service", lo: 1.0, hi: 2.0 },
  { cat: "Small Engine", name: "Small engine - compression test & diagnosis", lo: 0.5, hi: 1.0 },
  { cat: "Small Engine", name: "Small engine - full teardown/overhaul", lo: 3.0, hi: 6.0 },
  { cat: "Small Engine", name: "Small engine - cylinder/piston replacement", lo: 2.5, hi: 5.0 },
  { cat: "Small Engine", name: "Small engine - governor adjustment", lo: 0.4, hi: 0.8 },
  { cat: "Small Engine", name: "Small engine - flywheel key replacement", lo: 0.6, hi: 1.2 },
  { cat: "Small Engine", name: "Small engine - valve adjustment", lo: 0.7, hi: 1.3 },
  { cat: "Diesel", name: "DEF (diesel exhaust fluid) pump", lo: 1.5, hi: 3.0 },
  { cat: "Diesel", name: "DEF injector/doser", lo: 1.0, hi: 2.0 },
  { cat: "Diesel", name: "DEF tank & sending unit", lo: 1.5, hi: 3.0 },
  { cat: "Diesel", name: "DEF heater element", lo: 1.2, hi: 2.5 },
  { cat: "Diesel", name: "NOx sensor (each)", lo: 0.8, hi: 1.5 },
  { cat: "Diesel", name: "SCR catalyst/system service", lo: 2.0, hi: 4.0 },
  { cat: "Diesel", name: "Diesel particulate sensor", lo: 0.8, hi: 1.5 },
  { cat: "Diesel", name: "High-pressure fuel pump", lo: 3.0, hi: 6.0 },
  { cat: "Diesel", name: "Low-pressure lift pump", lo: 1.0, hi: 2.0 },
  { cat: "Diesel", name: "Fuel rail & pressure sensor", lo: 1.2, hi: 2.5 },
  { cat: "Diesel", name: "Injector wiring harness (valve cover harness)", lo: 1.5, hi: 3.0 },
  { cat: "Diesel", name: "Injector O-rings/seals (set)", lo: 1.0, hi: 2.0 },
  { cat: "Diesel", name: "High-pressure fuel line (each)", lo: 0.8, hi: 1.5 },
  { cat: "Diesel", name: "Low-pressure fuel line/hose", lo: 0.6, hi: 1.2 },
  { cat: "Diesel", name: "Fuel tank sending unit", lo: 1.0, hi: 2.0 },
  { cat: "Diesel", name: "EGR cooler (separate from radiator)", lo: 2.5, hi: 5.0 },
  { cat: "Diesel", name: "EGR valve position sensor", lo: 0.6, hi: 1.2 },
  { cat: "Diesel", name: "MAP/boost pressure sensor", lo: 0.5, hi: 1.0 },
  { cat: "Diesel", name: "Turbo actuator", lo: 1.5, hi: 3.0 },
  { cat: "Diesel", name: "Turbo wastegate", lo: 1.5, hi: 3.0 },
  { cat: "Diesel", name: "Turbo intercooler/boost pipe", lo: 1.5, hi: 3.0 },
  { cat: "Diesel", name: "Boost leak diagnosis (smoke test)", lo: 0.8, hi: 1.5 },
  { cat: "Diesel", name: "Exhaust manifold (each side)", lo: 2.0, hi: 4.0 },
  { cat: "Diesel", name: "Up-pipes (common diesel failure point)", lo: 3.0, hi: 6.0 },
  { cat: "Diesel", name: "Exhaust brake system", lo: 1.5, hi: 3.0 },
  { cat: "Diesel", name: "Block heater", lo: 0.7, hi: 1.3 },
  { cat: "Diesel", name: "Engine oil cooler", lo: 1.5, hi: 3.0 },
  { cat: "Diesel", name: "Crankcase ventilation (CCV) filter/valve", lo: 0.6, hi: 1.2 },
  { cat: "Diesel", name: "Glow plug controller module", lo: 0.8, hi: 1.5 },
  { cat: "Diesel", name: "Diesel-rated starter (higher torque)", lo: 1.2, hi: 2.5 },
  { cat: "Diesel", name: "Diesel oil pan gasket (larger capacity)", lo: 2.0, hi: 4.0 },
  { cat: "Diesel", name: "Valve cover gasket, diesel", lo: 1.5, hi: 3.0 },
  { cat: "Diesel", name: "Timing gear cover", lo: 4.0, hi: 8.0 },
  { cat: "Diesel", name: "Vibration damper/harmonic balancer, diesel", lo: 2.0, hi: 4.0 },
  { cat: "Diesel", name: "Serpentine belt, diesel (dual/wide)", lo: 0.6, hi: 1.2 },
  { cat: "Diesel", name: "Fan clutch, diesel", lo: 1.0, hi: 2.0 },
  { cat: "Diesel", name: "Water pump, diesel (often gear-driven)", lo: 2.5, hi: 5.0 },
  { cat: "Diesel", name: "Thermostat housing, diesel", lo: 1.0, hi: 2.0 },
  { cat: "Diesel", name: "Forced/parked regen procedure", lo: 0.5, hi: 1.0 },
  { cat: "Diesel", name: "Fuel filter housing/head replacement", lo: 1.0, hi: 2.0 },
  { cat: "Diesel", name: "Diesel-specific scan tool diagnosis (no repair)", lo: 0.8, hi: 1.8 },
  { cat: "Diesel", name: "Air intake heater/grid heater", lo: 0.8, hi: 1.5 },
  { cat: "Diesel", name: "Diesel engine overhaul, out-of-frame (major)", lo: 40.0, hi: 70.0 },
  { cat: "Diesel", name: "Injector cup/sleeve replacement", lo: 3.0, hi: 6.0 },
  { cat: "Body & Frame", name: "Quarter panel replacement", lo: 4.0, hi: 8.0 },
  { cat: "Body & Frame", name: "Rocker panel replacement", lo: 3.0, hi: 6.0 },
  { cat: "Body & Frame", name: "Roof skin replacement", lo: 5.0, hi: 10.0 },
  { cat: "Body & Frame", name: "Trunk lid/deck lid R&R", lo: 1.0, hi: 2.0 },
  { cat: "Body & Frame", name: "Tailgate R&R", lo: 1.0, hi: 2.0 },
  { cat: "Body & Frame", name: "Grille replacement", lo: 0.5, hi: 1.2 },
  { cat: "Body & Frame", name: "Headlight assembly (each)", lo: 0.5, hi: 1.2 },
  { cat: "Body & Frame", name: "Taillight assembly (each)", lo: 0.4, hi: 1.0 },
  { cat: "Body & Frame", name: "Side mirror (power, each)", lo: 0.5, hi: 1.0 },
  { cat: "Body & Frame", name: "Door handle, exterior (each)", lo: 0.6, hi: 1.2 },
  { cat: "Body & Frame", name: "Weatherstripping (per door)", lo: 0.5, hi: 1.0 },
  { cat: "Body & Frame", name: "Body mount replacement (each)", lo: 1.0, hi: 2.0 },
  { cat: "Body & Frame", name: "Radiator support/core support", lo: 2.0, hi: 4.0 },
  { cat: "Body & Frame", name: "Fender liner/splash shield", lo: 0.4, hi: 0.8 },
  { cat: "Body & Frame", name: "Wheel well liner", lo: 0.5, hi: 1.0 },
  { cat: "Body & Frame", name: "Moulding/trim piece replacement", lo: 0.4, hi: 0.9 },
  { cat: "Body & Frame", name: "Emblem/badge replacement", lo: 0.2, hi: 0.5 },
  { cat: "Body & Frame", name: "Paintless dent repair - small (coin-size)", lo: 0.5, hi: 1.0 },
  { cat: "Body & Frame", name: "Paintless dent repair - medium (palm-size)", lo: 1.0, hi: 2.0 },
  { cat: "Body & Frame", name: "Paintless dent repair - large panel", lo: 2.0, hi: 4.0 },
  { cat: "Body & Frame", name: "Hail damage assessment (per vehicle)", lo: 0.8, hi: 1.5 },
  { cat: "Body & Frame", name: "Color match & blend, one panel", lo: 3.0, hi: 5.0 },
  { cat: "Body & Frame", name: "Clear coat only, one panel", lo: 2.0, hi: 3.5 },
  { cat: "Body & Frame", name: "Plastic bumper crack/tab repair (vs replace)", lo: 1.5, hi: 3.0 },
  { cat: "Body & Frame", name: "Bedliner spray-in", lo: 2.0, hi: 4.0 },
  { cat: "Body & Frame", name: "Rust repair/patch panel, small", lo: 2.0, hi: 4.0 },
  { cat: "Body & Frame", name: "Rust repair/patch panel, large", lo: 4.0, hi: 8.0 },
  { cat: "Body & Frame", name: "Floor pan repair section", lo: 4.0, hi: 8.0 },
  { cat: "Body & Frame", name: "Cowl panel replacement", lo: 1.5, hi: 3.0 },
  { cat: "Body & Frame", name: "A/B/C-pillar cosmetic repair (non-structural)", lo: 2.0, hi: 4.0 },
  { cat: "Body & Frame", name: "Convertible top replacement", lo: 3.0, hi: 6.0 },
  { cat: "Body & Frame", name: "Sunroof glass replacement", lo: 1.5, hi: 3.0 },
  { cat: "Body & Frame", name: "Glass-out paint job, additional labor", lo: 1.0, hi: 2.0 },
  { cat: "Body & Frame", name: "Wet sand & buff, full vehicle", lo: 3.0, hi: 6.0 },
  { cat: "Body & Frame", name: "Ceramic coating application", lo: 3.0, hi: 6.0 },
  { cat: "Body & Frame", name: "Vinyl wrap, partial (hood/roof)", lo: 3.0, hi: 6.0 },
  { cat: "Body & Frame", name: "Vinyl wrap, full vehicle", lo: 12.0, hi: 24.0 },
  { cat: "Body & Frame", name: "Chrome delete (trim wrap)", lo: 2.0, hi: 4.0 },
  { cat: "Body & Frame", name: "Decal/graphics removal", lo: 1.0, hi: 2.5 },
  { cat: "Small Engine", name: "Riding mower - ignition switch", lo: 0.5, hi: 1.0 },
  { cat: "Small Engine", name: "Riding mower - solenoid replacement", lo: 0.5, hi: 1.0 },
  { cat: "Small Engine", name: "Riding mower - fuel shutoff solenoid", lo: 0.5, hi: 1.0 },
  { cat: "Small Engine", name: "Riding mower - grass catcher/bagger drive", lo: 0.6, hi: 1.2 },
  { cat: "Small Engine", name: "Riding mower - front axle/spindle service", lo: 1.0, hi: 2.0 },
  { cat: "Small Engine", name: "Push mower - self-propel drive cable", lo: 0.6, hi: 1.2 },
  { cat: "Small Engine", name: "Push mower - wheel height adjuster", lo: 0.4, hi: 0.8 },
  { cat: "Small Engine", name: "Push mower - safety bail cable/switch", lo: 0.5, hi: 1.0 },
  { cat: "Small Engine", name: "Zero-turn - lap bar/control linkage adjustment", lo: 0.6, hi: 1.2 },
  { cat: "Small Engine", name: "Zero-turn - caster wheel/bearing", lo: 0.6, hi: 1.2 },
  { cat: "Small Engine", name: "Chainsaw - anti-vibration mount replacement", lo: 0.5, hi: 1.0 },
  { cat: "Small Engine", name: "Chainsaw - decompression valve", lo: 0.5, hi: 1.0 },
  { cat: "Small Engine", name: "String trimmer - clutch/drum assembly", lo: 0.6, hi: 1.2 },
  { cat: "Small Engine", name: "String trimmer - ignition coil", lo: 0.5, hi: 1.0 },
  { cat: "Small Engine", name: "Leaf blower - tube/nozzle clip repair", lo: 0.2, hi: 0.5 },
  { cat: "Small Engine", name: "Snow blower - impeller replacement", lo: 1.2, hi: 2.2 },
  { cat: "Small Engine", name: "Snow blower - drive disc/friction wheel", lo: 1.0, hi: 2.0 },
  { cat: "Small Engine", name: "Snow blower - electric start motor", lo: 0.6, hi: 1.2 },
  { cat: "Small Engine", name: "Generator - spark plug & oil service", lo: 0.4, hi: 0.7 },
  { cat: "Small Engine", name: "Generator - transfer switch wiring check", lo: 0.6, hi: 1.2 },
  { cat: "Small Engine", name: "Pressure washer - hose/quick-connect repair", lo: 0.3, hi: 0.6 },
  { cat: "Electrical", name: "Wiring fault - open circuit, traced with test light (no repair)", lo: 0.6, hi: 1.5 },
  { cat: "Electrical", name: "Wiring fault - short to ground, traced (no repair)", lo: 0.8, hi: 2.0 },
  { cat: "Electrical", name: "Wiring repair - single wire splice/repair, accessible", lo: 0.5, hi: 1.2 },
  { cat: "Electrical", name: "Wiring repair - chafed harness section, sleeved/repaired", lo: 1.0, hi: 2.5 },
  { cat: "Electrical", name: "Connector - corroded terminal, cleaned/repinned (each)", lo: 0.4, hi: 1.0 },
  { cat: "Electrical", name: "Ground strap - corroded/broken, replaced", lo: 0.4, hi: 0.8 },
  { cat: "Electrical", name: "Fuse box - repeated blown fuse, root-cause diagnosis", lo: 0.8, hi: 2.0 },
  { cat: "Electrical", name: "Relay - stuck/failed, replaced (each)", lo: 0.3, hi: 0.7 },
  { cat: "Electrical", name: "Body control module - no-communication diagnosis", lo: 0.8, hi: 2.0 },
  { cat: "Electrical", name: "Body control module - replacement & programming", lo: 1.5, hi: 3.0 },
  { cat: "Electrical", name: "Wiring harness - rodent damage repair, localized", lo: 1.5, hi: 3.5 },
  { cat: "Electrical", name: "Wiring harness - rodent damage repair, extensive", lo: 4.0, hi: 8.0 },
  { cat: "Electrical", name: "Headlight wiring/socket repair (each)", lo: 0.5, hi: 1.2 },
  { cat: "Electrical", name: "Trailer wiring harness/plug repair", lo: 0.6, hi: 1.5 },
  { cat: "Electrical", name: "Alternator wiring - charge circuit voltage drop diagnosis", lo: 0.6, hi: 1.5 },
  { cat: "Electrical", name: "Starter wiring - cranking circuit voltage drop diagnosis", lo: 0.6, hi: 1.5 },
  { cat: "Electrical", name: "Intermittent electrical fault - wiggle test diagnosis", lo: 0.8, hi: 2.0 },
  { cat: "Electrical", name: "Aftermarket accessory wiring - improper install correction", lo: 0.8, hi: 2.0 },
  { cat: "Brakes", name: "Brake booster/vacuum assist unit", lo: 1.2, hi: 2.2 },
  { cat: "Brakes", name: "Brake line, single section (rust repair)", lo: 1.0, hi: 2.0 },
  { cat: "Brakes", name: "ABS sensor (each)", lo: 0.5, hi: 1.2 },
  { cat: "Brakes", name: "ABS module fault diagnosis (no repair)", lo: 0.7, hi: 1.5 },
  { cat: "Engine", name: "PCV valve/hose", lo: 0.4, hi: 0.9 },
  { cat: "Engine", name: "Engine mount (each)", lo: 1.0, hi: 2.0 },
  { cat: "Engine", name: "Camshaft/crankshaft position sensor (each)", lo: 0.5, hi: 1.2 },
  { cat: "Engine", name: "Intake manifold gasket", lo: 1.5, hi: 3.0 },
  { cat: "Engine", name: "Timing cover seal", lo: 2.0, hi: 4.0 },
  { cat: "Drivetrain & Axles", name: "Wheel speed sensor, drivetrain-side (each)", lo: 0.5, hi: 1.2 },
  { cat: "Transmission", name: "Shift solenoid (each)", lo: 1.5, hi: 3.0 },
  { cat: "Cooling & HVAC", name: "Heater core", lo: 3.0, hi: 6.0 },
  { cat: "Cooling & HVAC", name: "Cooling fan/fan clutch", lo: 1.0, hi: 2.0 },
  { cat: "Cooling & HVAC", name: "Coolant flush & fill", lo: 0.6, hi: 1.0 },
  { cat: "Cooling & HVAC", name: "A/C condenser", lo: 1.5, hi: 3.0 },
  { cat: "Steering & Suspension", name: "Sway bar link (each)", lo: 0.5, hi: 1.0 },
  { cat: "Steering & Suspension", name: "Sway bar bushing (each)", lo: 0.6, hi: 1.2 },
  { cat: "Steering & Suspension", name: "Coil spring (each)", lo: 1.2, hi: 2.5 },
  { cat: "Steering & Suspension", name: "Leaf spring (each, truck)", lo: 2.0, hi: 4.0 },
  { cat: "Exhaust", name: "Exhaust manifold gasket", lo: 1.5, hi: 3.0 },
  { cat: "Exhaust", name: "Flex pipe/connector repair", lo: 0.8, hi: 1.6 },
  { cat: "Exhaust", name: "Exhaust hanger/bracket replacement", lo: 0.4, hi: 0.8 },
  { cat: "Drivability/Fuel", name: "Throttle body service/cleaning", lo: 0.6, hi: 1.2 },
  { cat: "Drivability/Fuel", name: "Idle air control valve", lo: 0.6, hi: 1.2 },
  { cat: "Drivability/Fuel", name: "Fuel pressure regulator", lo: 0.8, hi: 1.6 },
  { cat: "Drivability/Fuel", name: "Evaporative emissions (EVAP) system diagnosis", lo: 0.8, hi: 1.8 },
  { cat: "Drivability/Fuel", name: "Mass airflow (MAF) sensor", lo: 0.4, hi: 0.9 },
  { cat: "Small Engine", name: "Riding mower - deck spindle bearing (each)", lo: 0.7, hi: 1.3 },
  { cat: "Small Engine", name: "Riding mower - transmission belt", lo: 0.8, hi: 1.5 },
  { cat: "Small Engine", name: "Riding mower - clutch/brake pedal linkage", lo: 0.6, hi: 1.2 },
  { cat: "Small Engine", name: "Riding mower - headlight/wiring repair", lo: 0.4, hi: 0.9 },
  { cat: "Small Engine", name: "Push mower - throttle cable", lo: 0.4, hi: 0.8 },
  { cat: "Small Engine", name: "Push mower - choke linkage adjustment", lo: 0.3, hi: 0.6 },
  { cat: "Small Engine", name: "Push mower - muffler/spark arrestor", lo: 0.4, hi: 0.8 },
  { cat: "Small Engine", name: "Zero-turn - hydro pump service", lo: 1.5, hi: 3.0 },
  { cat: "Small Engine", name: "Zero-turn - deck belt tensioner", lo: 0.6, hi: 1.2 },
  { cat: "Small Engine", name: "Chainsaw - fuel line/filter replacement", lo: 0.4, hi: 0.8 },
  { cat: "Small Engine", name: "Chainsaw - bar oil pump", lo: 0.6, hi: 1.2 },
  { cat: "Small Engine", name: "String trimmer - fuel line replacement", lo: 0.3, hi: 0.6 },
  { cat: "Small Engine", name: "Leaf blower - fuel line/filter", lo: 0.3, hi: 0.6 },
  { cat: "Small Engine", name: "Snow blower - track/wheel replacement", lo: 0.7, hi: 1.3 },
  { cat: "Small Engine", name: "Snow blower - engine won't start, cold-weather diagnosis", lo: 0.6, hi: 1.3 },
  { cat: "Small Engine", name: "Generator - fuel valve/petcock replacement", lo: 0.4, hi: 0.8 },
  { cat: "Small Engine", name: "Generator - full teardown/overhaul", lo: 3.0, hi: 6.0 },
  { cat: "Small Engine", name: "Pressure washer - engine service (oil, plug, filter)", lo: 0.5, hi: 1.0 },
  { cat: "Small Engine", name: "Tiller - engine mount/frame repair", lo: 0.8, hi: 1.6 },
  { cat: "Small Engine", name: "Hedge trimmer - carburetor rebuild", lo: 0.6, hi: 1.2 },
  { cat: "Small Engine", name: "Edger - carburetor rebuild", lo: 0.6, hi: 1.2 },
  { cat: "Small Engine", name: "Log splitter - engine service", lo: 0.5, hi: 1.0 },
  { cat: "Small Engine", name: "Go-kart/mini-bike - carburetor & clutch service", lo: 0.8, hi: 1.6 },
  { cat: "Small Engine", name: "ATV/UTV small-displacement - basic tune-up", lo: 1.0, hi: 2.0 },
  { cat: "Body & Frame", name: "Door glass regulator/motor (each)", lo: 1.0, hi: 2.0 },
  { cat: "Body & Frame", name: "Windshield wiper linkage/motor", lo: 0.8, hi: 1.6 },
  { cat: "Body & Frame", name: "Antenna replacement", lo: 0.3, hi: 0.7 },
  { cat: "Body & Frame", name: "Running board/step bar", lo: 0.8, hi: 1.6 },
  { cat: "Body & Frame", name: "Bed liner (drop-in)", lo: 0.5, hi: 1.0 },
  { cat: "Body & Frame", name: "Tailgate liner/cap", lo: 0.5, hi: 1.0 },
  { cat: "Body & Frame", name: "Door check strap/hinge", lo: 0.8, hi: 1.6 },
  { cat: "Body & Frame", name: "Fuel door/hinge repair", lo: 0.3, hi: 0.7 },
  { cat: "Body & Frame", name: "Interior trim panel replacement (each)", lo: 0.5, hi: 1.2 },
  { cat: "Body & Frame", name: "Headliner replacement", lo: 2.0, hi: 4.0 },
  { cat: "Body & Frame", name: "Seat cover/upholstery repair (each)", lo: 1.0, hi: 2.5 },
  { cat: "Body & Frame", name: "Carpet replacement/repair", lo: 1.5, hi: 3.5 },
  { cat: "Body & Frame", name: "Dash panel/gauge cluster bezel", lo: 0.6, hi: 1.3 },
  { cat: "Body & Frame", name: "Center console repair/replacement", lo: 0.8, hi: 1.8 },
  { cat: "Body & Frame", name: "Wheel well moulding", lo: 0.4, hi: 0.9 },
  { cat: "Body & Frame", name: "Rocker panel moulding/trim", lo: 0.4, hi: 0.9 },
  { cat: "Body & Frame", name: "Roof rack/rail replacement", lo: 0.6, hi: 1.3 },
  { cat: "Body & Frame", name: "Spoiler/wing replacement", lo: 0.8, hi: 1.6 },
  { cat: "Body & Frame", name: "Skid plate/undercarriage panel", lo: 0.6, hi: 1.3 },
  { cat: "Body & Frame", name: "Front/rear splash guard set", lo: 0.5, hi: 1.0 },
  { cat: "Body & Frame", name: "Frame rust treatment/undercoating (per section)", lo: 1.0, hi: 2.5 },
  { cat: "Diesel", name: "Air-to-air intercooler hose (each)", lo: 0.8, hi: 1.6 },
  { cat: "Diesel", name: "Turbo speed sensor", lo: 0.8, hi: 1.6 },
  { cat: "Diesel", name: "Fuel injection pump timing check", lo: 1.0, hi: 2.0 },
  { cat: "Diesel", name: "Cold start advance/aid system repair", lo: 0.8, hi: 1.6 },
  { cat: "Diesel", name: "Exhaust gas temperature (EGT) sensor (each)", lo: 0.5, hi: 1.0 },
  { cat: "Diesel", name: "Diesel fuel tank replacement", lo: 2.0, hi: 4.0 },
  { cat: "Diesel", name: "Diesel fuel tank sending unit", lo: 1.0, hi: 2.0 },
  { cat: "Diesel", name: "Aftertreatment control module", lo: 1.5, hi: 3.0 },
  { cat: "Diesel", name: "Coolant heater/engine block heater repair", lo: 0.8, hi: 1.6 },
  { cat: "Diesel", name: "Vibration damper/harmonic balancer", lo: 2.0, hi: 4.0 },
  { cat: "Diesel", name: "Diesel clutch replacement (manual)", lo: 5.0, hi: 9.0 },
  { cat: "Diesel", name: "PTO (power take-off) service", lo: 1.5, hi: 3.0 },
  { cat: "Diesel", name: "Air compressor (air brake system)", lo: 2.0, hi: 4.0 },
  { cat: "Diesel", name: "Air dryer (air brake system)", lo: 1.0, hi: 2.0 },
  { cat: "Diesel", name: "Fifth wheel/hitch service", lo: 1.0, hi: 2.5 },
  { cat: "Diesel", name: "Diesel radiator", lo: 2.0, hi: 4.0 },
  { cat: "Diesel", name: "Diesel A/C compressor", lo: 2.5, hi: 5.0 },
  { cat: "Diesel", name: "Diesel starter, heavy duty", lo: 1.5, hi: 3.0 },
  { cat: "Diesel", name: "Diesel alternator, high output", lo: 1.5, hi: 3.0 },
  { cat: "Diesel", name: "Fuel-water separator sensor", lo: 0.4, hi: 0.9 },
  { cat: "Diesel", name: "Diesel exhaust brake solenoid", lo: 0.8, hi: 1.6 },
  { cat: "Diesel", name: "Turbo boost leak repair (hoses/clamps)", lo: 0.8, hi: 1.8 },
  { cat: "Diesel", name: "Diesel engine wiring harness section repair", lo: 1.5, hi: 3.5 },
  { cat: "Key Programming", name: "Basic key/remote programming (existing key type, no module reset)", lo: 0.4, hi: 0.8 },
  { cat: "Key Programming", name: "All-keys-lost programming (requires security bypass or dealer-level access)", lo: 1.0, hi: 2.5 },
  { cat: "Key Programming", name: "Push-button start fob programming", lo: 0.5, hi: 1.2 },
  { cat: "Key Programming", name: "Transponder key cutting + programming", lo: 0.5, hi: 1.0 },
  { cat: "Key Programming", name: "Remote head key programming", lo: 0.4, hi: 0.9 },
  { cat: "Key Programming", name: "Module reset after key programming (BCM/immobilizer relearn)", lo: 0.5, hi: 1.2 },
  { cat: "Car Audio", name: "Head unit replacement (factory-fit harness adapter)", lo: 0.8, hi: 1.5 },
  { cat: "Car Audio", name: "Head unit replacement (custom dash kit required)", lo: 1.5, hi: 3.0 },
  { cat: "Car Audio", name: "Speaker replacement (per pair, factory location)", lo: 0.6, hi: 1.3 },
  { cat: "Car Audio", name: "Amplifier install + wiring", lo: 2.0, hi: 4.0 },
  { cat: "Car Audio", name: "Subwoofer + enclosure install", lo: 1.5, hi: 3.0 },
  { cat: "Car Audio", name: "Backup camera retrofit (aftermarket)", lo: 1.0, hi: 2.5 },
  { cat: "Car Audio", name: "Remote start / alarm install", lo: 2.0, hi: 4.0 },
  { cat: "Car Audio", name: "Wiring diagnosis - dead system, no power at head unit", lo: 0.6, hi: 1.5 },
  { cat: "ADAS Calibration", name: "Forward-facing camera calibration (after windshield replacement)", lo: 0.8, hi: 2.0 },
  { cat: "ADAS Calibration", name: "Radar sensor calibration (after front bumper work)", lo: 0.8, hi: 2.0 },
  { cat: "ADAS Calibration", name: "Static calibration (target-board, in-shop)", lo: 1.0, hi: 2.5 },
  { cat: "ADAS Calibration", name: "Dynamic calibration (road-drive relearn)", lo: 0.8, hi: 2.0 },
  { cat: "ADAS Calibration", name: "Blind-spot sensor calibration (after rear bumper/quarter work)", lo: 0.8, hi: 1.8 },
  { cat: "ADAS Calibration", name: "Calibration required after wheel alignment on ADAS-equipped vehicle", lo: 0.5, hi: 1.5 },
  { cat: "Engine", name: "Fuel injector wiring harness repair", lo: 1.0, hi: 2.0 },
  { cat: "Engine", name: "Knock sensor replacement", lo: 0.8, hi: 1.8 },
  { cat: "Engine", name: "Variable valve timing (VVT) solenoid", lo: 1.0, hi: 2.0 },
  { cat: "Cooling & HVAC", name: "HVAC blend door actuator", lo: 1.2, hi: 2.5 },
  { cat: "Cooling & HVAC", name: "Cabin air filter housing repair", lo: 0.6, hi: 1.2 },
  { cat: "Steering & Suspension", name: "Air suspension compressor", lo: 2.0, hi: 4.0 },
  { cat: "Steering & Suspension", name: "Air suspension bag (each)", lo: 1.5, hi: 3.0 },
  { cat: "Exhaust", name: "DPF delete diagnosis (emissions-legal states only - flag for compliance check)", lo: 0.8, hi: 1.5 },
  { cat: "Drivability/Fuel", name: "Secondary air injection pump", lo: 1.0, hi: 2.0 },
  { cat: "Body & Frame", name: "Power liftgate motor/strut", lo: 1.0, hi: 2.0 },
  { cat: "Body & Frame", name: "Sunroof motor/track repair", lo: 1.5, hi: 3.0 },
  { cat: "Diesel", name: "Diesel particulate filter (DPF) cleaning service (vs replace)", lo: 1.5, hi: 3.0 },
  { cat: "Diesel", name: "Diesel fuel injector removal tool/stuck injector service", lo: 2.0, hi: 4.5 },
  { cat: "Small Engine", name: "Pressure washer - unloader/thermal relief valve", lo: 0.5, hi: 1.0 },
  { cat: "Key Programming", name: "Smart key battery + programming verification", lo: 0.3, hi: 0.6 },
  { cat: "Exotic/Luxury - Mechanical", name: "Engine service, exotic/luxury (specialized access, longer than standard)", lo: 2.0, hi: 4.0 },
  { cat: "Exotic/Luxury - Mechanical", name: "Air suspension service, exotic/luxury", lo: 2.5, hi: 5.0 },
  { cat: "Exotic/Luxury - Mechanical", name: "Carbon-ceramic brake service", lo: 2.0, hi: 4.0 },
  { cat: "Exotic/Luxury - Mechanical", name: "Dual-clutch/exotic transmission service", lo: 3.0, hi: 6.0 },
  { cat: "Exotic/Luxury - Mechanical", name: "Electronics/CAN-bus diagnosis, exotic/luxury (specialized scan tool required)", lo: 1.5, hi: 3.5 },
  { cat: "Exotic/Luxury - Mechanical", name: "Cooling system service, mid/rear-engine layout", lo: 2.5, hi: 5.0 },
  { cat: "Exotic/Luxury - Mechanical", name: "Turbo/supercharger service, exotic/luxury", lo: 3.0, hi: 6.0 },
  { cat: "Exotic/Luxury - Frame", name: "Chassis alignment, exotic/luxury (specialized fixtures)", lo: 2.0, hi: 4.0 },
  { cat: "Exotic/Luxury - Frame", name: "Aluminum/carbon monocoque structural assessment", lo: 2.0, hi: 4.5 },
  { cat: "Exotic/Luxury - Frame", name: "Subframe service, exotic/luxury", lo: 3.0, hi: 6.0 },
  { cat: "Exotic/Luxury - Body", name: "Carbon fiber panel repair (small, non-structural)", lo: 3.0, hi: 6.0 },
  { cat: "Exotic/Luxury - Body", name: "Carbon fiber panel replacement", lo: 4.0, hi: 8.0 },
  { cat: "Exotic/Luxury - Body", name: "Exotic paint match & blend (specialized finishes)", lo: 5.0, hi: 10.0 },
  { cat: "Exotic/Luxury - Body", name: "Gullwing/scissor/butterfly door mechanism service", lo: 2.5, hi: 5.0 },
  { cat: "Exotic/Luxury - Body", name: "Retractable hardtop/convertible mechanism service", lo: 3.0, hi: 6.0 },
  { cat: "Exotic/Luxury - Body", name: "Exotic/luxury interior trim removal & reinstall (per section)", lo: 1.5, hi: 3.5 },
  { cat: "Heavy Equipment/Agricultural", name: "Tractor hydraulic system service", lo: 2.0, hi: 4.0 },
  { cat: "Heavy Equipment/Agricultural", name: "Tractor PTO clutch/shaft service", lo: 2.5, hi: 5.0 },
  { cat: "Heavy Equipment/Agricultural", name: "Skid steer/track loader undercarriage service", lo: 2.0, hi: 4.5 },
  { cat: "Heavy Equipment/Agricultural", name: "Excavator hydraulic cylinder/hose replacement", lo: 1.5, hi: 3.5 },
  { cat: "Heavy Equipment/Agricultural", name: "Forklift mast/hydraulic system service", lo: 2.0, hi: 4.0 },
  { cat: "Heavy Equipment/Agricultural", name: "Diesel welder/generator service", lo: 1.0, hi: 2.5 },
  { cat: "Heavy Equipment/Agricultural", name: "Air compressor (diesel-driven) service", lo: 1.0, hi: 2.5 },
  { cat: "Heavy Equipment/Agricultural", name: "Heavy equipment air brake system service", lo: 2.0, hi: 4.0 },
  { cat: "Heavy Equipment/Agricultural", name: "Heavy equipment DEF/emissions system service", lo: 1.5, hi: 3.0 },
  { cat: "Heavy Equipment/Agricultural", name: "Heavy equipment undercarriage/track replacement", lo: 4.0, hi: 8.0 },
  { cat: "Exotic/Luxury - Transmission", name: "Automatic transmission R&R (remove & reinstall), exotic/luxury", lo: 8.0, hi: 16.0 },
  { cat: "Exotic/Luxury - Transmission", name: "Automatic transmission overhaul, exotic/luxury", lo: 18.0, hi: 34.0 },
  { cat: "Exotic/Luxury - Transmission", name: "Dual-clutch (DCT) clutch pack replacement", lo: 8.0, hi: 16.0 },
  { cat: "Exotic/Luxury - Transmission", name: "Dual-clutch mechatronic/control unit replacement", lo: 6.0, hi: 12.0 },
  { cat: "Exotic/Luxury - Transmission", name: "Torque converter replacement, exotic/luxury", lo: 8.0, hi: 15.0 },
  { cat: "Exotic/Luxury - Transmission", name: "Valve body replacement, exotic/luxury", lo: 4.0, hi: 9.0 },
  { cat: "Exotic/Luxury - Transmission", name: "Manual clutch & flywheel, exotic/luxury", lo: 8.0, hi: 16.0 },
  { cat: "Exotic/Luxury - Transmission", name: "Transmission mount replacement, exotic/luxury", lo: 2.0, hi: 4.5 },
  { cat: "Exotic/Luxury - Transmission", name: "Transmission fluid & filter service, exotic/luxury", lo: 1.5, hi: 3.5 },
  { cat: "Exotic/Luxury - Transmission", name: "Transmission cooler line replacement, exotic/luxury", lo: 2.0, hi: 4.5 },
  { cat: "Exotic/Luxury - Transmission", name: "Transmission adaptation/relearn after service", lo: 0.8, hi: 2.0 },
  { cat: "Exotic/Luxury - Transmission", name: "Shift solenoid replacement, exotic/luxury", lo: 3.0, hi: 7.0 },
  { cat: "Exotic/Luxury - Drivetrain", name: "Transfer case R&R, AWD exotic/luxury", lo: 5.0, hi: 10.0 },
  { cat: "Exotic/Luxury - Drivetrain", name: "Front differential R&R, exotic/luxury", lo: 5.0, hi: 10.0 },
  { cat: "Exotic/Luxury - Drivetrain", name: "Rear differential R&R, exotic/luxury", lo: 5.0, hi: 11.0 },
  { cat: "Exotic/Luxury - Drivetrain", name: "Differential overhaul, exotic/luxury", lo: 8.0, hi: 16.0 },
  { cat: "Exotic/Luxury - Drivetrain", name: "Carbon fiber driveshaft replacement", lo: 3.0, hi: 6.0 },
  { cat: "Exotic/Luxury - Drivetrain", name: "Halfshaft/CV axle replacement (each), exotic/luxury", lo: 2.5, hi: 5.0 },
  { cat: "Exotic/Luxury - Drivetrain", name: "Active/torque-vectoring differential service", lo: 4.0, hi: 9.0 },
  { cat: "Exotic/Luxury - Mechanical", name: "Engine R&R (remove & reinstall), exotic/luxury", lo: 14.0, hi: 30.0 },
  { cat: "Exotic/Luxury - Mechanical", name: "Engine overhaul, exotic/luxury", lo: 40.0, hi: 90.0 },
  { cat: "Exotic/Luxury - Mechanical", name: "Timing chain/belt service, exotic/luxury", lo: 8.0, hi: 20.0 },
  { cat: "Exotic/Luxury - Mechanical", name: "Cylinder head gasket, exotic/luxury (per bank)", lo: 12.0, hi: 26.0 },
  { cat: "Exotic/Luxury - Mechanical", name: "Water pump replacement, exotic/luxury", lo: 3.0, hi: 8.0 },
  { cat: "Exotic/Luxury - Mechanical", name: "Fuel pump/high-pressure pump, exotic/luxury", lo: 3.0, hi: 7.0 },
  { cat: "Exotic/Luxury - Mechanical", name: "Fuel injector set replacement, exotic/luxury", lo: 4.0, hi: 10.0 },
  { cat: "Exotic/Luxury - Mechanical", name: "Catalytic converter replacement (each), exotic/luxury", lo: 3.0, hi: 8.0 },
  { cat: "Exotic/Luxury - Mechanical", name: "Exhaust valve/active exhaust system service", lo: 2.0, hi: 5.0 },
  { cat: "Exotic/Luxury - Mechanical", name: "Steering rack replacement, exotic/luxury", lo: 5.0, hi: 11.0 },
  { cat: "Exotic/Luxury - Mechanical", name: "Control arm/suspension link (each), exotic/luxury", lo: 1.5, hi: 4.0 },
  { cat: "Exotic/Luxury - Mechanical", name: "Adaptive damper/shock replacement (each)", lo: 2.0, hi: 5.0 },
  { cat: "Exotic/Luxury - Mechanical", name: "Air suspension compressor, exotic/luxury", lo: 2.5, hi: 6.0 },
  { cat: "Exotic/Luxury - Mechanical", name: "Air spring/bag replacement (each), exotic/luxury", lo: 2.0, hi: 5.0 },
  { cat: "Exotic/Luxury - Mechanical", name: "Carbon-ceramic rotor replacement (per axle)", lo: 2.5, hi: 5.0 },
  { cat: "Exotic/Luxury - Mechanical", name: "Battery/electrical module coding after replacement", lo: 1.0, hi: 3.0 },
  { cat: "Exotic/Luxury - Mechanical", name: "Hybrid/EV high-voltage system service, exotic/luxury", lo: 3.0, hi: 8.0 },
  { cat: "Exotic/Luxury - Mechanical", name: "Convertible top hydraulic pump/cylinder service", lo: 3.0, hi: 7.0 },
  { cat: "Transmission", name: "Automatic transmission R&R, FWD", lo: 6.0, hi: 10.0 },
  { cat: "Transmission", name: "Automatic transmission R&R, RWD", lo: 5.0, hi: 9.0 },
  { cat: "Transmission", name: "Automatic transmission R&R, AWD/4WD", lo: 7.0, hi: 12.0 },
  { cat: "Transmission", name: "Automatic transmission overhaul", lo: 12.0, hi: 22.0 },
  { cat: "Transmission", name: "CVT R&R", lo: 6.0, hi: 11.0 },
  { cat: "Transmission", name: "CVT replacement (unit swap)", lo: 6.0, hi: 12.0 },
  { cat: "Transmission", name: "Manual transmission R&R", lo: 5.0, hi: 9.0 },
  { cat: "Transmission", name: "Manual transmission overhaul", lo: 10.0, hi: 20.0 },
  { cat: "Transmission", name: "Torque converter replacement", lo: 5.0, hi: 10.0 },
  { cat: "Transmission", name: "Valve body replacement", lo: 3.0, hi: 6.0 },
  { cat: "Transmission", name: "Transmission fluid & filter service", lo: 1.0, hi: 2.0 },
  { cat: "Transmission", name: "Transmission pan gasket", lo: 1.0, hi: 2.0 },
  { cat: "Transmission", name: "Transmission cooler replacement", lo: 1.5, hi: 3.0 },
  { cat: "Transmission", name: "Transmission cooler line (each)", lo: 0.8, hi: 1.8 },
  { cat: "Transmission", name: "Shift cable/linkage adjustment or replacement", lo: 1.0, hi: 2.5 },
  { cat: "Transmission", name: "Transmission mount (each)", lo: 0.8, hi: 2.0 },
  { cat: "Transmission", name: "Clutch & flywheel replacement, manual", lo: 4.0, hi: 8.0 },
  { cat: "Transmission", name: "Clutch master cylinder", lo: 1.0, hi: 2.0 },
  { cat: "Transmission", name: "Clutch slave cylinder", lo: 1.0, hi: 2.5 },
  { cat: "Transmission", name: "Clutch hydraulic line", lo: 0.8, hi: 1.6 },
  { cat: "Transmission", name: "Transmission control module (TCM) replace & program", lo: 1.5, hi: 3.0 },
  { cat: "Transmission", name: "Transmission adaptation/relearn", lo: 0.5, hi: 1.2 },
  { cat: "Transmission", name: "Speed sensor, input or output", lo: 0.8, hi: 2.0 },
  { cat: "Transmission", name: "Transmission rear seal", lo: 1.5, hi: 3.0 },
  { cat: "Drivetrain & Axles", name: "CV axle assembly, front (each)", lo: 1.2, hi: 2.5 },
  { cat: "Drivetrain & Axles", name: "CV axle assembly, rear (each)", lo: 1.3, hi: 2.8 },
  { cat: "Drivetrain & Axles", name: "CV boot replacement (each)", lo: 1.5, hi: 3.0 },
  { cat: "Drivetrain & Axles", name: "Driveshaft, one-piece", lo: 1.0, hi: 2.5 },
  { cat: "Drivetrain & Axles", name: "Driveshaft, two-piece", lo: 1.5, hi: 3.5 },
  { cat: "Drivetrain & Axles", name: "Driveshaft center support bearing", lo: 1.5, hi: 3.0 },
  { cat: "Drivetrain & Axles", name: "U-joint replacement (each)", lo: 1.0, hi: 2.5 },
  { cat: "Drivetrain & Axles", name: "Transfer case R&R", lo: 3.0, hi: 6.0 },
  { cat: "Drivetrain & Axles", name: "Transfer case overhaul", lo: 6.0, hi: 12.0 },
  { cat: "Drivetrain & Axles", name: "Transfer case fluid service", lo: 0.5, hi: 1.0 },
  { cat: "Drivetrain & Axles", name: "Transfer case shift actuator/motor", lo: 1.0, hi: 2.5 },
  { cat: "Drivetrain & Axles", name: "Transfer case chain & pump", lo: 4.0, hi: 8.0 },
  { cat: "Drivetrain & Axles", name: "Front differential R&R", lo: 3.5, hi: 7.0 },
  { cat: "Drivetrain & Axles", name: "Front differential overhaul", lo: 6.0, hi: 12.0 },
  { cat: "Drivetrain & Axles", name: "Front differential fluid service", lo: 0.4, hi: 0.9 },
  { cat: "Drivetrain & Axles", name: "Front differential seal (each)", lo: 1.2, hi: 2.5 },
  { cat: "Drivetrain & Axles", name: "Rear differential R&R", lo: 3.0, hi: 6.5 },
  { cat: "Drivetrain & Axles", name: "Rear differential overhaul", lo: 6.0, hi: 12.0 },
  { cat: "Drivetrain & Axles", name: "Rear differential fluid service", lo: 0.4, hi: 0.9 },
  { cat: "Drivetrain & Axles", name: "Rear differential cover gasket", lo: 0.8, hi: 1.6 },
  { cat: "Drivetrain & Axles", name: "Pinion seal replacement", lo: 1.5, hi: 3.0 },
  { cat: "Drivetrain & Axles", name: "Ring & pinion setup with backlash spec", lo: 6.0, hi: 12.0 },
  { cat: "Drivetrain & Axles", name: "Limited-slip clutch pack service", lo: 3.0, hi: 6.0 },
  { cat: "Drivetrain & Axles", name: "Axle shaft, rear (each)", lo: 1.5, hi: 3.0 },
  { cat: "Drivetrain & Axles", name: "Axle bearing & seal, rear (each)", lo: 1.5, hi: 3.5 },
  { cat: "Drivetrain & Axles", name: "Wheel hub/bearing assembly (each)", lo: 1.0, hi: 2.5 },
  { cat: "Drivetrain & Axles", name: "Locking hub service (each)", lo: 0.8, hi: 1.8 },
  { cat: "Drivetrain & Axles", name: "4WD actuator / vacuum solenoid", lo: 1.0, hi: 2.2 },
  { cat: "Drivetrain & Axles", name: "Driveline vibration diagnosis", lo: 0.8, hi: 2.0 },
  { cat: "Steering & Suspension", name: "Strut assembly, front (each)", lo: 1.2, hi: 2.5 },
  { cat: "Steering & Suspension", name: "Strut assembly, rear (each)", lo: 1.0, hi: 2.2 },
  { cat: "Steering & Suspension", name: "Shock absorber (each)", lo: 0.6, hi: 1.5 },
  { cat: "Steering & Suspension", name: "Strut mount / bearing plate (each)", lo: 1.2, hi: 2.5 },
  { cat: "Steering & Suspension", name: "Upper control arm (each)", lo: 1.0, hi: 2.2 },
  { cat: "Steering & Suspension", name: "Lower control arm (each)", lo: 1.2, hi: 2.8 },
  { cat: "Steering & Suspension", name: "Control arm bushing (each)", lo: 1.5, hi: 3.0 },
  { cat: "Steering & Suspension", name: "Ball joint, upper (each)", lo: 1.0, hi: 2.2 },
  { cat: "Steering & Suspension", name: "Ball joint, lower (each)", lo: 1.3, hi: 3.0 },
  { cat: "Steering & Suspension", name: "Tie rod end, outer (each)", lo: 0.6, hi: 1.3 },
  { cat: "Steering & Suspension", name: "Tie rod end, inner (each)", lo: 1.0, hi: 2.0 },
  { cat: "Steering & Suspension", name: "Steering knuckle (each)", lo: 1.5, hi: 3.5 },
  { cat: "Steering & Suspension", name: "Idler arm / pitman arm", lo: 1.0, hi: 2.5 },
  { cat: "Steering & Suspension", name: "Track bar / panhard rod", lo: 0.8, hi: 2.0 },
  { cat: "Steering & Suspension", name: "Steering rack & pinion R&R", lo: 3.0, hi: 6.0 },
  { cat: "Steering & Suspension", name: "Power steering pump", lo: 1.2, hi: 3.0 },
  { cat: "Steering & Suspension", name: "Power steering hose (each)", lo: 0.8, hi: 2.0 },
  { cat: "Steering & Suspension", name: "Wheel alignment, four-wheel", lo: 1.0, hi: 1.5 },
  { cat: "Steering & Suspension", name: "Wheel alignment, thrust angle", lo: 0.7, hi: 1.2 },
  { cat: "Steering & Suspension", name: "Leaf spring bushing (each)", lo: 1.0, hi: 2.5 },
  { cat: "Steering & Suspension", name: "Air ride compressor", lo: 1.5, hi: 3.5 },
  { cat: "Steering & Suspension", name: "Air ride height sensor (each)", lo: 0.8, hi: 1.8 },
  { cat: "Engine", name: "Engine R&R, FWD", lo: 8.0, hi: 15.0 },
  { cat: "Engine", name: "Engine R&R, RWD", lo: 7.0, hi: 13.0 },
  { cat: "Engine", name: "Engine overhaul, in-frame", lo: 15.0, hi: 28.0 },
  { cat: "Engine", name: "Engine overhaul, out-of-frame", lo: 22.0, hi: 40.0 },
  { cat: "Engine", name: "Cylinder head gasket, 4-cyl", lo: 6.0, hi: 12.0 },
  { cat: "Engine", name: "Cylinder head gasket, V6/V8 (per bank)", lo: 8.0, hi: 16.0 },
  { cat: "Engine", name: "Timing belt service with water pump", lo: 3.5, hi: 7.0 },
  { cat: "Engine", name: "Timing chain & guides", lo: 6.0, hi: 14.0 },
  { cat: "Engine", name: "Valve cover gasket, 4-cyl", lo: 1.0, hi: 2.2 },
  { cat: "Engine", name: "Valve cover gasket, V6/V8 (per bank)", lo: 1.5, hi: 3.5 },
  { cat: "Engine", name: "Oil pan gasket", lo: 2.0, hi: 5.0 },
  { cat: "Engine", name: "Rear main seal", lo: 4.0, hi: 9.0 },
  { cat: "Engine", name: "Front crankshaft seal", lo: 1.5, hi: 3.5 },
  { cat: "Engine", name: "Motor mount (each)", lo: 1.0, hi: 2.5 },
  { cat: "Engine", name: "Camshaft replacement", lo: 5.0, hi: 12.0 },
  { cat: "Engine", name: "Cylinder head resurface & reinstall", lo: 6.0, hi: 13.0 },
  { cat: "Engine", name: "Turbocharger replacement, gas engine", lo: 3.5, hi: 8.0 },
  { cat: "Engine", name: "Compression & leak-down test", lo: 1.0, hi: 2.0 },
  { cat: "Cooling & HVAC", name: "A/C evacuate & recharge", lo: 0.8, hi: 1.5 },
  { cat: "Cooling & HVAC", name: "A/C evacuate & recharge with dye", lo: 1.0, hi: 1.8 },
  { cat: "Cooling & HVAC", name: "A/C leak test (electronic/UV)", lo: 0.6, hi: 1.5 },
  { cat: "Cooling & HVAC", name: "A/C performance test & diagnosis", lo: 0.6, hi: 1.4 },
  { cat: "Cooling & HVAC", name: "A/C compressor replacement", lo: 2.0, hi: 4.5 },
  { cat: "Cooling & HVAC", name: "A/C compressor with system flush", lo: 3.0, hi: 6.0 },
  { cat: "Cooling & HVAC", name: "A/C evaporator core", lo: 4.0, hi: 10.0 },
  { cat: "Cooling & HVAC", name: "A/C expansion valve / orifice tube", lo: 1.5, hi: 3.5 },
  { cat: "Cooling & HVAC", name: "A/C accumulator / receiver-drier", lo: 1.2, hi: 2.8 },
  { cat: "Cooling & HVAC", name: "A/C hose or line (each)", lo: 1.0, hi: 2.5 },
  { cat: "Cooling & HVAC", name: "A/C condenser fan assembly", lo: 1.0, hi: 2.2 },
  { cat: "Cooling & HVAC", name: "Blower motor replacement", lo: 0.8, hi: 2.0 },
  { cat: "Cooling & HVAC", name: "Blower motor resistor", lo: 0.5, hi: 1.2 },
  { cat: "Cooling & HVAC", name: "Radiator replacement", lo: 1.5, hi: 3.5 },
  { cat: "Cooling & HVAC", name: "Radiator hose (each)", lo: 0.5, hi: 1.2 },
  { cat: "Cooling & HVAC", name: "Heater hose (each)", lo: 0.6, hi: 1.4 },
];

// Plain-English symptom -> labor-guide search terms. Deliberately keyword-based
// and local: it works with no internet, no API key, and no AI call, so a quote
// can be given standing next to the customer. These are starting points that
// narrow where to look - never a diagnosis, and the UI says so.
const SYMPTOM_MAP = [
  { when: ["shake", "shaking", "vibrat", "wobble", "shimmy"], hi: ["tire", "balance", "wheel bearing", "tie rod", "ball joint", "driveshaft", "u-joint", "brake rotor", "axle", "alignment"],
    note: "Speed-related shake usually points at rotating mass or a worn steering/suspension joint. Shake under braking points at rotors instead." },
  { when: ["pull", "pulls", "drift", "wander"], hi: ["alignment", "tie rod", "ball joint", "brake caliper", "tire"],
    note: "Pulling is usually alignment, a dragging caliper, or uneven tire wear." },
  { when: ["squeal", "squeak", "grind", "grinding", "noise when brak"], hi: ["brake pad", "brake rotor", "caliper", "wheel bearing"],
    note: "Grinding usually means pad material is gone. Squeal can be wear indicators." },
  { when: ["overheat", "hot", "temp", "coolant", "steam"], hi: ["thermostat", "water pump", "radiator", "cooling fan", "head gasket", "coolant"],
    note: "Check the cheap causes first - thermostat and fan - before condemning a head gasket." },
  { when: ["no start", "won't start", "wont start", "crank", "cranks"], hi: ["starter", "battery", "alternator", "fuel pump", "glow plug", "ignition"],
    note: "Cranks but no fire is fuel/spark. No crank at all is battery/starter/ground." },
  { when: ["stall", "stalls", "dies", "rough idle", "misfire", "hesitat"], hi: ["ignition coil", "spark plug", "fuel injector", "vacuum leak", "throttle body", "mass airflow", "EVAP"],
    note: "Pull codes first. Rough idle plus a lean code often means a vacuum leak." },
  { when: ["leak", "leaking", "drip", "puddle"], hi: ["gasket", "seal", "hose", "water pump", "oil pan", "valve cover", "radiator"],
    note: "Identify the fluid by color and location before quoting - it changes the job completely." },
  { when: ["ac ", "a/c", "air condition", "not cold", "blowing hot"], hi: ["A/C compressor", "condenser", "blend door", "cabin filter", "HVAC"],
    note: "Check charge and blend door operation before quoting a compressor." },
  { when: ["smoke", "smoking", "burning"], hi: ["turbo", "valve cover", "oil cooler", "DPF", "injector", "head gasket"],
    note: "Color matters: blue is oil, white is coolant or fuel, black is over-fueling." },
  { when: ["transmission", "slip", "slipping", "won't shift", "hard shift"], hi: ["transmission", "shift solenoid", "clutch", "transmission mount"],
    note: "Check fluid level and condition before anything internal." },
  { when: ["electrical", "battery dies", "drain", "dead battery"], hi: ["parasitic drain", "alternator", "battery", "ground strap", "wiring"],
    note: "A repeat dead battery is usually a parasitic drain or a failing alternator, not the battery." },
  { when: ["steering", "loose", "clunk"], hi: ["tie rod", "ball joint", "sway bar", "control arm", "steering rack", "bushing"],
    note: "Clunk over bumps is usually sway bar links or worn bushings." },
];
// ---- Vehicle class + access-difficulty factor -------------------------------
// Real shops don't quote the same hours for a brake job on a Corolla and on a
// 911 - access, torque procedures, special tooling and the care required all
// differ. This applies that judgement systematically so a suggested time
// reflects the vehicle in front of you instead of one flat number for
// everything. It is a CLASS factor, openly labelled as such. It is NOT a
// per-model lookup: nobody should read this as "Bentley Continental GT = X.X
// hr from a licensed database" - that is what ALLDATA/Mitchell1 sell, and the
// Guides tab links to them for exactly that.
// Vendor accounts. Stored per shop so a new hire never has to hunt for an
// account number. Deliberately does NOT claim to be an API integration:
// PartsTech, Nexpart, RepairLink, CCC, Identifix and Mitchell1 do not publish
// open APIs a third-party estimating app can pull priced results back through.
// What this does is real - it remembers who you are, and opens the vendor with
// the vehicle and job already on your clipboard.
// Talk track for the service writer. Pulls the customer's name and their area
// into the words so it sounds like a neighbour, not a script. Everything here
// is about being useful and honest - no pressure lines, no manufactured
// urgency. A writer with zero car background can read these out loud.
const PITCH_LINES = [
  { k: "open", label: "Opening the conversation", t: (n, z) => `Hey ${n || "there"} - thanks for calling Peaceful Motors. Tell me what it's doing and I'll tell you straight what I think it is.` },
  { k: "mobile", label: "Explaining mobile service", t: (n, z) => `Good news ${n || ""} - we come to you${z ? " out in " + z : ""}, so you're not sitting in a waiting room. There's a $20 service call on the visit and that's it.` },
  { k: "estimate", label: "Giving the number", t: (n, z) => `${n ? n + ", " : ""}here's the honest range on that. If I open it up and it's different, I stop and call you before I touch anything else. You will not get a surprise on the bill.` },
  { k: "why", label: "When they ask why it costs that", t: (n, z) => `Fair question. That number is the part plus the time it actually takes. I can show you both. If you'd rather split it up, tell me your budget and I'll tell you what's safe to wait on.` },
  { k: "safety", label: "When it is a safety item", t: (n, z) => `${n ? n + ", " : ""}I'm not going to dress this up - that one's brakes/steering/tires, and I wouldn't let my own family drive on it. The rest can wait. This one I'd do now.` },
  { k: "wait", label: "When it can wait", t: (n, z) => `Honestly? That one's not urgent. Keep an eye on it and plan for it in a few months. I'd rather tell you that than sell you something today.` },
  { k: "warranty", label: "Closing with the warranty", t: (n, z) => `Everything I do carries a written 12-month, 12,000-mile warranty on parts and labor. If it comes back, it comes back to me.` },
  { k: "fleet", label: "Business or fleet customer", t: (n, z) => `If you've got more than one vehicle${z ? " around " + z : ""}, ask me about the fleet packages - scheduled PMs, priority slots, and one invoice instead of five.` },
  { k: "followup", label: "Following up after the job", t: (n, z) => `Hey ${n || "there"}, just checking the ${""}vehicle's running right after the other day. Anything at all feels off, call me before you drive far on it.` },
  { k: "review", label: "Asking for a review", t: (n, z) => `${n ? n + ", " : ""}if I did right by you, a quick review helps a small shop more than you'd think. No pressure either way - I appreciate the work regardless.` },
  { k: "referral", label: "Mentioning the referral deal", t: (n, z) => `One more thing - send somebody my way and you both get $25 off your next service. No limit on how many.` },
];

const VENDORS = [
  { key: "nexpart", name: "Nexpart", url: "https://www.nexpart.com", note: "Parts ordering across many WD suppliers" },
  { key: "partstech", name: "PartsTech", url: "https://app.partstech.com", note: "Multi-supplier parts search and ordering" },
  { key: "repairlink", name: "RepairLink", url: "https://repairlinkshop.com", note: "OEM parts ordering" },
  { key: "ccc", name: "CCC ONE", url: "https://www.cccis.com", note: "Collision estimating and insurance workflow" },
  { key: "identifix", name: "Identifix Direct-Hit", url: "https://www.identifix.com", note: "Diagnostics, real fixes, wiring" },
  { key: "mitchell", name: "Mitchell 1 ProDemand", url: "https://www.prodemand.com", note: "Labor times, procedures, wiring" },
  { key: "alldata", name: "ALLDATA", url: "https://www.alldata.com", note: "OEM procedures and specs" },
];

const VEHICLE_CLASS = [
  { cls: "Exotic", mult: 1.6, rx: /ferrari|lamborghini|mclaren|pagani|bugatti|koenigsegg|rolls-royce|bentley|maybach|aston martin|maserati|lotus|lfa|nsx|gt-r/i },
  { cls: "Heavy Diesel", mult: 1.35, rx: /freightliner|peterbilt|kenworth|mack |western star|international (mv|lt|durastar|maxxforce)|hino|isuzu (npr|nqr|ftr|fvr)|scania|volvo (vnl|vnr|fh)|d13 |dd15|isx|mx-13|c7 diesel|c15 diesel/i },
  { cls: "Luxury", mult: 1.3, rx: /porsche|mercedes|bmw |audi|lexus|jaguar|land rover|range rover|genesis|cadillac|lincoln|acura|infiniti|alfa romeo|volvo|polestar|saab|tesla|lucid|rivian|maybach|mini /i },
  { cls: "Diesel Pickup", mult: 1.25, rx: /diesel|duramax|cummins|power stroke|ecodiesel|tdi|f-250|f-350|f-450|f-550|ram (2500|3500|4500|5500)|2500hd|3500hd/i },
  { cls: "Truck/SUV", mult: 1.1, rx: /f-150|silverado|sierra|tahoe|suburban|expedition|yukon|ram 1500|tundra|titan|ridgeline|colorado|canyon|ranger|frontier|gladiator|bronco|4runner|sequoia|armada|pilot|telluride|palisade/i },
  { cls: "Equipment", mult: 0.85, rx: /mower|tractor|excavator|skid steer|loader|dozer|generator|chainsaw|trimmer|blower|pressure washer|forklift|utv|atv|golf cart|tiller|log splitter|telehandler|compactor|welder/i },
];
function vehicleClass(name) {
  const n = (name || "").toLowerCase();
  for (const c of VEHICLE_CLASS) if (c.rx.test(n)) return c;
  return { cls: "Standard", mult: 1 };
}
// One working number instead of a range. The range stays available underneath
// as the honest source, and every line stays editable after it lands.
function suggestedHours(repair, vehicleName) {
  const mid = (repair.lo + repair.hi) / 2;
  const c = vehicleClass(vehicleName);
  // Categories whose times were already written for that class don't get
  // adjusted again - that would double-count the difficulty.
  const already = /^Exotic\/Luxury|^Small Engine|^Heavy Equipment|^Diesel$/.test(repair.cat);
  const raw = already ? mid : mid * c.mult;
  const hours = Math.round(raw * 10) / 10;
  return { hours, cls: c.cls, mult: c.mult, adjusted: !already && c.mult !== 1 };
}

// Orders labor-guide matches so the ones written for THIS vehicle's class come
// first - searching "cv axle" on an F-250 should not lead with the exotic line.
function rankForVehicle(list, vehicleName) {
  const cls = vehicleClass(vehicleName).cls;
  const wantExotic = cls === "Exotic";
  const wantHeavy = cls === "Heavy Diesel" || cls === "Diesel Pickup";
  const score = (r) => {
    const isExotic = r.cat.startsWith("Exotic/Luxury");
    const isDiesel = r.cat === "Diesel" || r.cat === "Heavy Equipment/Agricultural";
    if (wantExotic) return isExotic ? 0 : 1;
    if (wantHeavy) return isDiesel ? 0 : isExotic ? 2 : 1;
    return isExotic || isDiesel ? 1 : 0;
  };
  return [...list].sort((a, b) => score(a) - score(b));
}

function matchSymptom(text) {
  const t = (text || "").toLowerCase();
  if (t.trim().length < 3) return null;
  const hit = SYMPTOM_MAP.find((m) => m.when.some((w) => t.includes(w)));
  if (!hit) return null;
  const repairs = COMMON_REPAIRS.filter((r) =>
    hit.hi.some((k) => r.name.toLowerCase().includes(k.toLowerCase()))
  );
  return { note: hit.note, repairs, raw: repairs };
}
// Real, common US vehicle nameplates - for quick-select/reference alongside VIN entry,
// not a substitute for it. Genuine model names, not fabricated data.
const POPULAR_VEHICLES = [
// Real vehicle AND equipment nameplates, sorted A-Z. Mainstream, exotic/luxury,
// European incl. Swedish, Asian performance, diesel pickups/commercial, and
// diesel engine families. 662 entries, deduplicated.
  "Acura ILX", "Acura Integra Type S", "Acura MDX", "Acura NSX", "Acura RDX", "Acura TLX",
  "Acura ZDX", "Alfa Romeo Giulia", "Alfa Romeo Stelvio", "Ariens Snow Blower", "Aston Martin DB11", "Aston Martin DBS",
  "Aston Martin DBX", "Aston Martin Vantage", "Audi A3", "Audi A4", "Audi A6", "Audi A8",
  "Audi e-tron GT", "Audi Q3", "Audi Q5", "Audi Q7", "Audi Q7 TDI Diesel", "Audi Q8",
  "Audi R8", "Audi RS7", "Audi TT", "Bentley Bentayga", "Bentley Continental GT", "Bentley Flying Spur",
  "Bentley Mulsanne", "Billy Goat Vacuum", "BMW 3 Series", "BMW 5 Series", "BMW 7 Series", "BMW i3",
  "BMW i4", "BMW i7", "BMW iX", "BMW M3", "BMW M5", "BMW X1",
  "BMW X3", "BMW X5", "BMW X5 M", "BMW X5 xDrive35d Diesel", "BMW X7", "BMW Z4",
  "Bobcat A770 All-Wheel Steer Loader", "Bobcat E35 Mini Excavator", "Bobcat S650 Skid Steer", "Bobcat T650 Compact Track Loader", "Bugatti Chiron", "Bugatti Veyron",
  "Buick Enclave", "Buick Encore", "Buick Envision", "Buick LaCrosse", "Buick Regal", "Cadillac CT5",
  "Cadillac Escalade", "Cadillac Escalade ESV", "Cadillac XT4", "Cadillac XT5", "Can-Am Defender UTV", "Case 580 Backhoe",
  "Case IH Farmall Tractor", "Case IH Magnum Tractor", "Case TR340 Compact Track Loader", "Caterpillar 259D Skid Steer", "Caterpillar 320 Excavator", "Caterpillar 950 Wheel Loader",
  "Caterpillar C15 Diesel Engine", "Caterpillar C7 Diesel Engine", "Caterpillar D6 Dozer", "Champion Portable Generator", "Chevrolet Blazer", "Chevrolet Blazer EV",
  "Chevrolet Bolt EV", "Chevrolet Camaro", "Chevrolet Colorado", "Chevrolet Colorado Duramax Diesel", "Chevrolet Colorado ZR2", "Chevrolet Cruze",
  "Chevrolet Cruze Diesel", "Chevrolet Equinox", "Chevrolet Equinox (2010-2017)", "Chevrolet Equinox (2018+)", "Chevrolet Equinox EV", "Chevrolet Express (cargo van)",
  "Chevrolet Express Diesel Van", "Chevrolet Impala", "Chevrolet Malibu", "Chevrolet Malibu (2016-2024)", "Chevrolet Malibu Hybrid", "Chevrolet Malibu LT",
  "Chevrolet Silverado 1500", "Chevrolet Silverado 1500 (2007-2013)", "Chevrolet Silverado 1500 (2014-2018)", "Chevrolet Silverado 1500 (2019+)", "Chevrolet Silverado 1500 Duramax", "Chevrolet Silverado 2500HD Duramax",
  "Chevrolet Silverado 3500HD", "Chevrolet Silverado 3500HD Duramax", "Chevrolet Silverado EV", "Chevrolet Silverado HD (2500/3500)", "Chevrolet Spark", "Chevrolet Suburban",
  "Chevrolet Suburban High Country", "Chevrolet Tahoe", "Chevrolet Trailblazer", "Chevrolet Trailblazer RS", "Chevrolet Traverse", "Chevrolet Trax",
  "Chrysler 300", "Chrysler Pacifica", "Club Car Golf Cart", "Craftsman Push Mower", "Craftsman Riding Mower", "Cub Cadet Riding Mower",
  "Cub Cadet Zero-Turn Mower", "Cummins 5.9 Diesel Engine", "Cummins 6.7 Diesel Engine", "Cummins ISX Diesel Engine", "Cummins Onan Diesel Generator", "Deere 333G Compact Track Loader",
  "Detroit DD15 Diesel Engine", "Detroit Diesel Series 60 Engine", "Ditch Witch Trencher", "Dodge Challenger", "Dodge Charger", "Dodge Durango",
  "Dodge Grand Caravan", "Dodge Journey", "DR Power Field Mower", "Duramax L5P Diesel Engine", "Duramax LML Diesel Engine", "E-Z-GO Golf Cart",
  "Echo Chainsaw", "Echo Leaf Blower", "Echo String Trimmer", "Exmark Zero-Turn Mower", "Ferrari 296 GTB", "Ferrari 488",
  "Ferrari 812 Superfast", "Ferrari F8 Tributo", "Ferrari Portofino", "Ferrari Purosangue", "Ferrari Roma", "Ferrari SF90",
  "Fiat 500", "Fisker Ocean", "Ford Bronco", "Ford Bronco Raptor", "Ford Bronco Sport", "Ford E-Series",
  "Ford E-Series Diesel Van", "Ford EcoSport", "Ford Edge", "Ford Edge ST", "Ford Escape", "Ford Escape (2013-2019)",
  "Ford Escape (2020+)", "Ford Escape Hybrid", "Ford Escape Plug-In Hybrid", "Ford Expedition", "Ford Expedition MAX", "Ford Explorer",
  "Ford Explorer (2011-2019)", "Ford Explorer (2020+)", "Ford Explorer ST", "Ford F-150", "Ford F-150 (2015-2020)", "Ford F-150 (2021+)",
  "Ford F-150 Lightning", "Ford F-150 Power Stroke Diesel", "Ford F-250 Super Duty Diesel", "Ford F-350", "Ford F-350 Super Duty Diesel", "Ford F-450 Super Duty Diesel",
  "Ford F-550 Super Duty Diesel", "Ford Fiesta", "Ford Focus", "Ford Fusion", "Ford LCF Diesel", "Ford Maverick",
  "Ford Maverick Hybrid", "Ford Mustang", "Ford Mustang Mach-E", "Ford Ranger", "Ford Ranger Lariat", "Ford Ranger Raptor",
  "Ford Super Duty (F-250/350)", "Ford Transit", "Ford Transit 350 Diesel", "Ford Transit Connect", "Ford Transit Diesel", "Freightliner Business Class M2",
  "Freightliner Cascadia", "Freightliner M2 106", "Freightliner Sprinter Diesel", "Generac Home Standby Generator", "Generac Pressure Washer", "Genesis Electrified GV70",
  "Genesis G70", "Genesis G80", "Genesis G90", "Genesis GV60", "Genesis GV70", "Genesis GV80",
  "Genie Telehandler", "GMC Acadia", "GMC Canyon", "GMC Canyon Duramax Diesel", "GMC Hummer EV", "GMC Savana",
  "GMC Savana Diesel Van", "GMC Sierra 1500", "GMC Sierra 1500 (2007-2013)", "GMC Sierra 1500 (2014-2018)", "GMC Sierra 1500 Duramax", "GMC Sierra 2500HD Duramax",
  "GMC Sierra 3500HD Duramax", "GMC Sierra EV", "GMC Terrain", "GMC TopKick Diesel", "GMC Yukon", "GMC Yukon XL",
  "Gravely Zero-Turn Mower", "Hino 195", "Hino 268", "Honda Accord", "Honda Accord (2013-2017)", "Honda Accord (2018+)",
  "Honda Accord Hybrid", "Honda Civic", "Honda Civic (2012-2015)", "Honda Civic (2016-2021)", "Honda Civic (2022+)", "Honda Civic Hatchback",
  "Honda Civic Type R", "Honda Clarity", "Honda CR-V", "Honda CR-V (2012-2016)", "Honda CR-V (2017-2022)", "Honda CR-V (2023+)",
  "Honda CR-V Hybrid", "Honda Fit", "Honda Generator EU Series", "Honda HR-V", "Honda Insight", "Honda Marine Outboard Diesel",
  "Honda Odyssey", "Honda Odyssey (2011-2017)", "Honda Odyssey (2018+)", "Honda Odyssey Touring", "Honda Passport", "Honda Pilot",
  "Honda Pressure Washer", "Honda Prologue", "Honda Prologue EV", "Honda Push Mower", "Honda Rancher ATV", "Honda Ridgeline",
  "Honda Ridgeline RTL", "Honda S2000", "Husqvarna Chainsaw", "Husqvarna Zero-Turn Mower", "Hyster Forklift Diesel", "Hyundai Accent",
  "Hyundai Elantra", "Hyundai Elantra N", "Hyundai Elantra N Line", "Hyundai Ioniq 5", "Hyundai Ioniq 6", "Hyundai Kona",
  "Hyundai Kona Electric", "Hyundai Palisade", "Hyundai Santa Cruz", "Hyundai Santa Fe", "Hyundai Sonata", "Hyundai Tucson",
  "Hyundai Tucson Hybrid", "Hyundai Veloster", "Hyundai Venue", "Infiniti Q50", "Infiniti Q60", "Infiniti QX50",
  "Infiniti QX55", "Infiniti QX60", "Infiniti QX80", "Ingersoll Rand Diesel Air Compressor", "International DuraStar", "International LT Series",
  "International MaxxForce Diesel", "International MV Series", "Isuzu D-Max Diesel", "Isuzu FTR Diesel", "Isuzu FVR Diesel", "Isuzu NPR Diesel",
  "Isuzu NQR Diesel", "Jaguar F-Pace", "Jaguar F-Type", "Jaguar XF", "Jeep Cherokee", "Jeep Compass",
  "Jeep Gladiator", "Jeep Grand Cherokee", "Jeep Grand Cherokee (2011-2021)", "Jeep Grand Cherokee (2022+)", "Jeep Grand Cherokee EcoDiesel", "Jeep Grand Wagoneer",
  "Jeep Patriot", "Jeep Renegade", "Jeep Wagoneer", "Jeep Wagoneer L", "Jeep Wrangler", "Jeep Wrangler (2007-2018 JK)",
  "Jeep Wrangler (2018+ JL)", "Jeep Wrangler 4xe", "Jeep Wrangler EcoDiesel", "Jeep Wrangler Rubicon", "JLG Boom Lift", "John Deere 310 Backhoe",
  "John Deere 5075E Tractor", "John Deere 544 Wheel Loader", "John Deere 6120M Tractor", "John Deere 850K Dozer", "John Deere 8R Series Tractor", "John Deere Gator Diesel",
  "Kawasaki Mule UTV", "Kenworth T270", "Kenworth T680", "Kenworth W900", "Kia Carnival", "Kia EV6",
  "Kia EV9", "Kia Forte", "Kia K5", "Kia K5 GT", "Kia Niro", "Kia Niro EV",
  "Kia Optima", "Kia Rio", "Kia Seltos", "Kia Sorento", "Kia Sorento Hybrid", "Kia Soul",
  "Kia Sportage", "Kia Sportage Hybrid", "Kia Stinger", "Kia Stinger GT", "Kia Telluride", "Koenigsegg Jesko",
  "Koenigsegg Regera", "Kohler Diesel Generator", "Komatsu D51 Dozer", "Kubota KX Mini Excavator", "Kubota L Series Tractor", "Kubota M7 Tractor",
  "Kubota RTV Diesel", "Kubota U35 Mini Excavator", "Lamborghini Aventador", "Lamborghini Gallardo", "Lamborghini Huracan", "Lamborghini Revuelto",
  "Lamborghini Urus", "Land Rover Defender", "Land Rover Discovery", "Land Rover Range Rover", "Land Rover Range Rover Sport", "Lexus ES",
  "Lexus GX", "Lexus IS", "Lexus IS 500", "Lexus LC 500", "Lexus LFA", "Lexus LS",
  "Lexus LX", "Lexus NX", "Lexus RX", "Lexus RZ", "Lexus TX", "Lincoln Aviator",
  "Lincoln Corsair", "Lincoln Electric Diesel Welder", "Lincoln Nautilus", "Lincoln Navigator", "Lincoln Navigator L", "Little Wonder Blower",
  "Lotus Emira", "Lotus Evora", "Lucid Air", "Lucid Gravity", "Mack Anthem", "Mack Granite",
  "Maserati Ghibli", "Maserati GranTurismo", "Maserati Levante", "Maserati MC20", "Maserati Quattroporte", "Massey Ferguson 4700 Tractor",
  "Massey Ferguson 5700 Tractor", "Mazda 3", "Mazda 6", "Mazda CX-3", "Mazda CX-30", "Mazda CX-5",
  "Mazda CX-50", "Mazda CX-70", "Mazda CX-9", "Mazda CX-90", "Mazda MX-30", "Mazda MX-5 Miata",
  "Mazda RX-8", "Mazda3", "Mazda6", "McLaren 570S", "McLaren 720S", "McLaren 765LT",
  "McLaren Artura", "McLaren GT", "Mercedes-AMG G63", "Mercedes-AMG GT", "Mercedes-Benz C-Class", "Mercedes-Benz E-Class",
  "Mercedes-Benz EQS", "Mercedes-Benz GLA", "Mercedes-Benz GLB", "Mercedes-Benz GLC", "Mercedes-Benz GLE", "Mercedes-Benz GLE 350d Diesel",
  "Mercedes-Benz Metris Diesel", "Mercedes-Benz S-Class", "Mercedes-Benz Sprinter", "Mercedes-Benz Sprinter 2500", "Mercedes-Benz Sprinter Diesel", "Mercedes-Maybach GLS",
  "Mercedes-Maybach S-Class", "Miller Diesel Welder/Generator", "Mini Cooper", "Mini Countryman", "Mitsubishi Eclipse Cross", "Mitsubishi Lancer Evolution",
  "Mitsubishi Mirage", "Mitsubishi Outlander", "Mitsubishi Outlander Sport", "Multiquip Concrete Mixer", "New Holland T7 Tractor", "New Holland Workmaster Tractor",
  "Nissan 370Z", "Nissan Altima", "Nissan Altima (2013-2018)", "Nissan Altima (2019+)", "Nissan Ariya", "Nissan Armada",
  "Nissan Frontier", "Nissan Frontier (2005-2021)", "Nissan Frontier (2022+)", "Nissan Frontier PRO-4X", "Nissan Frontier SV", "Nissan GT-R",
  "Nissan Juke", "Nissan Kicks", "Nissan Kicks SR", "Nissan Leaf", "Nissan Maxima", "Nissan Murano",
  "Nissan NV Cargo", "Nissan Pathfinder", "Nissan Pathfinder Rock Creek", "Nissan Rogue", "Nissan Rogue Sport", "Nissan Sentra",
  "Nissan Sentra (2020+)", "Nissan Sentra SR", "Nissan Titan", "Nissan Titan XD Cummins Diesel", "Nissan Versa", "Nissan Z",
  "Paccar MX-13 Diesel Engine", "Pagani Huayra", "Pagani Utopia", "Pagani Zonda", "Perkins Industrial Diesel Engine", "Peterbilt 220",
  "Peterbilt 389", "Peterbilt 579", "Peugeot Partner", "Polaris Ranger UTV", "Polaris Sportsman ATV", "Polestar 2",
  "Polestar 3", "Polestar 4", "Porsche 718 Boxster", "Porsche 718 Cayman", "Porsche 911", "Porsche Cayenne",
  "Porsche Cayenne Diesel", "Porsche Macan", "Porsche Panamera", "Porsche Taycan", "Poulan Riding Mower", "Power Stroke 6.0 Diesel Engine",
  "Power Stroke 6.7 Diesel Engine", "Power Stroke 7.3 Diesel Engine", "Ram 1500", "Ram 1500 (2009-2018)", "Ram 1500 (2019+)", "Ram 1500 EcoDiesel",
  "Ram 1500 EcoDiesel 3.0", "Ram 1500 TRX", "Ram 2500 Cummins Diesel", "Ram 2500/3500 (diesel & gas)", "Ram 3500", "Ram 3500 Cummins Diesel",
  "Ram 4500 Chassis Cab Diesel", "Ram 5500 Chassis Cab Diesel", "Ram ProMaster", "Ram ProMaster Diesel", "Renault Master", "Rivian R1S",
  "Rivian R1T", "Rivian R2", "Rolls-Royce Cullinan", "Rolls-Royce Dawn", "Rolls-Royce Ghost", "Rolls-Royce Phantom",
  "Rolls-Royce Spectre", "Rolls-Royce Wraith", "Ryobi Leaf Blower", "Ryobi String Trimmer", "Saab 9-3", "Saab 9-5",
  "Saab 9-7X", "Saab 900", "Scag Zero-Turn Mower", "Scania R Series", "Scania S Series", "Simplicity Riding Mower",
  "Simpson Pressure Washer", "Skyjack Scissor Lift", "Smart Fortwo", "Snapper Riding Mower", "Sterling Bullet", "Stihl Chainsaw",
  "Stihl Leaf Blower", "Stihl String Trimmer", "Subaru Ascent", "Subaru BRZ", "Subaru Crosstrek", "Subaru Crosstrek Wilderness",
  "Subaru Forester", "Subaru Impreza", "Subaru Legacy", "Subaru Outback", "Subaru Outback (2015-2019)", "Subaru Outback (2020+)",
  "Subaru Outback Wilderness", "Subaru Solterra", "Subaru Solterra EV", "Subaru WRX", "Subaru WRX STI", "Sullair Diesel Air Compressor",
  "Suzuki Grand Vitara", "Terex Dumper", "Tesla Cybertruck", "Tesla Model 3", "Tesla Model S", "Tesla Model X",
  "Tesla Model Y", "Tesla Roadster", "Toro Push Mower", "Toro Snow Blower", "Toro Zero-Turn Mower", "Toyota 4Runner",
  "Toyota Avalon", "Toyota bZ3", "Toyota bZ4X", "Toyota C-HR", "Toyota Camry", "Toyota Camry (2012-2017)",
  "Toyota Camry (2018+)", "Toyota Corolla", "Toyota Corolla (2014-2019)", "Toyota Corolla (2020+)", "Toyota Corolla Cross", "Toyota Corolla Hatchback",
  "Toyota Crown", "Toyota Crown Signia", "Toyota Forklift Diesel", "Toyota GR Corolla", "Toyota GR Yaris", "Toyota GR86",
  "Toyota Grand Highlander", "Toyota Highlander", "Toyota Highlander (2014-2019)", "Toyota Highlander (2020+)", "Toyota Highlander Hybrid", "Toyota Hilux Diesel",
  "Toyota Land Cruiser", "Toyota Land Cruiser 300", "Toyota Land Cruiser Diesel", "Toyota Prius", "Toyota Prius Prime", "Toyota RAV4",
  "Toyota RAV4 (2013-2018)", "Toyota RAV4 (2019+)", "Toyota RAV4 Hybrid", "Toyota Sequoia", "Toyota Sequoia TRD", "Toyota Sienna",
  "Toyota Sienna (2011-2020)", "Toyota Sienna (2021+ Hybrid)", "Toyota Supra", "Toyota Tacoma", "Toyota Tacoma (2005-2015)", "Toyota Tacoma (2016-2023)",
  "Toyota Tacoma (2024+)", "Toyota Tacoma Hybrid", "Toyota Tacoma TRD Pro", "Toyota Tundra", "Toyota Tundra Hybrid", "Toyota Venza",
  "Toyota Yaris", "Troy-Bilt Riding Mower", "Vermeer Stump Grinder", "Volkswagen Arteon", "Volkswagen Atlas", "Volkswagen Atlas Cross Sport",
  "Volkswagen Beetle", "Volkswagen Golf", "Volkswagen Golf GTI", "Volkswagen ID.4", "Volkswagen ID.Buzz", "Volkswagen Jetta",
  "Volkswagen Jetta TDI Diesel", "Volkswagen Passat", "Volkswagen Passat TDI Diesel", "Volkswagen Taos", "Volkswagen Tiguan", "Volkswagen Touareg TDI Diesel",
  "Volvo C40", "Volvo D13 Diesel Engine", "Volvo EX30", "Volvo EX90", "Volvo FH16", "Volvo S60",
  "Volvo S90", "Volvo V60", "Volvo V90 Cross Country", "Volvo VNL", "Volvo VNR", "Volvo XC40",
  "Volvo XC60", "Volvo XC90", "Wacker Neuson Plate Compactor", "Western Star 4900", "Yale Forklift Diesel", "Yamaha Golf Cart",
  "Yamaha Grizzly ATV", "Yanmar Marine Diesel Engine",
];
const todayStr = () => new Date().toISOString().slice(0, 10);
const plusDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const estNumber = () => "PM-" + new Date().getFullYear() + "-" + String(Math.floor(1000 + Math.random() * 9000));

export default function PeacefulEstimate() {
  // ---------- Estimate meta / workflow ----------
  const [meta, setMeta] = useState({
    number: estNumber(), date: todayStr(), expiration: plusDays(30),
    estimator: "", status: "Draft",
    customer: { name: "", phone: "", email: "", address: "", notify: true },
    insurance: { company: "", claim: "", adjuster: "", deductible: "" },
  });
  const [showInsurance, setShowInsurance] = useState(false);

  // ---------- Vehicle / job ----------
  const [category, setCategory] = useState("domestic");
  const [vehicle, setVehicle] = useState({ ymm: "", id: "", use: "" });
  // Separate Year / Make / Model pickers. Years auto-generate (next year down
  // to 1950 — no manual updates ever). Makes are the common US list; models
  // load live from the free NHTSA vPIC database for the chosen make+year.
  const YMM_YEARS = (() => { const y = new Date().getFullYear() + 1, a = []; for (let i = y; i >= 1950; i--) a.push(String(i)); return a; })();
  const YMM_MAKES = ["Acura","Audi","BMW","Buick","Cadillac","Chevrolet","Chrysler","Dodge","Ford","Freightliner","GMC","Honda","Hyundai","Infiniti","International","Isuzu","Jaguar","Jeep","Kenworth","Kia","Land Rover","Lexus","Lincoln","Mack","Mazda","Mercedes-Benz","MINI","Mitsubishi","Nissan","Peterbilt","Porsche","Ram","Subaru","Tesla","Toyota","Volkswagen","Volvo","Other"];
  const [ymmSel, setYmmSel] = useState({ year: "", make: "", model: "" });
  const [ymmModels, setYmmModels] = useState([]);
  const [ymmLoading, setYmmLoading] = useState(false);
  useEffect(() => {
    if (!ymmSel.make || ymmSel.make === "Other") { setYmmModels([]); return; }
    let alive = true; setYmmLoading(true);
    const u = ymmSel.year
      ? `https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMakeYear/make/${encodeURIComponent(ymmSel.make)}/modelyear/${ymmSel.year}?format=json`
      : `https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMake/${encodeURIComponent(ymmSel.make)}?format=json`;
    fetch(u).then((r) => r.json()).then((d) => {
      if (!alive) return;
      const list = [...new Set((d.Results || []).map((m) => m.Model_Name).filter(Boolean))].sort();
      setYmmModels(list); setYmmLoading(false);
    }).catch(() => { if (alive) { setYmmModels([]); setYmmLoading(false); } });
    return () => { alive = false; };
  }, [ymmSel.make, ymmSel.year]);
  useEffect(() => {
    const parts = [ymmSel.year, ymmSel.make === "Other" ? "" : ymmSel.make, ymmSel.model].filter(Boolean);
    if (parts.length) setVehicle((v) => ({ ...v, ymm: parts.join(" ") }));
  }, [ymmSel]);
  const [jobType, setJobType] = useState("both");

  // ---------- Area rates ----------
  const [areas, setAreas] = useState([{ label: "St. Louis County · 63033", rate: "" }]);
  const [activeArea, setActiveArea] = useState(0);
  const [showAreas, setShowAreas] = useState(false);
  const [showLocal, setShowLocal] = useState(false);

  // ---------- Photos / AI staging ----------
  const [photos, setPhotos] = useState([]);
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [staged, setStaged] = useState([]); // AI suggestions awaiting human approval
  const [err, setErr] = useState("");

  // ---------- Line items (only human-approved lines live here) ----------
  const [rows, setRows] = useState([]);
  const [sublet, setSublet] = useState("");
  const [supplies, setSupplies] = useState("");
  const [paintMat, setPaintMat] = useState("");
  const [taxRate, setTaxRate] = useState("");

  // ---------- Diagnosis ----------
  const [complaint, setComplaint] = useState("");
  const [recentWork, setRecentWork] = useState("");
  const [readings, setReadings] = useState({ low: "", high: "", vent: "", ambient: "" });
  const [dxBusy, setDxBusy] = useState(false);
  const [dxTips, setDxTips] = useState([]);

  // ---------- Customer photos ----------
  const [custPhotos, setCustPhotos] = useState([]);
  const custRef = useRef(null);

  // ---------- VIN decoder (free NHTSA vPIC database — no key needed) ----------
  const [vinBusy, setVinBusy] = useState(false);
  async function decodeVin() {
    const vin = vehicle.id.trim();
    if (vin.length < 11) { setErr("Enter the full 17-character VIN first."); return; }
    setVinBusy(true); setErr("");
    try {
      const res = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(vin)}?format=json`);
      const data = await res.json();
      const r = (data.Results && data.Results[0]) || {};
      const ymm = [r.ModelYear, r.Make, r.Model, r.Trim].filter(Boolean).join(" ");
      if (ymm) setVehicle((v) => ({ ...v, ymm }));
      else setErr("VIN decoded but returned no vehicle details — double-check the VIN.");
    } catch (e) {
      setErr("VIN decoder unreachable — works on your deployed site; this preview sandbox may block outside services.");
    }
    setVinBusy(false);
  }

  // ---------- Quick-add from the service menu ----------
  function addFromMenu(i) {
    const m = SERVICE_MENU[Number(i)];
    if (!m) return;
    setRows((rs) => [...rs, mkRow(
      m.flat != null
        ? { desc: m.label, manualPrice: true, price: String(m.flat), hrs: "" }
        : { desc: m.label, hrs: String(m.hrs), opGroup: m.group || "mechanical" }
    )]);
  }

  // ---------- Customer view / approval ----------
  const [authName, setAuthName] = useState("");
  const [authDate, setAuthDate] = useState("");
  const [authorized, setAuthorized] = useState(false);

  // ---------- Tabs ----------
  // Ordered by how a job actually moves: who + what car, what's wrong, the
  // lines, the money. Everything after Invoice is a tool or a setting, not a
  // step, so a first-timer never has to swipe past eight tabs to bill a job.
  const TABS = ["Details", "Photo Estimate", "Line Items", "Invoice", "Bookings", "Customer View", "Parts", "Inspection", "Fixes & Times", "Media", "Guides", "Community", "Academy", "Integrations", "Notifications", "Dashboard", "Admin", "Help"];
  const [tab, setTab] = useState("Details");

  // ---------- Dashboard ----------
  const [savedEstimates, setSavedEstimates] = useState([]);
  const [saveMsg, setSaveMsg] = useState("");

  // ---------- Tech login & roster (accountability layer — see Admin tab) ----------
  const [techs, setTechs] = useState([]);
  const [currentTech, setCurrentTech] = useState(null);
  const [loginSel, setLoginSel] = useState(0);
  const [loginPin, setLoginPin] = useState("");
  const [newTech, setNewTech] = useState({ name: "", pin: "", email: "", role: "Technician", title: "" });
  const [adminOpen, setAdminOpen] = useState("");
  const [vehSearch, setVehSearch] = useState("");
  const [repairSearch, setRepairSearch] = useState("");
  const [showVehList, setShowVehList] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotSel, setForgotSel] = useState(0);
  const [forgotMsg, setForgotMsg] = useState("");
  async function resetPinByEmail() {
    const t = techs[forgotSel];
    if (!t) return;
    if (!t.email) { setForgotMsg("No email saved for " + t.name + " — the owner can add one and reset your PIN on the Admin tab."); return; }
    const temp = String(Math.floor(100000 + Math.random() * 900000));
    setForgotMsg("Sending…");
    try {
      const r = await apiFetch("/api/email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        to: t.email, subject: BRAND.name + " — PIN reset",
        text: `Hi ${t.name},\n\nYour ${BRAND.name} login PIN was reset by request.\nTemporary PIN: ${temp}\n\nLog in with it, then have the owner set your permanent PIN on the Admin tab.\nIf you didn't request this, tell the owner immediately.` }) });
      if (!r.ok) throw new Error("no email route");
      await saveTechs(techs.map((x, i) => i === forgotSel ? { ...x, pin: temp } : x));
      setForgotMsg("Temporary PIN emailed to " + t.email + " — check the inbox (and spam). The old PIN no longer works.");
    } catch (e) {
      setForgotMsg("Email resets work on your deployed site (with the email key set). Until then: the owner resets PINs on the Admin tab — that's the customer-service path.");
    }
  }
  useEffect(() => { (async () => {
    const r = await store.get("techs:roster");
    if (r) { try { setTechs(JSON.parse(r.value)); } catch (e) {} }
    const t = await store.get("terms:accepted");
    if (t) setAgreeTerms(true); // accepted once — never asked again
  })(); }, []);
  async function saveTechs(list) { setTechs(list); await store.set("techs:roster", list); }
  function tryLogin() {
    const t = techs[loginSel];
    if (t && String(t.pin) === loginPin.trim()) {
      setCurrentTech(t); setLoginPin(""); setErr("");
      setMeta((m) => ({ ...m, estimator: m.estimator || t.name }));
    } else setErr("Wrong PIN — try again.");
  }

  // ---------- Supabase Auth (Phase 1: real per-user accounts) ----------
  // Email + password accounts through Supabase Auth. Roles come from the
  // `staff` table (or user metadata as a fallback): owner / admin / tech.
  // The PIN login above stays available as a fallback until the owner
  // confirms Supabase Auth is live and turns PINs off himself.
  const [authEmail, setAuthEmail] = useState("");
  const [authPass, setAuthPass] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authMsg, setAuthMsg] = useState("");
  const [pinFallbackOpen, setPinFallbackOpen] = useState(false);

  // Turn a Supabase session into the same currentTech shape the whole app
  // already uses (.name, .email, .role, .admin) so nothing downstream changes.
  async function techFromSession(session) {
    if (!session || !session.user) return null;
    const u = session.user;
    let role = (u.user_metadata && u.user_metadata.role) || "";
    let name = (u.user_metadata && u.user_metadata.name) || "";
    try {
      const { data } = await supabase.from("staff").select("name, role").eq("user_id", u.id).maybeSingle();
      if (data) { role = data.role || role; name = data.name || name; }
    } catch (e) {} // staff table optional — metadata still works
    role = String(role || "tech").toLowerCase();
    if (!["owner", "admin", "tech"].includes(role)) role = "tech";
    return {
      name: name || (u.email || "").split("@")[0],
      email: u.email || "",
      role: role.charAt(0).toUpperCase() + role.slice(1),
      authRole: role,                       // machine-readable, drives permissions
      admin: role === "owner" || role === "admin",
      source: "supabase",
    };
  }
  async function supaLogin() {
    if (!supabase) { setAuthMsg("Cloud accounts aren't configured yet — use the PIN login below."); return; }
    const email = authEmail.trim().toLowerCase();
    if (!email.includes("@") || !authPass) { setAuthMsg("Enter your email and password."); return; }
    setAuthBusy(true); setAuthMsg("");
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: authPass });
      if (error) { setAuthMsg(error.message === "Invalid login credentials" ? "Wrong email or password — try again, or tap Forgot password." : error.message); setAuthBusy(false); return; }
      const t = await techFromSession(data.session);
      if (t) { setCurrentTech(t); setAuthPass(""); setErr(""); setMeta((m) => ({ ...m, estimator: m.estimator || t.name })); }
    } catch (e) { setAuthMsg("Couldn't reach the login service — check your connection and try again."); }
    setAuthBusy(false);
  }
  async function supaForgot() {
    if (!supabase) { setAuthMsg("Cloud accounts aren't configured yet."); return; }
    const email = authEmail.trim().toLowerCase();
    if (!email.includes("@")) { setAuthMsg("Type your email above first, then tap Forgot password."); return; }
    setAuthBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      setAuthMsg(error ? error.message : "Reset email sent to " + email + " — check the inbox (and spam).");
    } catch (e) { setAuthMsg("Couldn't send the reset email — try again."); }
    setAuthBusy(false);
  }
  async function logOut() {
    if (supabase && currentTech && currentTech.source === "supabase") {
      try { await supabase.auth.signOut(); } catch (e) {}
    }
    setCurrentTech(null); setStaffLoginChosen(false);
  }
  // Session restore: supabase-js persists the session on the phone; on app
  // open we pick it up so staff stay logged in until they tap log out.
  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (alive && data && data.session) {
          const t = await techFromSession(data.session);
          if (alive && t) { setCurrentTech(t); setMeta((m) => ({ ...m, estimator: m.estimator || t.name })); }
        }
      } catch (e) {}
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT" && alive) setCurrentTech((ct) => (ct && ct.source === "supabase" ? null : ct));
    });
    return () => { alive = false; if (sub && sub.subscription) sub.subscription.unsubscribe(); };
  }, []);

  // ---------- Invoice ----------
  const [inv, setInv] = useState({ number: "", status: "due", serviceCall: "20", diagCredit: "0" });

  // ---------- Integrations: PartsTech & RepairLink credentials ----------
  const [integr, setIntegr] = useState({ ptAccount: "", ptKey: "", rlUser: "", rlKey: "" });
  const [integrMsg, setIntegrMsg] = useState("");
  useEffect(() => { (async () => {
    const r = await store.get("integrations:creds");
    if (r) { try { setIntegr(JSON.parse(r.value)); } catch (e) {} }
  })(); }, []);
  async function saveIntegrations() {
    await store.set("integrations:creds", integr);
    setIntegrMsg("Saved."); setTimeout(() => setIntegrMsg(""), 2000);
  }
  function openRepairLink(r) {
    const q = [vehicle.ymm, r.desc, r.part].filter(Boolean).join(" ");
    try { navigator.clipboard.writeText(q); } catch (e) {}
    window.open("https://repairlinkshop.com", "_blank");
    setErr(`Copied "${q}" — log into RepairLink and paste into search.`);
    setTimeout(() => setErr(""), 4500);
  }

  const isCar = ["domestic", "foreign", "exotic"].includes(category);
  const isLawn = category === "lawn";
  const localList = isCar ? LOCAL.car : LOCAL[category];
  // Shop settings. Declared before rateNum and the shopSupplyFee memo because
  // both read from it during render - a later declaration puts them in the
  // temporal dead zone and crashes the whole app to a blank screen on load.
  const [settings, setSettings] = useState({ requireSig: false, defaultMarkup: "40", defaultRate: "150", defaultEmail: "", stripeLink: "", altPayName: "", altPayLink: "", klarnaLink: "https://www.klarna.com/us/business/", reviewLink: "https://g.page/r/CatNfmPVETgsEAE/review", locationOn: false, guidesOn: false, guideSubs: {}, zipMarkups: [], smsFrom: "", shopEmail: "",
    shopId: "", dpMethod: "percent", dpRate: "50", recordRetentionYears: "3", requireShopApproval: false, shopApprovalStatus: "approved", vendorAccounts: {},
    reqFields: { techOnStart: true, vehicleVin: true, vehicleYMM: true, customerPhone: true, customerAddress: false, allowDeclined: true },
    laborRates: [{ name: "Standard", rate: "150" }, { name: "European", rate: "170" }, { name: "Diesel", rate: "225" }, { name: "Small Engine / Mower", rate: "80" }],
    // Make-based rate rules: when the vehicle field contains the match word,
    // the estimate's labor rate auto-sets to that rate (only if the writer
    // hasn't already hand-picked a different one). Editable in Admin.
    rateRules: [{ match: "BMW", rate: "170" }, { match: "MINI", rate: "170" }, { match: "Mercedes", rate: "170" }, { match: "Diesel", rate: "225" }],
    salesTax: { labor: "0", parts: "9.679", hazmat: "0" },
    discountLimits: { labor: "15", parts: "15" },
    paymentTypes: ["Cash", "Check", "Credit/Debit Card", "Apple Pay", "Google Pay", "Cash App Pay", "Klarna"],
    customerSources: ["Repeat", "Referral", "Tow Partner", "SEO/Website", "Facebook", "Signage/Drive By", "Yelp", "Google", "Church/Community"],
    shopSupplyFee: { rate: "3", cap: "15", taxable: false },
    emailOnStart: true, emailOnPaid: true,
    inspectionPricing: { tier1: "89", tier2: "149", tier3: "219" },
    serviceAreas: [
      { name: "Florissant", color: "#B3372B" }, { name: "Wentzville", color: "#2E7D32" },
      { name: "St. Louis", color: "#7A1F1F" }, { name: "St. Charles", color: "#1a5fb4" },
      { name: "St. Peters", color: "#6b8fd4" }, { name: "O'Fallon, MO", color: "#B8860B" },
    ],
    custDisplay: { showItemizedParts: true, showRecPricesDefault: false },
    msgMaster: true, assistantPro: true, features: { bookings: true, parts: false, ai: true, media: true, portal: true, community: false, academy: false, shield: false, fixes: true, custCommunity: true, inspection: true } });
  // Day / night theme: shadows the module palette for everything rendered
  // below. Declared AFTER settings on purpose — declaring anything that reads
  // settings before its useState is the exact crash that once blanked this
  // whole app (temporal dead zone), so order here is load-bearing.
  const C = settings.nightMode ? C_NIGHT : C_DAY;
  const rateNum = parseFloat(areas[activeArea]?.rate) || parseFloat(settings.defaultRate) || 0;
  // Make-based rate auto-apply: "the system is supposed to change to 170 for
  // BMWs" — and now it does. If the vehicle matches a rule and the current
  // area is still on the default rate (writer hasn't hand-picked one), the
  // rate switches itself and says so. A manual pick always wins after that.
  const [autoRateNote, setAutoRateNote] = useState("");
  useEffect(() => {
    const ymm = (vehicle.ymm || "").toLowerCase();
    if (!ymm) { setAutoRateNote(""); return; }
    const rule = (settings.rateRules || []).find((ru) => ru.match && ymm.includes(String(ru.match).toLowerCase()));
    if (!rule) { setAutoRateNote(""); return; }
    const cur = String(areas[activeArea]?.rate || "");
    const def = String(settings.defaultRate || "150");
    if (cur === String(rule.rate)) { setAutoRateNote("Rate auto-set to $" + rule.rate + "/hr — vehicle matched \"" + rule.match + "\"."); return; }
    if (!cur || cur === def) {
      setAreas((as) => as.map((a, j) => j === activeArea ? { ...a, rate: String(rule.rate) } : a));
      setAutoRateNote("Rate auto-set to $" + rule.rate + "/hr — vehicle matched \"" + rule.match + "\". Tap a different labor type to override.");
    } else setAutoRateNote("");
  }, [vehicle.ymm, settings.rateRules, activeArea]);
  const num = (v) => parseFloat(v) || 0;
  const money = (n) => "$" + (n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // price auto-calc: cost * (1 + markup%) unless manually overridden
  function priceFor(r) {
    if (r.manualPrice) return num(r.price);
    return num(r.cost) * (1 + num(r.markup) / 100);
  }

  const groupTotals = useMemo(() => {
    const t = {}; OP_GROUPS.forEach((g) => (t[g.key] = { parts: 0, labor: 0 }));
    rows.forEach((r) => {
      const g = t[r.opGroup] || t.mechanical;
      g.parts += priceFor(r);
      g.labor += num(r.hrs) * rateNum;
    });
    return t;
  }, [rows, rateNum]);

  const totals = useMemo(() => {
    const partsSub = rows.reduce((s, r) => s + priceFor(r), 0);
    const laborSub = rows.reduce((s, r) => s + num(r.hrs) * rateNum, 0);
    const sub = partsSub + laborSub + num(sublet) + num(supplies) + num(paintMat);
    const tax = (partsSub + num(supplies) + num(paintMat)) * (num(taxRate) / 100);
    return { partsSub, laborSub, sub, tax, grand: sub + tax };
  }, [rows, rateNum, sublet, supplies, taxRate, paintMat]);
  const shopFeeSuggested = useMemo(() => {
    const rate = num(settings.shopSupplyFee?.rate) / 100;
    const cap = num(settings.shopSupplyFee?.cap);
    if (!rate) return 0;
    const raw = (totals.partsSub + totals.laborSub) * rate;
    return cap > 0 ? Math.min(raw, cap) : raw;
  }, [settings.shopSupplyFee, totals.partsSub, totals.laborSub]);

  function readImages(files, cb) {
    Array.from(files || []).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => cb({ name: file.name, dataUrl: ev.target.result, base64: ev.target.result.split(",")[1], mediaType: file.type });
      reader.readAsDataURL(file);
    });
  }
  function onFiles(e) { readImages(e.target.files, (img) => setPhotos((p) => [...p, img])); e.target.value = ""; }
  function onCustFiles(e) { readImages(e.target.files, (img) => setCustPhotos((p) => [...p, { ...img, caption: "", comment: "", kind: (img.mediaType || "").startsWith("video") ? "video" : "image" }])); e.target.value = ""; }

  async function callClaude(content, tools, jsonMode) {
    const body = { max_tokens: 1200, messages: [{ role: "user", content }] };
    if (tools) body.tools = tools;
    if (jsonMode) body.jsonMode = true;
    const res = await fetch(API_BASE, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`API route returned ${res.status} — check your /api/claude deployment and NVIDIA_API_KEY.`);
    const data = await res.json();
    return (data.content || []).map((i) => (i.type === "text" ? i.text : "")).join("\n");
  }

  function scopeText() {
    if (category === "diesel") return "heavy-duty / diesel mechanical work";
    if (category === "lawn") return "outdoor power equipment / small-engine work — no VIN";
    const jt = jobType === "both" ? "collision AND mechanical" : jobType === "collision" ? "collision / body" : "mechanical";
    return `${category} vehicle ${jt} work`;
  }

  async function analyze() {
    setErr("");
    if (photos.length === 0) { setErr("Add at least one photo first."); return; }
    setBusy(true);
    try {
      const content = photos.map((p) => ({ type: "image", source: { type: "base64", media_type: p.mediaType, data: p.base64 } }));
      content.push({ type: "text", text:
`You are an experienced estimator drafting a repair estimate from photos. Item: ${vehicle.ymm || category}. Scope: ${scopeText()}.
Complaint: ${complaint || "(none)"}.
Your role is ASSISTANT: recommend and explain — the technician makes every final call.
Separate what you can SEE clearly from what needs teardown/further inspection to confirm.
Also, using the note field of the relevant line (never a separate item): flag PROBABLE HIDDEN DAMAGE behind visible damage (e.g. "check absorber + bumper bar behind this cover"); recommend an ADAS CALIBRATION CHECK when the work touches a windshield, bumper/grille with sensors, mirrors, or suspension/alignment on a vehicle likely to have lane-keep/adaptive cruise/auto-braking; and add a one-phrase WHY when a procedure requires an operation people skip (e.g. "battery disconnect required — SRS").
Return ONLY a JSON array (no prose/fences) of up to 10 items, each exactly:
{"operation":"<short op>","opGroup":"body|paint|mechanical|frame","laborHours":<number>,"part":true|false,"partName":"<generic name or empty>","confidence":"low|med|high","needsTeardown":true|false,"note":"<short or empty>"}
Rules: NEVER invent part numbers or prices. Conservative hours. If nothing clear, return []. Output ONLY the JSON array.` });
      const text = await callClaude(content, undefined, true);
      const parsed = JSON.parse(text.replace(/```json/g, "").replace(/```/g, "").trim());
      if (!Array.isArray(parsed) || !parsed.length) { setErr("No clear work found — add closer shots or enter lines by hand."); setBusy(false); return; }
      setStaged((prev) => [...prev, ...parsed.map((it) => ({
        sid: ID++, operation: it.operation, opGroup: it.opGroup || "mechanical",
        laborHours: it.laborHours ?? "", part: it.part, partName: it.partName || "",
        confidence: it.confidence || "low", needsTeardown: !!it.needsTeardown, note: it.note || "",
      }))]);
    } catch (e) { setErr(e.message || "Couldn't read a clean draft back."); }
    setBusy(false);
  }

  function approveStaged(sid) {
    const it = staged.find((s) => s.sid === sid);
    if (!it) return;
    setRows((rs) => [...rs, mkRow({
      desc: it.partName ? `${it.operation} — ${it.partName}` : it.operation,
      opGroup: it.opGroup, hrs: it.laborHours, aiDraft: true,
      confidence: it.confidence, teardown: it.needsTeardown,
      note: it.note,
    })]);
    setStaged((s) => s.filter((x) => x.sid !== sid));
  }
  function approveAllStaged() { staged.forEach((s) => approveStaged(s.sid)); }
  function rejectStaged(sid) { setStaged((s) => s.filter((x) => x.sid !== sid)); }

  async function getDiagnostics() {
    setErr(""); setDxBusy(true);
    try {
      const content = photos.map((p) => ({ type: "image", source: { type: "base64", media_type: p.mediaType, data: p.base64 } }));
      const kind = category === "lawn" ? "small-engine" : category === "diesel" ? "diesel" : "automotive";
      content.push({ type: "text", text:
`You are a master ${kind} diagnostic tech. Item: ${vehicle.ymm || category}. Complaint: ${complaint || "(none)"}. Recent work: ${recentWork || "(none)"}.
Readings: low ${readings.low || "-"} psi, high ${readings.high || "-"} psi, vent ${readings.vent || "-"}°F, ambient ${readings.ambient || "-"}°F.
Return ONLY a JSON array (max 7) of {"check":"<do/verify this>","why":"<short reason>","priority":"high|med|low"}. No prose.` });
      const text = await callClaude(content, undefined, true);
      const j = JSON.parse(text.replace(/```json/g, "").replace(/```/g, "").trim());
      setDxTips(Array.isArray(j) ? j : []);
      if (!Array.isArray(j) || !j.length) setErr("No clear diagnostic read — add a photo or fill in the complaint.");
    } catch (e) { setErr(e.message || "Couldn't generate diagnostic tips."); }
    setDxBusy(false);
  }

  async function lookupPrice(id) {
    const row = rows.find((r) => r.id === id);
    if (!row || !row.desc) { setErr("Add a description on that line first."); return; }
    setRow(id, "priceBusy", true); setErr("");
    const sources = category === "diesel" ? "diesel / heavy-duty truck parts suppliers"
      : category === "lawn" ? "small-engine / OPE parts" : "OEM and aftermarket auto parts suppliers";
    try {
      const text = await callClaude(
        [{ type: "text", text:
`Find a ballpark current US retail COST (what a shop pays, not retail markup) for this part, favoring ${sources}, near St. Louis, MO. Item: ${vehicle.ymm || category}. Part/operation: "${row.desc}".
Return ONLY JSON: {"price": <number or null>, "source": "<site/store>", "confidence": "low|med|high"}. No prose.` }],
        [{ type: "web_search_20250305", name: "web_search", user_location: { type: "approximate", city: "St. Louis", region: "Missouri", country: "US" } }]
      );
      const j = JSON.parse(text.replace(/```json/g, "").replace(/```/g, "").trim());
      setRows((rs) => rs.map((r) => r.id === id ? {
        ...r, cost: j.price != null ? String(j.price) : r.cost, manualPrice: false,
        priceDate: todayStr(), supplier: r.supplier || (j.source || ""),
        priceSrc: `ballpark cost · ${j.source || "web"} · ${j.confidence || "low"} confidence — confirm before quoting`,
        priceBusy: false,
      } : r));
    } catch (e) {
      setRows((rs) => rs.map((r) => r.id === id ? { ...r, priceBusy: false } : r));
      setErr("Couldn't pull a ballpark price — check your counter or supplier account.");
    }
  }

  const setRow = (id, k, v) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [k]: v } : r)));
  const delRow = (id) => setRows((rs) => rs.filter((r) => r.id !== id));

  function customerText() {
    const lines = rows.filter((r) => r.desc).map((r) => {
      const p = priceFor(r), labor = num(r.hrs) * rateNum;
      return `${r.desc}${r.teardown ? " [needs teardown to confirm]" : ""}\n   ${r.condition}${settings.showPartNumbers ? ` · Part# ${r.part || "-"}` : ""} | Parts ${money(p)} | ${num(r.hrs)} hr @ ${money(rateNum)} = ${money(labor)} | Line ${money(p + labor)}`;
    });
    const dx = dxTips.length ? `\nDiagnostic findings:\n` + dxTips.map((t) => `   - ${t.check}`).join("\n") + "\n" : "";
    return `${BRAND.name} — REPAIR ESTIMATE #${meta.number}
${BRAND.tagline}
${BRAND.phone} | ${BRAND.email} | ${BRAND.site}
${meta.warrCo ? "WARRANTY JOB — " + meta.warrCo + (meta.warrNum ? " #" + meta.warrNum : "") + " — authorization required before repairs\n" : ""}Service provided under the posted shop terms (Terms page); booking deposits are non-refundable and credit to the job; special-order parts returned or cancelled after ordering carry a 10% restocking fee.\nStatus: ${meta.status}   Estimator: ${meta.estimator || "-"}   Date: ${meta.date}   Expires: ${meta.expiration}

Customer: ${meta.customer.name || "-"}   Phone: ${meta.customer.phone || "-"}
${meta.insurance.company ? `Insurance: ${meta.insurance.company}   Claim#: ${meta.insurance.claim || "-"}\n` : ""}
Category: ${CATEGORIES.find((c) => c.key === category)?.label}
Item: ${vehicle.ymm || "-"}   ${isLawn ? "Serial" : "VIN"}: ${vehicle.id || "-"}   ${isLawn ? "Hours" : "Miles"}: ${vehicle.use || "-"}
Area: ${areas[activeArea]?.label || "-"}   Labor rate: ${money(rateNum)}/hr
${complaint ? `Complaint: ${complaint}\n` : ""}${dx}
${lines.join("\n")}

Parts subtotal: ${money(totals.partsSub)}
Labor subtotal: ${money(totals.laborSub)}
Sublet: ${money(num(sublet))}   Shop supplies: ${money(num(supplies))}${num(paintMat) > 0 ? "   Paint materials: " + money(num(paintMat)) : ""}
Tax: ${money(totals.tax)}
GRAND TOTAL: ${money(totals.grand)}

Photos on file: ${custPhotos.length}
${authorized ? `Authorized by: ${authName} on ${authDate}\n` : ""}
${(settings.stripeLink || "").startsWith("http") && inv.status === "due" ? "Pay online: " + settings.stripeLink + "\n" : ""}Estimate only. Hidden/additional damage found at teardown may require a supplement.
Warranty: 12 months / 12,000 miles, parts & labor.`;
  }

  function copyText() { navigator.clipboard.writeText(customerText()); setErr("Copied estimate to clipboard."); setTimeout(() => setErr(""), 2500); }
  function printView() { setTab("Customer View"); setTimeout(() => window.print(), 200); }

  function downloadCSV() {
    const head = ["Description", "Group", "Condition", "Part #", "Cost", "Markup %", "Customer Price", "Labor Hrs", "Labor $", "Line Total", "Supplier", "Price Date"];
    const bodyRows = rows.filter((r) => r.desc).map((r) => {
      const p = priceFor(r), labor = num(r.hrs) * rateNum;
      return [r.desc, r.opGroup, r.condition, r.part, num(r.cost).toFixed(2), r.markup, p.toFixed(2), num(r.hrs), labor.toFixed(2), (p + labor).toFixed(2), r.supplier, r.priceDate];
    });
    const csv = [head, ...bodyRows, [], ["", "", "", "", "", "", "", "", "", "Grand Total", totals.grand.toFixed(2)]]
      .map((r) => r.map((c) => `"${String(c ?? "")}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = `${meta.number}.csv`; a.click(); URL.revokeObjectURL(url);
  }

  // ---------- Shop settings (Admin → permanent defaults) ----------
  // Per-shop feature switches: each shop's deployment shows only what its owner turns on.
  // (With cloud accounts, the master admin flips these per subscriber shop from one screen.)
  const feat = settings.features || {};
  // Role permissions (Phase 1): owner sees everything; admin sees everything;
  // techs see the Write Estimate flow + Jobs + Help only. PIN logins keep
  // their old behavior (admin flag) so nothing breaks before Auth goes live.
  const TECH_TABS = ["Details", "Photo Estimate", "Line Items", "Customer View", "Invoice", "Bookings", "Inspection", "Media", "Parts", "Notifications", "Help"];
  const roleAllows = (t) => {
    if (!currentTech) return true;
    if (currentTech.authRole === "tech") return TECH_TABS.includes(t);
    if (currentTech.source !== "supabase" && !currentTech.admin && (t === "Admin" || t === "Dashboard" || t === "Integrations")) return false;
    return true;
  };
  const tabEnabled = (t) =>
    !roleAllows(t) ? false :
    t === "Bookings" ? feat.bookings !== false :
    t === "Parts" ? feat.parts !== false :
    t === "Photo Estimate" ? feat.ai !== false :
    t === "Media" ? feat.media !== false :
    t === "Guides" ? !!settings.guidesOn :
    t === "Community" ? feat.community !== false :
    t === "Academy" ? feat.academy === true :
    t === "Fixes & Times" ? feat.fixes !== false : true;
  useEffect(() => { if (!tabEnabled(tab)) setTab("Details"); }, [settings, tab, currentTech]);
  const [setMsg, setSetMsg] = useState("");
  useEffect(() => { (async () => {
    const r = await store.get("settings:shop");
    if (r) { try {
      const d = JSON.parse(r.value);
      setSettings((s) => ({ ...s, ...d }));
      if (d.defaultRate) setAreas((a) => a.map((x) => x.rate ? x : { ...x, rate: d.defaultRate }));
    } catch (e) {} }
  })(); }, []);
  async function saveSettings() { await store.set("settings:shop", settings); setSetMsg("Saved."); setTimeout(() => setSetMsg(""), 2000); }
  const mkRow = (over = {}) => {
    const areaLabel = (areas[activeArea] && areas[activeArea].label) || "";
    const zm = (settings.zipMarkups || []).find((z) => z.zip && areaLabel.includes(z.zip));
    return newRow({ markup: (zm && zm.markup) || settings.defaultMarkup || "40", ...over });
  };
  // ---------- Vendor cart paste-in (the Nexpart/PartsTech bridge) ----------
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [pasteParsed, setPasteParsed] = useState([]);
  function parseCart() { setPasteParsed(parsePastedParts(pasteText)); }
  function addParsedParts() {
    if (!pasteParsed.length) return;
    setRows((rs) => [...rs, ...pasteParsed.map((pp) => mkRow({ desc: pp.qty > 1 ? `${pp.desc} (qty ${pp.qty})` : pp.desc, part: pp.part, cost: String(pp.extendedCost) }))]);
    setErr(`Added ${pasteParsed.length} part${pasteParsed.length > 1 ? "s" : ""} from your cart — costs came in as YOUR cost; your markup priced them automatically. Check each line.`);
    setTimeout(() => setErr(""), 5000);
    setPasteText(""); setPasteParsed([]); setPasteOpen(false);
  }
  function applyFleetPackage(pkg) {
    const newRows = pkg.items.map((it) => mkRow({ desc: it.desc, hrs: it.hrs, part: it.part || "", cost: it.partCost ? String(it.partCost) : "" }));
    setRows((r) => [...r, ...newRows]);
    setErr(`Added ${newRows.length} line(s) from "${pkg.name}".`);
    setTimeout(() => setErr(""), 4000);
  }

  // ---------- Signature pad (optional pre-repair approval) ----------
  const sigRef = useRef(null);
  const sigDrawing = useRef(false);
  const [sigData, setSigData] = useState("");
  const [sigTyped, setSigTyped] = useState(false);
  function sigPos(e) {
    const c = sigRef.current, r = c.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (c.width / r.width), y: (e.clientY - r.top) * (c.height / r.height) };
  }
  function sigStart(e) { e.preventDefault(); if (!sigRef.current) return; sigDrawing.current = true; const ctx = sigRef.current.getContext("2d"); const p = sigPos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); }
  function sigMove(e) { if (!sigDrawing.current || !sigRef.current) return; e.preventDefault(); const ctx = sigRef.current.getContext("2d"); ctx.lineWidth = 2.2; ctx.lineCap = "round"; ctx.strokeStyle = "#F7F3EF"; const p = sigPos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); }
  function sigEnd() { if (!sigDrawing.current) return; sigDrawing.current = false; try { setSigData(sigRef.current.toDataURL()); } catch (e) {} }
  function sigClear() { const c = sigRef.current; if (!c) return; c.getContext("2d").clearRect(0, 0, c.width, c.height); setSigData(""); }

  // ---------- Send invoice by email + shareable link ----------
  const [askEmail, setAskEmail] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [dashFilter, setDashFilter] = useState("All");
  const [showAdj, setShowAdj] = useState(false);
  const emailBusy = useRef(false);
  async function sendInvoiceEmail() {
    if (emailBusy.current) return;            // double-tap guard
    const to = (meta.customer.email || settings.defaultEmail || "").trim();
    if (!to) { setAskEmail(true); return; }
    emailBusy.current = true;
    const subject = `Peaceful Motors Invoice ${inv.number || meta.number} — ${vehicle.ymm || "vehicle"}`;
    const bodyText = customerText();
    try {
      const r = await apiFetch("/api/email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to, subject, text: bodyText }) });
      if (r.ok) {
        setErr("Invoice emailed to " + to); setTimeout(() => setErr(""), 3000);
      } else {
        // Server couldn't send it — open the mail window ONCE instead of
        // firing a second send behind the customer's back.
        setEmailBox({ open: true, to, from: settings.defaultEmail || shopEmail(), subject, body: bodyText.slice(0, 1800) });
        setErr("Sending from the shop address didn't go through — send it from your own mail app instead.");
        setTimeout(() => setErr(""), 5000);
      }
    } catch (e) {
      setEmailBox({ open: true, to, from: settings.defaultEmail || shopEmail(), subject, body: bodyText.slice(0, 1800) });
    }
    setTimeout(() => { emailBusy.current = false; }, 1200);
  }
  // ---------- VIN barcode scanner (door jamb / title / windshield) ----------
  const [scanOpen, setScanOpen] = useState(false);
  const scanVideo = useRef(null);
  const scanStream = useRef(null);
  const scanTimer = useRef(null);
  function stopScan() {
    if (scanTimer.current) clearInterval(scanTimer.current);
    if (scanStream.current) scanStream.current.getTracks().forEach((t) => t.stop());
    scanTimer.current = null; scanStream.current = null; setScanOpen(false);
  }
  async function startScan() {
    if (!("BarcodeDetector" in window)) { setErr("Barcode scanning isn't supported in this browser (works best in Chrome on Android) — type the VIN and tap VIN→."); return; }
    setScanOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      scanStream.current = stream;
      setTimeout(() => { if (scanVideo.current) { scanVideo.current.srcObject = stream; scanVideo.current.play(); } }, 50);
      const det = new window.BarcodeDetector({ formats: ["code_39", "code_128", "pdf417", "qr_code", "data_matrix"] });
      scanTimer.current = setInterval(async () => {
        try {
          if (!scanVideo.current) return;
          const codes = await det.detect(scanVideo.current);
          for (const c of codes) {
            const v = (c.rawValue || "").replace(/[^A-HJ-NPR-Z0-9]/gi, "").toUpperCase();
            if (v.length >= 17) {
              setVehicle((x) => ({ ...x, id: v.slice(-17) }));
              stopScan(); setErr("VIN captured from barcode — tap VIN→ to decode."); setTimeout(() => setErr(""), 3500);
              return;
            }
          }
        } catch (e) {}
      }, 400);
    } catch (e) { stopScan(); setErr("Couldn't open the camera — check permissions, or type the VIN."); }
  }

  // ---------- Customer history ----------
  const [history, setHistory] = useState(null);
  async function lookupHistory() {
    const nm = (meta.customer.name || "").trim().toLowerCase();
    const ph = (meta.customer.phone || "").replace(/\D/g, "");
    if (!nm && !ph) { setErr("Enter a customer name or phone first, then look up."); return; }
    const listing = await store.list("estimates:");
    const out = [];
    if (listing && listing.keys) {
      for (const k of listing.keys) {
        const r = await store.get(k);
        if (!r) continue;
        try {
          const e = JSON.parse(r.value);
          const en = (e.meta && e.meta.customer && e.meta.customer.name || "").toLowerCase();
          const ep = (e.meta && e.meta.customer && e.meta.customer.phone || "").replace(/\D/g, "");
          if ((nm && en && en.includes(nm)) || (ph && ep && ep === ph)) out.push(e);
        } catch (x) {}
      }
    }
    out.sort((a2, b2) => (b2.savedAt || "").localeCompare(a2.savedAt || ""));
    setHistory(out);
  }

  // ---------- Customer portal state ----------
  const [custPortal, setCustPortal] = useState(false);
  const [staffLoginChosen, setStaffLoginChosen] = useState(false);
  const [portalQ, setPortalQ] = useState("");
  const [portalRes, setPortalRes] = useState(null);
  const [faq, setFaq] = useState("");
  async function portalLookup() {
    const q = portalQ.trim().toLowerCase();
    const qd = q.replace(/\D/g, "");
    if (!q) return;
    // Phase 2 security: lookup runs server-side through the Worker (service
    // key). The legacy direct read below can ONLY run if the Worker answers
    // 501 "not_yet_connected" (its Supabase secrets aren't set yet). Any
    // other failure shows a message and stops — so once the secrets exist,
    // this fallback is unreachable dead code by construction, and after
    // RLS_LOCKDOWN.sql it couldn't read anything anyway. Reviewer-approved
    // pattern: no flag to forget, no way to silently reopen the old path.
    let legacyAllowed = false;
    try {
      const r = await apiFetch("/api/portal/lookup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ q }) });
      if (r.ok) { const d = await r.json(); setPortalRes(d.estimates || []); return; }
      if (r.status === 501) legacyAllowed = true; // Worker not configured yet — migration window only
      else if (r.status === 429) { setPortalRes([]); setFaq("Too many lookups — wait a minute and try again."); return; }
      else { setPortalRes([]); setFaq("Lookup didn't go through — try again in a moment, or text the shop and we'll pull it up for you."); return; }
    } catch (e) { setPortalRes([]); setFaq("Couldn't reach the shop system — check your connection and try again."); return; }
    if (!legacyAllowed) return;
    const listing = await store.list("estimates:");
    const out = [];
    if (listing && listing.keys) {
      for (const k of listing.keys) {
        const r = await store.get(k);
        if (!r) continue;
        try {
          const e = JSON.parse(r.value);
          const ph = ((e.meta && e.meta.customer && e.meta.customer.phone) || "").replace(/\D/g, "");
          const num = ((e.meta && e.meta.number) || "").toLowerCase();
          if ((qd.length >= 7 && ph && ph.endsWith(qd.slice(-7))) || (num && num === q)) out.push(e);
        } catch (x) {}
      }
    }
    setPortalRes(out);
  }

  // ---------- Portal self-booking (replaces Setmore) ----------
  const [portalBk, setPortalBk] = useState({ name: "", phone: "", vehicle: "", date: "", time: "", issue: "", email: "", pref: "text" });
  const [pvSent, setPvSent] = useState(""); const [pvCode, setPvCode] = useState(""); const [pvOK, setPvOK] = useState(false);
  const [pHp, setPHp] = useState(""); const [pHuman, setPHuman] = useState(""); const [pDepositPaid, setPDepositPaid] = useState(false);
  const [pPhotos, setPPhotos] = useState([]);
  const [pTerms, setPTerms] = useState("accepted");
  const [insp, setInsp] = useState({ tier: 2, items: {}, notes: "" });
  const [textBox, setTextBox] = useState({ open: false, to: "", body: "" });
  const [emailBox, setEmailBox] = useState({ open: false, to: "", from: "", subject: "", body: "" });
  function openInMessages() {
    window.location.href = "sms:" + (textBox.to || "") + "?&body=" + encodeURIComponent(textBox.body);
    setTextBox({ open: false, to: "", body: "" });
  }
  function copyTextBoxMessage() {
    navigator.clipboard?.writeText(textBox.body || "").then(() => { setErr("Message copied"); setTimeout(() => setErr(""), 2000); });
  }
  const [inspMsg, setInspMsg] = useState("");
  const INSPECTION_SECTIONS = [
    { tier: 1, name: "Exterior", items: ["Body panels & paint condition", "Glass, mirrors & lights", "Tires — tread depth & wear pattern", "Wheels & rims"] },
    { tier: 1, name: "Under the Hood", items: ["Engine oil level & condition", "Coolant level & condition", "Belts & hoses", "Battery & terminals"] },
    { tier: 1, name: "Under the Vehicle", items: ["Frame & rust condition", "Exhaust system", "Visible leaks (engine, trans, diff)"] },
    { tier: 2, name: "Suspension & Steering", items: ["Suspension components", "Steering components & alignment feel", "Brake pads & lines (visible)"] },
    { tier: 2, name: "Interior", items: ["Seats & upholstery", "Dash electronics & warning lights", "HVAC operation", "Power windows, locks & mirrors"] },
    { tier: 2, name: "Test Drive", items: ["Acceleration & transmission shifting", "Braking feel", "Steering tracking", "Unusual noises"] },
    { tier: 3, name: "Deep Diagnostic", items: ["Full OBD-II code scan & freeze-frame data", "Battery load test", "Compression / leak-down notes", "Structural measurement notes"] },
  ];
  function inspItemKey(section, item) { return section + " — " + item; }
  function setInspItem(key, patch) { setInsp((v) => ({ ...v, items: { ...v.items, [key]: { ...(v.items[key] || {}), ...patch } } })); }
  const inspPrice = () => insp.tier === 1 ? settings.inspectionPricing?.tier1 : insp.tier === 2 ? settings.inspectionPricing?.tier2 : settings.inspectionPricing?.tier3;
  function inspReportText() {
    const rows = INSPECTION_SECTIONS.filter((sec) => sec.tier <= insp.tier).flatMap((sec) => sec.items.map((it) => {
      const k = inspItemKey(sec.name, it); const rec = insp.items[k] || {};
      return `${sec.name} — ${it}: ${rec.status ? rec.status.toUpperCase() : "NOT CHECKED"}${rec.note ? " (" + rec.note + ")" : ""}`;
    }));
    return `${BRAND.name} — VEHICLE INSPECTION REPORT
Tier ${insp.tier} of 3 — $${inspPrice()}
Vehicle: ${vehicle.ymm || "-"}   VIN: ${vehicle.vin || "-"}
Prepared for: ${meta.customer?.name || "-"}   Date: ${todayStr()}

FINDINGS
${rows.join("\n")}
${insp.notes ? "\nInspector notes: " + insp.notes : ""}

DISCLOSURE
This report reflects the vehicle's condition at the time and place of this inspection only, based on a visual and operational check without disassembly. It is not a guarantee against future failure, not a warranty, and not a substitute for the buyer's own review of title, history reports, and a decision to purchase. Conditions can change or be discovered only after disassembly or extended use.

INSURANCE
${BRAND.name} carries general liability and garage liability coverage for on-site inspection work. This report is a professional opinion, not an insurance product — it does not insure the vehicle, and coverage of the inspection visit itself does not extend to decisions made based on its findings.
`;
  }
  async function emailInspReport() {
    const c = meta.customer || {};
    if (!c.email) { setInspMsg("Add the customer's email on the Details tab first."); return; }
    setInspMsg("Sending...");
    try {
      const r = await apiFetch("/api/email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to: c.email, subject: BRAND.name + " — Vehicle Inspection Report (Tier " + insp.tier + ")", text: inspReportText() }) });
      setInspMsg(r.ok ? "Report emailed to " + c.email + "." : "Could not send — try again or use Print / Save PDF.");
    } catch (e) { setInspMsg("Could not send — try again or use Print / Save PDF."); }
    setTimeout(() => setInspMsg(""), 5000);
  }
  const [pBall, setPBall] = useState(null);
  function addPortalPhotos(e) {
    const files = Array.from(e.target.files || []).slice(0, 3 - pPhotos.length);
    files.forEach((f) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement("canvas");
        const s2 = Math.min(1, 900 / Math.max(img.width, img.height));
        c.width = Math.round(img.width * s2); c.height = Math.round(img.height * s2);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        const d = c.toDataURL("image/jpeg", 0.7);
        setPPhotos((l) => (l.length >= 3 ? l : [...l, d]));
      };
      img.src = URL.createObjectURL(f);
    });
    e.target.value = "";
  }
  function portalBallpark() {
    if (!portalBk.issue.trim()) { setPortalBkMsg("Tell us what it's doing first."); setTimeout(() => setPortalBkMsg(""), 3000); return; }
    setPBall(offlineDiag((portalBk.vehicle || "") + " " + portalBk.issue));
  }
  async function sendVerifyEmail() {
    if (!portalBk.email || !portalBk.email.includes("@")) { setPortalBkMsg("Enter your email first."); return; }
    const code = String(Math.floor(100000 + Math.random() * 900000));
    setPvSent(code); setPvOK(false);
    try {
      const r = await apiFetch("/api/email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to: portalBk.email, subject: BRAND.name + " verification code", text: "Your verification code is " + code + ". Enter it on the booking page to confirm it is really you." }) });
      if (!r.ok) throw new Error("route");
      setPortalBkMsg("Code emailed — check your inbox and enter it below.");
    } catch (e) { setPortalBkMsg("Could not send the code right now — you can book without verifying."); }
    setTimeout(() => setPortalBkMsg(""), 6000);
  }
  function checkVerify() {
    if (pvCode && pvSent && pvCode === pvSent) { setPvOK(true); setPortalBkMsg("Verified ✓"); }
    else { setPortalBkMsg("That code does not match — try again."); }
    setTimeout(() => setPortalBkMsg(""), 4000);
  }
  const [portalBkMsg, setPortalBkMsg] = useState("");
  const [portalTermsOpen, setPortalTermsOpen] = useState(false);
  async function portalBook() {
    if (pHp) { setPortalBkMsg("Request received! We'll text you shortly to confirm your window."); return; }
    if (!portalBk.name || !portalBk.phone) { setPortalBkMsg("Name and phone please — that's how we confirm your time."); return; }
    if (pHuman.trim() !== "7") { setPortalBkMsg("Quick human check: what is 3 + 4? Enter the number to send your request."); return; }
    if (portalBk.time && slotIsFull(portalBk.date || todayStr(), portalBk.time)) {
      const next = firstAvailableSlot(portalBk.date || todayStr());
      setPortalBkMsg("Sorry — someone just took that time." + (next ? ` Next open is ${next.date} at ${next.time}. Tap "First available" to grab it.` : " Please pick another time."));
      return;
    }
    // Same rule as lookup: the legacy direct write can ONLY run if the
    // Worker answers 501 (secrets not set). Every other failure stops with
    // a human message — the insecure path cannot silently reopen.
    let booked = false, legacyAllowed = false;
    try {
      const r = await apiFetch("/api/portal/book", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        name: portalBk.name, phone: portalBk.phone, vehicle: portalBk.vehicle, date: portalBk.date || todayStr(), time: portalBk.time || "",
        issue: portalBk.issue, email: portalBk.email, pref: portalBk.pref, verified: pvOK, photos: pPhotos, ball: pBall || undefined, terms: pTerms }) });
      if (r.ok) booked = true;
      else if (r.status === 501) legacyAllowed = true; // migration window only
      else if (r.status === 429) { setPortalBkMsg("Too many attempts — wait a minute and try once more."); return; }
      else { setPortalBkMsg("Couldn't send your request just now — please try again, or text the shop and we'll book you by hand."); return; }
    } catch (e) { setPortalBkMsg("Couldn't reach the shop system — check your connection and try again."); return; }
    if (!booked && !legacyAllowed) return;
    if (!booked) await store.set("bookings:" + (portalBk.date || todayStr()) + "-" + Date.now(),
      { name: portalBk.name, phone: portalBk.phone, vehicle: portalBk.vehicle, date: portalBk.date || todayStr(), time: portalBk.time || "", tech: "", notes: portalBk.issue, email: portalBk.email, pref: portalBk.pref, verified: pvOK, photos: pPhotos, ball: pBall || undefined, terms: pTerms, status: "Requested", source: "portal" });
    try {
      const ack = "Hey " + portalBk.name + ", got your request — thank you for reaching out to " + BRAND.name + ". " + (pBall ? "Based on what you described, a rough range would be " + money(pBall.lo) + "-" + money(pBall.hi) + " for " + pBall.causes.join(", ").toLowerCase() + ", but I'll know more once I actually look at it. " : "") + "I'll confirm a time with you shortly. Just so it's said plainly: that first-look number isn't a real quote yet, your actual written estimate comes after I inspect it. Reply STOP if you'd rather not get texts.";
      if (portalBk.pref === "email" && portalBk.email) { apiFetch("/api/email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to: portalBk.email, subject: BRAND.name + " — request received", text: ack }) }).catch(() => {}); }
      // Text preference: nothing sends itself automatically (no paid texting service running) - the
      // booking still lands on the Bookings tab immediately, marked so staff know to text by hand.
    } catch (e) {}
    setPortalBk({ name: "", phone: "", vehicle: "", date: "", issue: "", email: "", pref: "text" });
    setPvSent(""); setPvCode(""); setPvOK(false); setPHuman(""); setPPhotos([]); setPBall(null);
    setPortalBkMsg("Request received! We'll text you shortly to confirm your window.");
    setTimeout(() => setPortalBkMsg(""), 6000);
  }

  // ---------- Customer status update (respects their consent toggle) ----------

  function sendTextSmart(to, body) {
    if (settings.msgMaster === false) { setErr("Shop-wide messaging is switched off in Admin."); return false; }
    setTextBox({ open: true, to: to || "", body: body || "" });
    return true;
  }
  function bookingText(bk, kind) {
    const body = kind === "otw"
      ? `${BRAND.name}: ${bk.tech || "Your technician"} is on the way now for your ${bk.vehicle || "service"}. Questions? ${BRAND.phone}. Reply STOP to opt out.`
      : kind === "started"
      ? `${BRAND.name}: we're on your ${bk.vehicle || "vehicle"} now. We'll let you know as soon as it's done. Questions? ${BRAND.phone}. Reply STOP to opt out.`
      : `${BRAND.name} reminder: your service is scheduled ${bk.date}${bk.time ? " at " + bk.time : ""}. Reply C to confirm or call ${BRAND.phone} to change. Reply STOP to opt out.`;
    sendTextSmart(bk.phone || "", body);
  }

  function sendUpdate() {
    if (meta.customer.notify === false) { setErr("This customer opted out of updates — flip the toggle only if they've re-consented."); return; }
    const msg = `Update from ${BRAND.name} on your ${vehicle.ymm || "vehicle"} (${meta.number}): status ${meta.status}. Total ${money(totals.grand)}. Questions? ${BRAND.phone}. Reply STOP to opt out.`;
    sendTextSmart(meta.customer.phone || "", msg);
  }

  // ---------- Tech location sharing (strictly opt-in, work-hours, revocable) ----------
  const [sharingLoc, setSharingLoc] = useState(false);
  const locWatch = useRef(null);
  const [locList, setLocList] = useState([]);
  const [locConsentOpen, setLocConsentOpen] = useState(false);
  function startLoc() {
    if (!currentTech) return;
    if (!navigator.geolocation) { setErr("Location isn't available in this browser."); return; }
    setLocConsentOpen(true); // approval happens on the in-app consent page
  }
  function approveLocShare() {
    setLocConsentOpen(false);
    store.set("consent:loc:" + currentTech.name, { tech: currentTech.name, approvedAt: new Date().toISOString() }); // consent on record
    setSharingLoc(true);
    locWatch.current = navigator.geolocation.watchPosition((p) => {
      store.set("locations:" + currentTech.name, { tech: currentTech.name, lat: p.coords.latitude, lng: p.coords.longitude, ts: new Date().toISOString() });
    }, () => { setErr("Couldn't get GPS — check location permissions."); setSharingLoc(false); }, { enableHighAccuracy: true, maximumAge: 15000 });
  }
  function stopLoc() { if (locWatch.current != null && navigator.geolocation) navigator.geolocation.clearWatch(locWatch.current); locWatch.current = null; setSharingLoc(false); }
  async function refreshLocs() {
    const listing = await store.list("locations:");
    const out = [];
    if (listing && listing.keys) for (const k of listing.keys) { const r = await store.get(k); if (r) { try { out.push(JSON.parse(r.value)); } catch (e) {} } }
    out.sort((x, y) => (y.ts || "").localeCompare(x.ts || ""));
    setLocList(out);
  }

  // ---------- Bookings (your own Setmore-style board) ----------
  const [bookings, setBookings] = useState([]);
  const [bkForm, setBkForm] = useState({ name: "", phone: "", vehicle: "", vin: "", date: todayStr(), time: "", tech: "", notes: "", status: "Scheduled" });
  const [bkVinBusy, setBkVinBusy] = useState(false);
  async function decodeVinForBooking() {
    const vin = (bkForm.vin || "").trim();
    if (vin.length < 11) { setErr("Enter the full 17-character VIN first."); return; }
    setBkVinBusy(true); setErr("");
    try {
      const res = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(vin)}?format=json`);
      const data = await res.json();
      const r = (data.Results && data.Results[0]) || {};
      const ymm = [r.ModelYear, r.Make, r.Model, r.Trim].filter(Boolean).join(" ");
      if (ymm) setBkForm((f) => ({ ...f, vehicle: ymm }));
      else setErr("VIN decoded but returned no vehicle details — double-check the VIN.");
    } catch (e) {
      setErr("VIN decoder unreachable — works on your deployed site.");
    }
    setBkVinBusy(false);
  }
  useEffect(() => { if (tab === "Bookings") loadBookings(); }, [tab]);
  async function loadBookings() {
    const listing = await store.list("bookings:");
    const out = [];
    if (listing && listing.keys) for (const k of listing.keys) { const r = await store.get(k); if (r) { try { out.push({ key: k, ...JSON.parse(r.value) }); } catch (e) {} } }
    out.sort((x, y) => ((x.date || "") + (x.time || "")).localeCompare((y.date || "") + (y.time || "")));
    setBookings(out);
  }
  // ---- Shop approval registry. Genuinely real when Supabase is configured:
  // a new shop writes a "pending" record to a shared table and can't use the
  // shop tools until the platform owner approves it. Without Supabase there
  // is no shared registry to check (each install is an isolated browser),
  // so a solo install is simply approved - which is the correct behavior for
  // a one-shop deployment, not a bypass.
  const [pendingShops, setPendingShops] = useState([]);
  const [shopGateChecked, setShopGateChecked] = useState(false);
  async function registerShopForApproval(shopName, ownerEmail) {
    if (!supabase) return "approved"; // no shared registry without Supabase - solo install
    try {
      const id = settings.shopId || ("PM-" + Math.floor(1000 + Math.random() * 9000));
      await supabase.from("shops").upsert({ shop_id: id, shop_name: shopName || "", owner_email: ownerEmail || "", status: "pending", requested_at: new Date().toISOString() });
      return "pending";
    } catch (e) { return "pending"; }
  }
  async function checkShopApproval() {
    if (!supabase || !settings.shopId) { setShopGateChecked(true); return; }
    try {
      const { data } = await supabase.from("shops").select("status").eq("shop_id", settings.shopId).maybeSingle();
      if (data && data.status) setSettings((s) => ({ ...s, shopApprovalStatus: data.status }));
    } catch (e) {}
    setShopGateChecked(true);
  }
  async function loadPendingShops() {
    if (!supabase) { setPendingShops([]); return; }
    try {
      const { data } = await supabase.from("shops").select("*").eq("status", "pending");
      setPendingShops(data || []);
    } catch (e) { setPendingShops([]); }
  }
  async function setShopStatus(shopId, status) {
    if (!supabase) return;
    try {
      await supabase.from("shops").update({ status }).eq("shop_id", shopId);
      loadPendingShops();
      setErr(`Shop ${shopId} ${status}.`); setTimeout(() => setErr(""), 3000);
    } catch (e) { setErr("Couldn't update that shop."); }
  }
  useEffect(() => { checkShopApproval(); }, [settings.shopId]);

  // Roles offered are gated by what this shop actually has switched on -
  // no point assigning someone "Inspector" at a shop with Inspections off.
  // A shop with every feature enabled (yours) sees the full list.
  function availableRoles() {
    const f = settings.features || {};
    const roles = ["Owner", "Manager", "Technician", "Diesel Technician", "Small Engine Technician", "Apprentice", "Independent Contractor"];
    if (f.bookings !== false) roles.push("Service Advisor");
    if (f.inspection !== false) roles.push("Inspector");
    if (f.parts !== false) roles.push("Parts Manager");
    if (f.community !== false || f.custCommunity !== false) roles.push("Community Manager");
    return roles;
  }
  // Sequential shop-scoped employee ID: PM-1234-T03. Ties a person to this
  // shop, stays stable if they change their name or email later.
  function nextEmployeeId() {
    const base = settings.shopId || "PM-0000";
    const used = techs.map((t) => parseInt((t.empId || "").split("-T")[1] || "0", 10)).filter((n) => !isNaN(n));
    const next = (used.length ? Math.max(...used) : 0) + 1;
    return base + "-T" + String(next).padStart(2, "0");
  }
  async function addTechnician() {
    const email = (newTech.email || "").trim().toLowerCase();
    if (!newTech.name.trim()) { setErr("Enter the technician's name."); return; }
    if (!email.includes("@") || email.indexOf("@") === 0) { setErr("A real email is required — it's how they get their login and reset their own password."); return; }
    const uname = email.split("@")[0].replace(/[^a-z0-9._-]/g, "");
    if (techs.some((t) => (t.username || "").toLowerCase() === uname)) { setErr(`Username "${uname}" is already taken at this shop — use a different email.`); return; }
    const tempPass = String(Math.floor(100000 + Math.random() * 900000));
    const empId = nextEmployeeId();
    const rec = { name: newTech.name.trim(), username: uname, pin: tempPass, email, empId, role: newTech.role || "Technician", title: newTech.title || "", admin: false };
    await saveTechs([...techs, rec]);
    setNewTech({ name: "", pin: "", email: "", role: "Technician", title: "" });
    setErr(`Added ${rec.name} — sending their welcome email…`);
    try {
      const r = await apiFetch("/api/email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        to: email, subject: BRAND.name + " — your login",
        text: `Hi ${rec.name},\n\nYou've been added to the ${BRAND.name} team. Here's what you need:\n\nShop ID: ${settings.shopId || "(see the login screen)"}\nEmployee ID: ${empId}\nUsername: ${uname}\nTemporary password: ${tempPass}\nRole: ${rec.role}${rec.title ? "\nTitle: " + rec.title : ""}\n\nHow to get in:\n1. Open the app and tap "Shop staff login"\n2. Pick your username and enter the temporary password above\n3. Change it right away in Admin under My Account\n\nForgot it later? Tap "Forgot your password?" on the login screen and a new temporary one comes straight to this email — you don't need to wait on anyone.\n\nQuestions: ${BRAND.phone}` }) });
      if (!r.ok) throw new Error("email route");
      setErr(`${rec.name} added. Login details emailed to ${email}.`);
    } catch (e) {
      setErr(`${rec.name} added (ID ${empId}, username ${uname}, temp password ${tempPass}) — the welcome email didn't send, so pass those along yourself.`);
    }
    setTimeout(() => setErr(""), 9000);
  }

  // Capacity-aware slot checking. A slot is only "full" when the number of
  // live bookings on it reaches the number of techs who can actually work it -
  // so a one-man shop is strictly first-come-first-serve, and adding techs
  // genuinely opens up parallel slots instead of an arbitrary limit.
  function techCapacity() { return Math.max(1, techs.length); }
  function bookingsAt(date, time, excludeKey) {
    return bookings.filter((b) => b.key !== excludeKey && (b.date || "") === date && (b.time || "") === time && b.status !== "Cancelled" && b.status !== "Done");
  }
  function slotIsFull(date, time, excludeKey) {
    if (!date || !time) return false; // no time given = not a reservable slot, don't block
    return bookingsAt(date, time, excludeKey).length >= techCapacity();
  }
  // Walks forward from a start date in 30-minute steps inside shop hours and
  // returns the first slot that isn't already at capacity.
  function firstAvailableSlot(fromDate) {
    const startDay = fromDate || todayStr();
    const openHour = 8, closeHour = 18;
    for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
      const d = new Date(startDay + "T00:00:00");
      d.setDate(d.getDate() + dayOffset);
      const dateStr = d.toISOString().slice(0, 10);
      for (let h = openHour; h < closeHour; h++) {
        for (const m of ["00", "30"]) {
          const t = String(h).padStart(2, "0") + ":" + m;
          if (!slotIsFull(dateStr, t)) return { date: dateStr, time: t };
        }
      }
    }
    return null;
  }
  // Real open slots for a given day, so a customer picks from what's actually
  // free instead of typing a time and being told no.
  function openSlotsFor(dateStr) {
    if (!dateStr) return [];
    const out = [];
    for (let h = 8; h < 18; h++) {
      for (const m of ["00", "30"]) {
        const t = String(h).padStart(2, "0") + ":" + m;
        if (!slotIsFull(dateStr, t)) out.push(t);
      }
    }
    return out;
  }
  function prettyTime(t) {
    const [h, m] = t.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    const hr = h % 12 === 0 ? 12 : h % 12;
    return hr + ":" + String(m).padStart(2, "0") + " " + ampm;
  }
  async function saveBooking() {
    if (!bkForm.name && !bkForm.vehicle) { setErr("A booking needs at least a name or a vehicle."); return; }
    if (slotIsFull(bkForm.date, bkForm.time)) {
      const taken = bookingsAt(bkForm.date, bkForm.time).length;
      const next = firstAvailableSlot(bkForm.date);
      setErr(`That slot is already taken (${taken} booked, ${techCapacity()} tech${techCapacity() === 1 ? "" : "s"} available).` + (next ? ` Next open: ${next.date} at ${next.time}.` : ""));
      return;
    }
    await store.set("bookings:" + (bkForm.date || todayStr()) + "-" + Date.now(), bkForm);
    setBkForm({ name: "", phone: "", vehicle: "", vin: "", date: todayStr(), time: "", tech: "", notes: "", status: "Scheduled" });
    setErr("");
    loadBookings();
  }
  async function markDoneAndPromptNext(k) {
    await setBookingStatus(k, "Done");
    const today = todayStr();
    const upcoming = bookings
      .filter((b) => b.key !== k && b.status === "Scheduled" && b.date === today && b.time)
      .sort((a, b) => a.time.localeCompare(b.time));
    if (upcoming.length > 0) bookingText(upcoming[0], "otw");
  }
  async function startJob(k) {
    await setBookingStatus(k, "In Progress");
    const bk = bookings.find((x) => x.key === k);
    if (bk) bookingText(bk, "started");
  }
  async function setBookingStatus(k, status) {
    const bk = bookings.find((x) => x.key === k); if (!bk) return;
    const { key, ...rest } = bk;
    await store.set(k, { ...rest, status });
    if (status === "Scheduled" && settings.emailOnStart !== false && bk.email) {
      const body = `${BRAND.name}: your appointment is confirmed for ${bk.date}${bk.time ? " at " + bk.time : ""} - ${bk.vehicle || "your vehicle"}. Questions? ${BRAND.phone}.`;
      apiFetch("/api/email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to: bk.email, subject: BRAND.name + " - appointment confirmed", text: body }) }).catch(() => {});
    }
    loadBookings();
  }
  async function deleteBooking(k) {
    if (!window.confirm("Delete this booking record? This can't be undone.")) return;
    try { await store.delete(k); } catch (e) {}
    loadBookings();
  }
  function bookingToEstimate(bk) {
    setMeta((m) => ({ ...m, customer: { ...m.customer, name: bk.name || "", phone: bk.phone || "" } }));
    setVehicle((v) => ({ ...v, ymm: bk.vehicle || v.ymm, id: bk.vin || v.id }));
    setTab("Details");
  }

  // ---------- Custom parts catalog (parts money for your parts guy) ----------
  const [myParts, setMyParts] = useState([]);
  const [ptForm, setPtForm] = useState({ desc: "", part: "", source: "", cost: "", price: "" });
  useEffect(() => { if (tab === "Parts") (async () => {
    const r = await store.get("catalog:parts");
    if (r) { try { setMyParts(JSON.parse(r.value)); } catch (e) {} }
  })(); }, [tab]);
  async function addMyPart() {
    if (!ptForm.desc) { setErr("Give the part a description first."); return; }
    const list = [...myParts, ptForm];
    setMyParts(list); await store.set("catalog:parts", list);
    setPtForm({ desc: "", part: "", source: "", cost: "", price: "" });
  }
  async function delMyPart(i) { const list = myParts.filter((_, j) => j !== i); setMyParts(list); await store.set("catalog:parts", list); }
  function partToEstimate(p) {
    setRows((rs) => [...rs, mkRow({ desc: p.desc, part: p.part, supplier: p.source, cost: p.cost, manualPrice: !!p.price, price: p.price || "" })]);
    setErr("Added to Line Items."); setTimeout(() => setErr(""), 2000);
  }

  // ---------- Customer shares THEIR location (one-time, consent by tap) ----------
  function shareMyLocation() {
    if (!navigator.geolocation) { setErr("Location isn't available in this browser."); return; }
    if (!window.confirm("Approve a one-time share of your vehicle's location?\n\nIt's sent only inside the text YOU send us — we never track you.")) return;
    navigator.geolocation.getCurrentPosition((p) => {
      const good = "https://www.google.com/maps?q=" + p.coords.latitude + "," + p.coords.longitude;
      window.location.href = "sms:" + BRAND.phone.replace(/[^0-9+]/g, "") + "?&body=" + encodeURIComponent("Here's my vehicle's location for service: " + good);
    }, () => setErr("Couldn't get your location — check permissions, or text us your address."));
  }

  // ---------- Shop update log: revisions/changes/corrections, in the shop's own words ----------
  const [logType, setLogType] = useState("Revision");
  const [logText, setLogText] = useState("");
  const [shopLog, setShopLog] = useState([]);
  useEffect(() => { if (tab === "Help") (async () => {
    const r = await store.get("shoplog:entries");
    if (r) { try { setShopLog(JSON.parse(r.value)); } catch (e) {} }
  })(); }, [tab]);
  async function addLogEntry() {
    if (!logText.trim()) return;
    const list = [{ type: logType, text: logText.trim(), ts: new Date().toISOString().slice(0, 10), by: currentTech ? currentTech.name : "" }, ...shopLog];
    setShopLog(list); await store.set("shoplog:entries", list); setLogText("");
  }

  // ---------- Floating shop assistant: on every staff screen ----------
  const [botOpen, setBotOpen] = useState(false);
  const [errLog, setErrLog] = useState([]);
  useEffect(() => {
    const h = (msg, src, line) => { setErrLog((l) => [String(msg) + (line ? " @" + line : ""), ...l].slice(0, 5)); return false; };
    const hr = (e) => { setErrLog((l) => [("promise: " + String(e && e.reason ? e.reason : "")).slice(0, 140), ...l].slice(0, 5)); };
    window.onerror = h; window.addEventListener("unhandledrejection", hr);
    return () => { window.onerror = null; window.removeEventListener("unhandledrejection", hr); };
  }, []);
  async function reportProblem() {
    const ownerEmail = ((techs.find((t) => t.admin) || {}).email) || shopEmail();
    const body = "Problem report — " + BRAND.name + "\nBy: " + (currentTech ? currentTech.name : "?") + "\nWhen: " + new Date().toLocaleString() + "\nNote: " + (botQ || "(none)") + "\nRecent errors:\n" + (errLog.join("\n") || "(none logged)");
    try {
      const r = await apiFetch("/api/email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to: ownerEmail, subject: "Peaceful OS problem report — " + BRAND.name, html: "<pre>" + body.replace(/</g, "&lt;") + "</pre>" }) });
      if (!r.ok) throw new Error("route");
      setBotA("Report sent to the owner's email ✓ — errors included automatically.");
    } catch (e) {
      window.location.href = "mailto:" + ownerEmail + "?subject=" + encodeURIComponent("Peaceful OS problem report") + "&body=" + encodeURIComponent(body);
    }
  }
  const [botMode, setBotMode] = useState("mech");
  const [botQ, setBotQ] = useState("");
  const [botA, setBotA] = useState("");
  const [botBusy, setBotBusy] = useState(false);
  // Offline answers for the service writer bot - these work with no internet,
  // which matters when someone new is standing in front of a customer.
  const WRITER_FAQ = [
    ["brake", "Plain words that work: 'The pads are the part that squeezes to stop you, and yours are worn down to the metal. That's why you're hearing it. Driving on it much longer starts damaging the rotor underneath, which turns a smaller job into a bigger one.'"],
    ["why so", "Never get defensive about price. Try: 'I hear you. Let me show you exactly what you're paying for - here's the part cost, here's the time it takes, and here's what happens if we wait on it. If you'd rather do it in stages, I can tell you what's safe to hold off on.'"],
    ["decline", "Write it down, stay respectful: 'Totally your call. I'll note that we recommended it and you'd like to wait. If anything changes - new noise, warning light, anything feels different - call me before you drive far on it.'"],
    ["explain", "Rule of thumb: name the part, say what it does in everyday words, then say what happens if it's ignored. 'The water pump is what moves coolant through the engine. When it fails the engine overheats, and an overheated engine is a much more expensive problem.'"],
    ["estimate", "Say plainly: 'This is an estimate, not a final bill. If I open it up and find something different, I stop and call you before I do any extra work. You'll never get a surprise on the invoice.'"],
    ["wait", "Be honest about urgency tiers: 'Safety items I'd do today - brakes, steering, tires. This one is a keep-an-eye-on-it. I'd plan for it in the next few months, but you're not unsafe driving home.'"],
    ["upsell", "Don't. Recommend what you found, rank it by safety, and let them choose. 'Here's what I found. These two are safety. This one can wait. You tell me how you want to handle it.'"],
    ["late", "Own it early: 'I want to give you a heads up - the part came in wrong and I'm waiting on the right one. I'd rather tell you now than have you wondering. New time is ___.'"],
  ];
  const BOT_FAQ = [
    ["vin", "Type the VIN and tap VIN→ to decode, or tap the camera button to scan the door-jamb barcode (best in Chrome on Android)."],
    ["sign", "Customer View → Authorize & sign. Finger-drawn, typed fallback one tap. Admin can require it before work starts."],
    ["invoice", "Invoice auto-fills from approved lines. Send by email, Collect payment, mark PAID, then Request a review."],
    ["book", "Bookings tab. Online requests arrive as amber NEW REQUEST cards — tap ✓ Confirm. Walk-ins go in the form at the top."],
    ["price", "Line Items: cost + markup computes the customer price. ZIP rules and your default markup apply automatically."],
    ["photo", "Photo Estimate: shoot it, Analyze, then approve only the lines you agree with — nothing hits the quote until you do."],
    ["pin", "Forgot PIN? Link on the login screen emails a temporary PIN (deployed site), or the owner resets it on Admin."],
    ["backup", "Dashboard → Backup everything. Before changes and monthly into your Legal folder."],
    ["location", "Location sharing is opt-in on the bar under the tabs, work hours only, one tap to stop."],
    ["text", "Only text customers whose consent box is checked — that toggle is your legal consent record."],
  ];
  const LEGAL_FAQ = [
    ["text", "Text customers only when their consent box is checked; every message honors STOP the moment it arrives; the Admin master switch can silence the shop but can never override a customer opt-out."],
    ["consent", "Consent lives on the record: customer text opt-in is the checkbox on the estimate; tech GPS requires the recorded in-app approval; portal bookings capture messaging consent in the form."],
    ["sign", "Signature before wrenches turn — the finger-drawn authorization on Customer View. Extra work found mid-job stops until the supplement is approved in writing."],
    ["warranty", "The written 12-month/12,000-mile warranty statement lives in Business Shield (Admin) — post it, hand it out, and let the invoice reference it."],
    ["location", "Tech location is opt-in with a recorded approval, work hours only, one tap to stop, short retention. Customer location is one-time and customer-initiated only."],
    ["disclosure", "Every estimate and invoice carries the authorization, replaced-parts, and supplement disclosure lines for MO/IL-style compliance — your attorney confirms the final wording."],
    ["claim", "Warranty/insurance jobs: authorization number BEFORE repairs, cause-and-correction photos, the claim checklist in Business Shield, and the customer signs for any non-covered balance."],
    ["data", "The shop owns its data — export everything any day from Dashboard. Card numbers never touch this system; payments run through the processors' secure pages."],
    ["contract", "Signed estimates + invoices are your written record. The subscriber terms, ToS, and privacy policy drafts exist — an attorney pass makes them final before public use."],
    ["fine", "The fine-avoidance rules: no text without the checked box, honor STOP same-day, signature before work, keep the signed papers in the Legal folder. The app gates the first two automatically."],
    ["inspection", "Inspection tab: pick a tier (1-3), check off each item good/attention/fail with an optional note, then print or email the report — it uses the customer and vehicle already on Details."],
    ["shopid", "Your Shop ID is on the login screen and in Admin under Account & Access — it identifies this shop if you ever run more than one, or move to the cloud tier."],
    ["password", "Passwords replaced bare PINs — same reset flow: 'Forgot your password?' on the login screen emails a temporary one, or the owner resets it on the roster in Admin."],
    ["username", "Each person on the roster has a username (auto-filled from their name, editable) plus their password — set both on the Technician Logins card in Admin."],
    ["servicearea", "Service Areas (Admin, under Pricing Tools) tag jobs by city with a color, so the Bookings board reads like a map at a glance — add or remove areas anytime."],
    ["supplyfee", "Shop Supply Fee (Admin) is off by default. Set a rate and cap, then use the 'Apply shop fee' button next to Supplies on the Photo Estimate tab — it never applies on its own."],
    ["laborrate", "Labor Rates (Admin) holds every named rate — Standard, Diesel, Small Engine, After-Hours. Add or edit any of them; the Photo Estimate tab picks up whatever you set as Standard by default."],
    ["discount", "Discount Policy (Admin) states your labor and parts discount caps in writing — it prints as policy on estimates. There's no discount field to enforce yet; this is the honest, stated version."],
    ["source", "Customer Source (Admin) is a tag list — pick one per customer on Details so you always know which outreach actually brought the job in."],
    ["connectedtools", "Connected Tools (Admin) lists what's really wired up today — PartsTech, RepairLink, Stripe, Resend, Telnyx, CARFAX — and what isn't yet. No feature gets listed there before it's real."],
  ];
  async function askBot() {
    const q = botQ.trim().toLowerCase();
    if (!q) return;
    const hit = (botMode === "legal" ? LEGAL_FAQ : botMode === "writer" ? WRITER_FAQ : BOT_FAQ).find(([k]) => q.includes(k));
    if (hit) { setBotA(hit[1]); return; }
    setBotBusy(true); setBotA("");
    try {
      const r = await apiFetch("/api/claude", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: [{ role: "user", content: (botMode === "writer"
          ? "You are the service writer's helper at an auto repair shop. Your job is the CUSTOMER-FACING words, not the diagnosis. Given a repair situation, write plain, warm, non-technical language a customer with zero car knowledge would understand: what's wrong in everyday terms, why it matters (safety first, then cost of waiting), what happens if they decline, and a clear next step. Never use jargon without explaining it in the same sentence. Never pressure or scare - explain and let them decide. Keep it to 2-5 sentences, no markdown, sound like a real person who respects them. Question: "
          : botMode === "legal"
          ? "You are the in-app compliance helper for an auto-repair shop platform. Explain, in 2-4 plain sentences with no markdown, how this platform practices handle the question (consent-gated texting with STOP, signature-before-work authorization, recorded GPS consent, written 12/12 warranty statement, MO/IL disclosure lines on documents, data export, processor-hosted payments). Always end with: this is general information, not legal advice — the shop attorney decides. Question: "
          : (settings.assistantPro !== false
          ? "You are Master Elite — the platform's highest assistant tier, counsel worthy of master technicians and multi-bay owners. Answer with master-level depth across drivability, electrical, diesel, estimating, warranty documentation, and service-writing: correct terminology, diagnostic strategy (verify the complaint, gather data, isolate the system, test before replacing parts), estimate and labor best practice, and honest customer-communication advice. Automotive Service Excellence standards inform your answers, but you are software guidance — not a certified technician, and never a substitute for verified specs or licensed labor guides. Tabs: Details, Bookings, Photo Estimate, Line Items, Parts, Customer View, Invoice, Media, Guides, Community, Integrations, Dashboard, Admin, Help. Keep it to 2-5 tight sentences, no markdown. Question: "
          : "You are the in-app helper for a shop estimating app. Answer this staff question in 2-3 plain sentences, no markdown: ")) + botQ }] }) });
      if (!r.ok) throw new Error("route");
      const d = await r.json();
      const txt = (d.content || []).map((c) => c.text || "").join(" ").trim();
      setBotA(txt || "Try the Help tab — the full walkthrough lives there.");
    } catch (e) {
      setBotA("Quick answers work offline — try words like vin, sign, invoice, book, price, photo, pin, backup, location, text. Full answers switch on once the app is deployed.");
    }
    setBotBusy(false);
  }

  // ---------- Community: crew feed + parts swap ----------
  const [feedText, setFeedText] = useState("");
  const [feedMediaUrl, setFeedMediaUrl] = useState("");
  const [feedMediaBusy, setFeedMediaBusy] = useState(false);
  async function uploadFeedMedia(e) {
    const file = e.target.files && e.target.files[0]; e.target.value = "";
    if (!file) return;
    setFeedMediaBusy(true); setErr("");
    try {
      const res = await apiFetch("/api/media", { method: "POST", headers: { "Content-Type": file.type }, body: file });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setFeedMediaUrl(data.url || "");
      setErr(data.url ? "Attached." : "Uploaded, but no public URL is configured yet — ask the owner to set MEDIA_PUBLIC_URL.");
    } catch (e2) {
      setErr(e2.message || "Couldn't upload that file.");
    }
    setFeedMediaBusy(false); setTimeout(() => setErr(""), 4000);
  }
  const [feed, setFeed] = useState([]);
  const [swap, setSwap] = useState([]);
  const [swapForm, setSwapForm] = useState({ kind: "SELL", part: "", price: "", cond: "", contact: "" });
  useEffect(() => { if (tab === "Community") (async () => {
    const f = await store.get("forum:posts"); if (f) { try { setFeed(JSON.parse(f.value)); } catch (e) {} }
    const w = await store.get("swap:listings"); if (w) { try { setSwap(JSON.parse(w.value)); } catch (e) {} }
  })(); }, [tab]);
  async function postFeed() {
    if (!feedText.trim() && !feedMediaUrl) return;
    const list = [{ by: currentTech ? currentTech.name : "Tech", text: feedText.trim(), media: feedMediaUrl || "", ts: new Date().toISOString().slice(0, 16).replace("T", " ") }, ...feed].slice(0, 200);
    setFeed(list); await store.set("forum:posts", list); setFeedText(""); setFeedMediaUrl("");
  }
  async function postSwap() {
    if (!swapForm.part.trim()) { setErr("Name the part first."); return; }
    const list = [{ ...swapForm, by: currentTech ? currentTech.name : "Tech", ts: new Date().toISOString().slice(0, 10) }, ...swap].slice(0, 200);
    setSwap(list); await store.set("swap:listings", list); setSwapForm({ kind: "SELL", part: "", price: "", cond: "", contact: "" });
  }
  async function delSwap(i) { const list = swap.filter((_, j) => j !== i); setSwap(list); await store.set("swap:listings", list); }

  // ---------- Academy progress ----------
  const [acadDone, setAcadDone] = useState({});
  useEffect(() => { if (tab === "Academy") (async () => { const r = await store.get("academy:progress"); if (r) { try { setAcadDone(JSON.parse(r.value)); } catch (e) {} } })(); }, [tab]);
  async function markModule(i) {
    if (!currentTech) return;
    const key = currentTech.name + ":" + i;
    const next = { ...acadDone };
    if (next[key]) delete next[key]; else next[key] = new Date().toISOString().slice(0, 10);
    setAcadDone(next); await store.set("academy:progress", next);
  }
  // ASE study-track progress — same storage, distinct key shape ("name:ase:i")
  // so it can never collide with the shop-conduct module indexes above.
  async function markAseModule(i) {
    if (!currentTech) return;
    const key = currentTech.name + ":ase:" + i;
    const next = { ...acadDone };
    if (next[key]) delete next[key]; else next[key] = new Date().toISOString().slice(0, 10);
    setAcadDone(next); await store.set("academy:progress", next);
  }

  // ---------- Peacefully Accurate: the shop's own confirmed-fix library ----------
// Example starter entries so the library isn't empty on day one - original, general
// patterns, not from any real customer file or copied guide. Replace/grow with your
// own real confirmed jobs; these are just here to show the shape.
const FIXES_SEED = [
  { ymm: "Example — any 2013-2018 compact SUV, 2.0-2.5L", engine: "4-cyl gas", complaint: "Check engine light, no drivability complaint", cause: "Small EVAP leak, often the gas cap or a cracked purge line", correction: "Replaced gas cap or purge line as found, cleared code, monitored 2 drive cycles", hours: "0.7", parts: "Gas cap or EVAP purge line", confirms: 1 },
  { ymm: "Example — any V6 minivan/crossover, 2010+", engine: "V6 gas", complaint: "Rough idle, especially cold", cause: "Vacuum leak at intake manifold gasket or a disconnected PCV hose", correction: "Traced with smoke test, replaced gasket/hose, idle smoothed immediately", hours: "1.3", parts: "Intake gasket or PCV hose", confirms: 1 },
  { ymm: "Example — any pickup, gas V8, 2009+", engine: "V8 gas", complaint: "Battery dead by morning, alternator tests fine", cause: "Aftermarket accessory (amp, light bar) wired to a always-hot circuit with no relay", correction: "Rewired through a switched/relayed circuit, parasitic draw dropped to normal", hours: "1.0", parts: "Relay, inline fuse", confirms: 1 },
  { ymm: "Example — any diesel 3/4-1 ton pickup, 2011+", engine: "Diesel", complaint: "Reduced power mode, DPF light on", cause: "Short-trip driving pattern never reaching regen temperature", correction: "Forced regen performed, advised customer on highway drive cadence to prevent recurrence", hours: "0.8", parts: "None — service procedure", confirms: 1 },
  { ymm: "Example — any push mower, 4-stroke", engine: "Small engine", complaint: "Won't start, sat all winter with fuel in tank", cause: "Stale fuel gummed the carburetor jet", correction: "Drained tank, cleaned carb, fresh fuel, started on second pull", hours: "0.8", parts: "Carb cleaner, fresh fuel/oil", confirms: 1 },
  { ymm: "Example — any sedan, 2015+", engine: "4-cyl gas", complaint: "Squeak from front end over bumps", cause: "Dry/worn sway bar end link bushing", correction: "Replaced end link, squeak gone on test drive", hours: "0.6", parts: "Sway bar end link", confirms: 1 },
  { ymm: "Example — any hybrid crossover, 2016+", engine: "Hybrid", complaint: "Reduced fuel economy, hybrid battery light intermittent", cause: "Cooling fan for the hybrid battery pack clogged with debris", correction: "Cleaned intake vent and fan, light cleared, economy back to normal", hours: "0.9", parts: "None — cleaning only", confirms: 1 },
  { ymm: "Example — any pickup, 2012+", engine: "V8 gas", complaint: "Clunk when shifting from park to drive", cause: "Worn transmission mount allowing excess driveline movement", correction: "Replaced mount, clunk gone", hours: "1.4", parts: "Transmission mount", confirms: 1 },
  { ymm: "Example — any compact SUV, 2017+", engine: "4-cyl gas", complaint: "AC blows warm on driver side only", cause: "Blend door actuator failed, stuck on one setting", correction: "Replaced actuator behind dash, both sides now match", hours: "1.6", parts: "Blend door actuator", confirms: 1 },
  { ymm: "Example — any minivan, 2015+", engine: "V6 gas", complaint: "Sliding door won't open with power button", cause: "Door cable stretched/frayed at the pulley", correction: "Replaced cable assembly, power operation restored", hours: "1.8", parts: "Sliding door cable", confirms: 1 },
  { ymm: "Example — any diesel pickup, 2013+", engine: "Diesel", complaint: "Hard start on cold mornings only", cause: "Weak glow plug relay not cycling full time", correction: "Replaced relay, cold starts back to normal", hours: "0.7", parts: "Glow plug relay", confirms: 1 },
  { ymm: "Example — any sedan, 2010+", engine: "4-cyl gas", complaint: "Musty smell from vents on startup", cause: "Cabin air filter overdue, mold growth on evaporator", correction: "Replaced filter, treated evaporator core with approved cleaner", hours: "0.5", parts: "Cabin air filter, evaporator treatment", confirms: 1 },
  { ymm: "Example — any truck, 2014+", engine: "V6/V8 gas", complaint: "Bed light stays on, drains battery", cause: "Tailgate switch stuck closed from corrosion", correction: "Cleaned/replaced switch, verified light shuts off with tailgate closed", hours: "0.5", parts: "Tailgate light switch", confirms: 1 },
  { ymm: "Example — any small SUV, 2018+", engine: "4-cyl gas", complaint: "Steering wheel vibrates at highway speed", cause: "Front tires out of balance after recent rotation", correction: "Rebalanced all four, vibration resolved", hours: "0.5", parts: "None — balance service", confirms: 1 },
  { ymm: "Example — any mower, riding", engine: "Small engine", complaint: "Deck belt keeps jumping off", cause: "Worn deck belt keeper/guide bent out of position", correction: "Adjusted guide, replaced belt, verified tracking through several cycles", hours: "1.0", parts: "Deck belt, guide adjustment", confirms: 1 },
  { ymm: "Example — any sedan, 2013+", engine: "4-cyl gas", complaint: "Trunk won't latch closed", cause: "Trunk latch striker misaligned after light rear impact", correction: "Realigned striker plate, latch closes securely", hours: "0.4", parts: "None — adjustment only", confirms: 1 },
  { ymm: "Example — any pickup, 2015+", engine: "V8 gas", complaint: "Whining noise from front end at speed", cause: "Wheel bearing wear, noise changes with steering input", correction: "Replaced hub assembly, noise gone on road test", hours: "1.3", parts: "Wheel hub assembly", confirms: 1 },
  { ymm: "Example — any crossover, 2016+", engine: "4-cyl gas", complaint: "Check engine light, code points to evap system", cause: "EVAP purge valve stuck open", correction: "Replaced purge valve, monitored two drive cycles clean", hours: "0.8", parts: "EVAP purge valve", confirms: 1 },
  { ymm: "Example — any small engine, chainsaw", engine: "Small engine", complaint: "Bogs down under load, runs fine at idle", cause: "Carburetor diaphragm worn, lean under load", correction: "Rebuilt carburetor, tested cutting under load", hours: "0.9", parts: "Carburetor rebuild kit", confirms: 1 },
  { ymm: "Example — any sedan, 2017+", engine: "4-cyl gas", complaint: "Backup camera image is dark/grainy", cause: "Camera lens fogged from a cracked housing seal", correction: "Replaced camera assembly, resealed housing", hours: "0.7", parts: "Backup camera assembly", confirms: 1 },
  { ymm: "Example — any diesel pickup, 2015+", engine: "Diesel", complaint: "Fuel smell in cabin", cause: "Small fuel line leak at a fitting under the hood", correction: "Retorqued/replaced fitting and line section, no leak found after test", hours: "1.2", parts: "Fuel line fitting", confirms: 1 },
  { ymm: "Example — any SUV, 2014+", engine: "V6 gas", complaint: "Rear hatch struts won't hold it open", cause: "Gas struts lost pressure with age", correction: "Replaced both struts, hatch holds firmly", hours: "0.5", parts: "Hatch struts (pair)", confirms: 1 },
  { ymm: "Example — any compact car, 2016+", engine: "4-cyl gas", complaint: "Grinding noise when braking, worse in reverse", cause: "Rear pads worn to metal, contacting rotor", correction: "Replaced pads and resurfaced/replaced rotors as needed", hours: "1.1", parts: "Rear pads, rotors", confirms: 1 },
  { ymm: "Example — any pickup, 2012+", engine: "V8 gas", complaint: "Won't shift out of 4WD", cause: "Transfer case shift motor not engaging fully", correction: "Replaced shift motor, verified full range of engagement", hours: "1.5", parts: "Transfer case shift motor", confirms: 1 },
  { ymm: "Example — any hatchback, 2018+", engine: "4-cyl gas", complaint: "Won't hold idle, dies at stops", cause: "Idle air control valve carboned up", correction: "Cleaned/replaced IAC valve, idle stabilized", hours: "0.7", parts: "IAC valve or cleaning", confirms: 1 },
  { ymm: "Example — any SUV, 2013+", engine: "V6 gas", complaint: "Sunroof stuck open, won't close", cause: "Sunroof motor gear stripped from debris in the track", correction: "Cleared track, replaced motor gear assembly, cycled sunroof through full range", hours: "1.1", parts: "Sunroof motor/gear assembly", confirms: 1 },
];
  const [fixes, setFixes] = useState(FIXES_SEED);
  const [fixQ, setFixQ] = useState("");
  const [fixDraft, setFixDraft] = useState(null);
  const [carfaxQ, setCarfaxQ] = useState([]);
  useEffect(() => { if (tab === "Fixes & Times") (async () => {
    const r = await store.get("fixes:library"); if (r) { try { setFixes(JSON.parse(r.value)); } catch (e) {} }
    const c = await store.get("carfax:queue"); if (c) { try { setCarfaxQ(JSON.parse(c.value)); } catch (e) {} }
  })(); }, [tab]);
  // ---------- Assistant tools: supplement drafts + customer explanations ----------
  // Both produce EDITABLE TEXT the owner reviews and sends — the assistant
  // recommends and explains; the human decides. Nothing auto-sends.
  const [asstText, setAsstText] = useState("");
  const [asstBusy, setAsstBusy] = useState(false);
  const [asstKind, setAsstKind] = useState("");
  async function draftSupplement() {
    setAsstBusy(true); setAsstKind("supplement"); setAsstText("");
    try {
      const lines = rows.filter((r) => r.desc).map((r) => `${r.desc} — ${num(r.hrs)} hr${r.teardown ? " (teardown to confirm)" : ""}${r.note ? " | " + r.note : ""}`).join("\n");
      const t = await callClaude([{ type: "text", text: `You are a shop assistant drafting an INSURANCE SUPPLEMENT REQUEST for the estimator to review and edit. Vehicle: ${vehicle.ymm || "-"}. Claim: ${meta.insurance.claim || "-"} (${meta.insurance.company || "-"}). Original estimate #${meta.number}. Lines found during teardown/repair:\n${lines}\nWrite a professional supplement request: what was found, why each operation is required (cite the mechanical reason, not a manual), parts/labor implications, and a request for authorization. Plain prose, no prices (the estimator adds them), no invented facts. Under 250 words.` }]);
      setAsstText(t);
    } catch (e) { setAsstText("Couldn't draft — try again."); }
    setAsstBusy(false);
  }
  async function draftCustomerExplainer() {
    setAsstBusy(true); setAsstKind("customer"); setAsstText("");
    try {
      const lines = rows.filter((r) => r.desc).map((r) => `${r.desc} — ${num(r.hrs)} hr`).join("\n");
      const t = await callClaude([{ type: "text", text: `You are a shop assistant helping explain a repair estimate to a customer in plain, friendly, honest language a non-mechanic understands. Vehicle: ${vehicle.ymm || "their vehicle"}. Complaint: ${complaint || "-"}. Work:\n${lines}\nExplain what's wrong, why each repair matters for safety/reliability, and what happens if it waits — without scare tactics, without prices, without jargon. The estimator will review and edit before sending. Under 200 words.` }]);
      setAsstText(t);
    } catch (e) { setAsstText("Couldn't draft — try again."); }
    setAsstBusy(false);
  }
  // Send the estimate to the customer so THEY can approve it from their phone.
  // They open the portal, find it by their phone number, type their name and
  // tap Approve — that approval writes straight back onto the estimate.
  const [sendApprovalMsg, setSendApprovalMsg] = useState("");
  async function sendForApproval() {
    const phone = (meta.customer.phone || "").replace(/\D/g, "");
    const email = meta.customer.email || "";
    if (!phone && !email) { setSendApprovalMsg("Add the customer's phone or email on Details first."); return; }
    await saveEstimate();
    const link = (settings.portalLink || (typeof window !== "undefined" ? window.location.origin : "")) || "";
    const body = `Peaceful Motors — estimate ${meta.number} for your ${vehicle.ymm || "vehicle"} is ready: ${money(totals.grand)}. Review and approve it here: ${link} — look it up with this phone number, then tap Approve. Questions: 314-919-7456.`;
    let sent = [];
    if (phone) { try { const r = await apiFetch("/api/sms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to: phone, text: body }) }); if (r.ok) sent.push("text"); } catch (e) {} }
    if (email) { try { const r = await apiFetch("/api/email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to: email, subject: `Estimate ${meta.number} — approve to schedule`, text: body + "\n\n" + customerText() }) }); if (r.ok) sent.push("email"); } catch (e) {} }
    setSendApprovalMsg(sent.length ? "Sent by " + sent.join(" and ") + ". You'll see it marked Approved here when they sign." : "Couldn't send — check the Telnyx/Resend keys, or hand them the tablet to sign in person.");
    setTimeout(() => setSendApprovalMsg(""), 6000);
  }
  function draftFixFromJob() {
    const corr = rows.filter((r) => r.desc).map((r) => r.desc).join("; ");
    const hrs = rows.reduce((a2, r) => a2 + (parseFloat(r.hours) || 0), 0);
    setFixDraft({ ymm: vehicle.ymm || "", engine: "", complaint: (meta && meta.diagnosis) || "", cause: "", correction: corr, hours: hrs ? String(hrs) : "", parts: "" });
    setTab("Fixes & Times");
  }
  async function publishFix() {
    if (!fixDraft || !fixDraft.ymm.trim() || !fixDraft.correction.trim()) { setErr("A fix needs at least the vehicle and the correction."); return; }
    const entry = { ...fixDraft, by: currentTech ? currentTech.name : "Tech", shop: BRAND.name, ts: new Date().toISOString().slice(0, 10), confirms: 1 };
    const list = [entry, ...fixes].slice(0, 500);
    setFixes(list); await store.set("fixes:library", list); setFixDraft(null);
    setErr("Confirmed fix published — the library just got smarter."); setTimeout(() => setErr(""), 2500);
  }
  async function confirmFix(i) { const list = fixes.map((f, j) => j === i ? { ...f, confirms: (f.confirms || 1) + 1 } : f); setFixes(list); await store.set("fixes:library", list); }
  async function queueCarfax() {
    const entry = { ts: new Date().toISOString().slice(0, 10), ymm: vehicle.ymm || "", vin: vehicle.id || "", miles: vehicle.use || "", services: rows.filter((r) => r.desc).map((r) => r.desc).slice(0, 6).join("; ") };
    const r = await store.get("carfax:queue"); let list = [];
    if (r) { try { list = JSON.parse(r.value); } catch (e) {} }
    list = [entry, ...list].slice(0, 300);
    await store.set("carfax:queue", list); setCarfaxQ(list);
    setErr("Queued for CARFAX reporting ✓"); setTimeout(() => setErr(""), 2500);
  }

  // ---------- Peaceful Times: real-world labor guide ----------
  const [timesG, setTimesG] = useState([]);
  const [timeQ, setTimeQ] = useState("");
  const [timeForm, setTimeForm] = useState({ job: "", veh: "", hours: "" });
  useEffect(() => { if (tab === "Fixes & Times") (async () => { const r = await store.get("times:guide"); if (r) { try { setTimesG(JSON.parse(r.value)); } catch (e) {} } })(); }, [tab]);
  async function saveTimes(list) { setTimesG(list); await store.set("times:guide", list); }
  async function addTimeEntry() {
    if (!timeForm.job.trim() || !(parseFloat(timeForm.hours) > 0)) { setErr("A time entry needs the job and the hours."); return; }
    await saveTimes([{ job: timeForm.job.trim(), veh: timeForm.veh.trim(), hours: String(parseFloat(timeForm.hours)), by: currentTech ? currentTech.name : "Tech", ts: new Date().toISOString().slice(0, 10) }, ...timesG].slice(0, 1000));
    setTimeForm({ job: "", veh: "", hours: "" });
  }
  async function logJobTimes() {
    const entries = rows.filter((r) => r.desc && parseFloat(r.hours) > 0).map((r) => ({ job: r.desc, veh: vehicle.ymm || "", hours: String(parseFloat(r.hours)), by: currentTech ? currentTech.name : "Tech", ts: new Date().toISOString().slice(0, 10) }));
    if (!entries.length) { setErr("No labor lines with hours on this job."); return; }
    const r = await store.get("times:guide"); let list = [];
    if (r) { try { list = JSON.parse(r.value); } catch (e) {} }
    await saveTimes([...entries, ...list].slice(0, 1000));
    setErr(entries.length + " time entr" + (entries.length === 1 ? "y" : "ies") + " logged to the guide ✓"); setTimeout(() => setErr(""), 2500);
  }
  async function loadTimeSamples() {
    const S = [["Front brake pads & rotors", "SAMPLE sedan", "1.4"], ["Front brake pads & rotors", "SAMPLE SUV", "1.7"], ["Alternator replacement", "SAMPLE pickup", "1.8"], ["Alternator replacement", "SAMPLE sedan", "1.5"], ["Serpentine belt", "SAMPLE sedan", "0.7"], ["Starter replacement", "SAMPLE pickup", "2.2"]];
    await saveTimes([...S.map(([j, v, h]) => ({ job: j, veh: v, hours: h, by: "SAMPLE", ts: "sample" })), ...timesG]);
  }
  async function clearTimeSamples() { await saveTimes(timesG.filter((t) => t.by !== "SAMPLE")); }

  // ---------- Intake auto-draft: diagnose → ballpark → drafted reply → owner edits → owner sends ----------
  const [replyDraft, setReplyDraft] = useState(null);
  const OFFLINE_CAUSES = [
    ["no start|wont start|won't start|no crank|click", ["Weak/dead battery", "Starter", "Battery cable/connection"], 150, 550],
    ["brake|grind|squeal", ["Brake pads & rotors", "Sticking caliper", "Brake hardware"], 220, 650],
    ["overheat|running hot|coolant", ["Thermostat", "Water pump", "Radiator/hose leak"], 180, 900],
    ["battery light|charging|alternator", ["Alternator", "Serpentine belt", "Battery"], 250, 800],
    ["check engine|misfire|rough idle", ["Ignition coils/plugs", "Vacuum leak", "Sensor fault — scan needed"], 95, 600],
    ["a/c|air condition|not blowing cold", ["Refrigerant leak/recharge", "Compressor clutch", "Blend door actuator"], 150, 950],
    ["mower|blade|deck|won't cut", ["Blade sharpen/replace", "Deck belt", "Spindle bearing"], 60, 260],
    ["oil leak|leaking oil", ["Valve cover gasket", "Oil pan gasket", "Main seal — inspect first"], 120, 700],
  ];
  function offlineDiag(txt) {
    const t = (txt || "").toLowerCase();
    for (const [pat, causes, lo, hi] of OFFLINE_CAUSES) if (pat.split("|").some((k) => t.includes(k))) return { causes, lo, hi };
    return { causes: ["Needs eyes on it — diagnostic first"], lo: 95, hi: 195 };
  }
  async function autoDraft(bk) {
    let d = offlineDiag((bk.vehicle || "") + " " + (bk.notes || ""));
    try {
      const r = await apiFetch("/api/claude", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonMode: true, messages: [{ role: "user", content: 'A customer requests service. Vehicle: ' + (bk.vehicle || "unknown") + '. They say: ' + (bk.notes || "") + '. Reply ONLY with JSON {"causes":[three short probable causes],"lo":number,"hi":number} — a realistic independent-shop parts+labor range in USD. No other text.' }] }) });
      if (r.ok) {
        const j = await r.json();
        const txt = (j.content || []).map((c) => c.text || "").join("");
        const p = JSON.parse(txt.replace(/```json|```/g, "").trim());
        if (p && p.causes && p.causes.length) d = { causes: p.causes.slice(0, 3), lo: Number(p.lo) || d.lo, hi: Number(p.hi) || d.hi };
      }
    } catch (e) {}
    const msg = "Hi " + (bk.name || "there") + " — got your request about your " + (bk.vehicle || "vehicle") + ". From what you described, the usual suspects are: " + d.causes.join(", ") + ". Ballpark " + money(d.lo) + "–" + money(d.hi) + " parts + labor; exact written estimate after we look (diagnostic from $95, with $40 credited to the repair). Want us out " + (bk.date || "this week") + (bk.time ? " at " + bk.time : "") + "? Reply YES to confirm. — " + BRAND.name + " " + BRAND.phone + " (Reply STOP to opt out)";
    setReplyDraft({ key: bk.key, name: bk.name || "", phone: bk.phone || "", email: bk.email || "", pref: bk.pref || "text", causes: d.causes, lo: d.lo, hi: d.hi, msg });
  }
  async function sendDraftEmail() {
    if (!replyDraft) return;
    if (!replyDraft.email) { setErr("No email on this request — send by text, or add their email to the booking."); return; }
    try {
      const r = await apiFetch("/api/email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to: replyDraft.email, subject: BRAND.name + " — your service request", html: '<pre style="font-family:inherit;white-space:pre-wrap">' + replyDraft.msg.replace(/</g, "&lt;") + "</pre>" }) });
      if (!r.ok) throw new Error("route");
      setErr("Estimate reply emailed ✓"); setTimeout(() => setErr(""), 2500);
    } catch (e) {
      window.location.href = "mailto:" + replyDraft.email + "?subject=" + encodeURIComponent(BRAND.name + " — your service request") + "&body=" + encodeURIComponent(replyDraft.msg);
    }
  }

  // ---------- Customer members: free login (no repair needed), chat w/ shop, community channels ----------
  const [pmMember, setPmMember] = useState(null);
  const [memMode, setMemMode] = useState("join");
  const [memForm, setMemForm] = useState({ name: "", phone: "", email: "", pin: "", signedName: "", agree: false, notify: true });
  const [memLogin, setMemLogin] = useState({ phone: "", pin: "" });
  const [memMsg, setMemMsg] = useState("");
  const [memChat, setMemChat] = useState([]);
  const [memChatText, setMemChatText] = useState("");
  const [memFeed, setMemFeed] = useState([]);
  const [memChannel, setMemChannel] = useState("Ask & Learn");
  const [memPost, setMemPost] = useState("");
  async function getMembers() { const r = await store.get("members:list"); if (r) { try { return JSON.parse(r.value); } catch (e) {} } return []; }
  async function memberSignup() {
    if (!memForm.name.trim() || !memForm.phone.trim() || memForm.pin.length < 4) { setMemMsg("Name, phone, and a 4+ digit password please."); return; }
    if (!memForm.agree || !memForm.signedName.trim()) { setMemMsg("Read the guidelines, type your name to sign, and check the box."); return; }
    const list = await getMembers();
    if (list.find((m) => m.phone === memForm.phone.trim())) { setMemMsg("That phone already has a login — use Sign in."); setMemMode("login"); return; }
    // Optional email gives the customer a real username to sign in with
    // instead of their phone number, and a way to reset their own password.
    // Entirely optional - phone + password still works fine on its own.
    const email = (memForm.email || "").trim().toLowerCase();
    let username = "";
    if (email.includes("@") && email.indexOf("@") > 0) {
      username = email.split("@")[0].replace(/[^a-z0-9._-]/g, "");
      if (list.find((m) => (m.username || "").toLowerCase() === username)) { setMemMsg(`Username "${username}" is taken — use a different email, or leave email blank and sign in with your phone.`); return; }
    }
    const m = { name: memForm.name.trim(), phone: memForm.phone.trim(), pin: memForm.pin, email, username, ok: true, notify: memForm.notify, signedName: memForm.signedName.trim(), ts: new Date().toISOString().slice(0, 10) };
    await store.set("members:list", [...list, m]);
    setPmMember(m); setMemMsg("");
    if (email && username) {
      apiFetch("/api/email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        to: email, subject: BRAND.name + " — your account",
        text: `Hi ${m.name},\n\nYour ${BRAND.name} account is set up.\n\nUsername: ${username}\n(You can also sign in with your phone number: ${m.phone})\n\nUse it to check your estimates, approve work, and get to the community.\n\nQuestions: ${BRAND.phone}` }) }).catch(() => {});
    }
  }
  async function memberLogin() {
    const list = await getMembers();
    const id = memLogin.phone.trim().toLowerCase();
    // Accept phone, username, or full email - whichever the customer remembers.
    const m = list.find((x) =>
      x.pin === memLogin.pin && (
        x.phone === memLogin.phone.trim() ||
        (x.username && x.username.toLowerCase() === id) ||
        (x.email && x.email.toLowerCase() === id)
      ));
    if (!m) { setMemMsg("No match — check your phone or username and password."); return; }
    if (m.ok === false) { setMemMsg("Your access is paused. Text the shop at " + BRAND.phone + " to talk it through."); return; }
    setPmMember(m); setMemMsg("");
  }
  useEffect(() => { if (custPortal && pmMember) (async () => {
    const f = await store.get("mfeed:posts"); if (f) { try { setMemFeed(JSON.parse(f.value)); } catch (e) {} }
    const c = await store.get("mchat:" + pmMember.phone); if (c) { try { setMemChat(JSON.parse(c.value)); } catch (e) {} } else setMemChat([]);
  })(); }, [custPortal, pmMember]);
  async function sendMemberMsg() {
    if (!memChatText.trim() || !pmMember) return;
    const list = [...memChat, { from: "member", text: memChatText.trim(), ts: new Date().toISOString().slice(0, 16).replace("T", " ") }].slice(-100);
    setMemChat(list); await store.set("mchat:" + pmMember.phone, list); setMemChatText("");
  }
  async function postMemberFeed() {
    if (!memPost.trim() || !pmMember) return;
    const list = [{ by: pmMember.name, ch: memChannel, text: memPost.trim(), ts: new Date().toISOString().slice(0, 16).replace("T", " ") }, ...memFeed].slice(0, 300);
    setMemFeed(list); await store.set("mfeed:posts", list); setMemPost("");
  }
  const [memFileMsg, setMemFileMsg] = useState("");
  async function sendMemberFiles(e) {
    const files = Array.from(e.target.files || []).slice(0, 3);
    e.target.value = "";
    if (!files.length || !pmMember) return;
    const total = files.reduce((acc, f) => acc + f.size, 0);
    if (total > 7 * 1024 * 1024) { setMemFileMsg("Keep it under 7MB total - try fewer or smaller files."); setTimeout(() => setMemFileMsg(""), 5000); return; }
    setMemFileMsg("Packing your files...");
    try {
      const atts = await Promise.all(files.map((f) => new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res({ filename: f.name, content: String(r.result).split(",")[1] });
        r.onerror = rej;
        r.readAsDataURL(f);
      })));
      const rsp = await apiFetch("/api/email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to: shopEmail(), subject: BRAND.name + " - files from " + pmMember.name + " (" + pmMember.phone + ")", text: "Member file drop-off from " + pmMember.name + " - " + files.map((f) => f.name).join(", "), attachments: atts }) });
      setMemFileMsg(rsp.ok ? "Sent - the shop has your files." : "Could not send from this preview - file sending works on the deployed app.");
    } catch (err) { setMemFileMsg("Could not send from this preview - file sending works on the deployed app."); }
    setTimeout(() => setMemFileMsg(""), 6000);
  }

  // staff side
  const [membersAll, setMembersAll] = useState([]);
  const [inboxSel, setInboxSel] = useState("");
  const [inboxThread, setInboxThread] = useState([]);
  const [inboxReply, setInboxReply] = useState("");
  useEffect(() => { if (tab === "Community" && currentTech && currentTech.admin) (async () => { setMembersAll(await getMembers()); })(); }, [tab, currentTech]);
  async function deleteMember(phone) {
    const m = membersAll.find((x) => x.phone === phone);
    if (!m) return;
    if (!window.confirm(`Delete ${m.name}'s account for good?\n\nThis removes their login and their community access. Their past estimates and invoices are NOT touched. This cannot be undone.`)) return;
    const list = membersAll.filter((x) => x.phone !== phone);
    await store.set("members:list", list);
    setMembersAll(list);
    setErr(`${m.name}'s account deleted.`); setTimeout(() => setErr(""), 3500);
  }
  async function reportMember(phone) {
    const m = membersAll.find((x) => x.phone === phone);
    if (!m) return;
    const why = window.prompt(`Report ${m.name} — what happened?\n\nThis flags the account, pauses their access, and saves a dated note you can refer back to.`);
    if (!why) return;
    const list = membersAll.map((x) => x.phone === phone
      ? { ...x, ok: false, reported: [...(x.reported || []), { why, ts: new Date().toISOString().slice(0, 16).replace("T", " "), by: currentTech ? currentTech.name : "owner" }] }
      : x);
    await store.set("members:list", list);
    setMembersAll(list);
    setErr(`${m.name} reported and paused. The note is saved on their account.`); setTimeout(() => setErr(""), 4500);
  }
  async function toggleDonor(phone) {
    const list = (await getMembers()).map((m) => m.phone === phone ? { ...m, donor: !m.donor } : m);
    await store.set("members:list", list); setMembersAll(list);
  }
  async function toggleMember(phone) {
    const list = (await getMembers()).map((m) => m.phone === phone ? { ...m, ok: m.ok === false } : m);
    await store.set("members:list", list); setMembersAll(list);
  }
  async function openThread(phone) {
    setInboxSel(phone);
    const c = await store.get("mchat:" + phone);
    if (c) { try { setInboxThread(JSON.parse(c.value)); return; } catch (e) {} }
    setInboxThread([]);
  }
  async function replyThread() {
    if (!inboxReply.trim() || !inboxSel) return;
    const list = [...inboxThread, { from: "shop", by: currentTech ? currentTech.name : "Shop", text: inboxReply.trim(), ts: new Date().toISOString().slice(0, 16).replace("T", " ") }].slice(-100);
    setInboxThread(list); await store.set("mchat:" + inboxSel, list);
    const m = membersAll.find((x) => x.phone === inboxSel);
    if (m && m.notify !== false) sendTextSmart(inboxSel, BRAND.name + ": " + inboxReply.trim() + " (Reply STOP to opt out)");
    setInboxReply("");
  }

  const shopEmail = () => (settings.shopEmail && settings.shopEmail.includes("@") ? settings.shopEmail : BRAND.email);
  async function autoReceipt() {
    const c = meta.customer || {};
    const lines = "PAID - thank you! " + BRAND.name + " receipt for " + (vehicle.ymm || "your vehicle") + ". Total " + money(invTotal) + ". Your 12-month/12,000-mile warranty is active - keep this message with your records. Questions: " + BRAND.phone + ". (Reply STOP to opt out)";
    try {
      if (c.email) {
        apiFetch("/api/email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to: c.email, subject: BRAND.name + " - receipt, " + money(invTotal) + " PAID", text: lines }) }).catch(() => {});
      }
      if (c.phone && c.notify !== false) { sendTextSmart(c.phone, lines); }
      setErr("Receipt sent to the customer automatically.");
      setTimeout(() => setErr(""), 3000);
    } catch (e) {}
  }

  useEffect(() => { (async () => {
    const r = await store.get("shop:id");
    if (r && r.value) { setSettings((v) => ({ ...v, shopId: r.value })); return; }
    const gen = "PM-" + Math.floor(1000 + Math.random() * 9000);
    await store.set("shop:id", gen);
    setSettings((v) => ({ ...v, shopId: gen }));
  })(); }, []);

  function copyAppLink() {
    try { navigator.clipboard.writeText(window.location.href); setErr("App link copied — text it to any phone or tablet."); setTimeout(() => setErr(""), 3000); } catch (e) {}
  }

  function downloadCustomerReport() {
    const items = custPhotos.map((p, i) => {
      const media = p.kind === "video"
        ? `<video controls style="width:100%;border-radius:10px" src="${p.dataUrl}"></video>`
        : `<img style="width:100%;border-radius:10px" src="${p.dataUrl}" alt="${(p.name || "Job photo").replace(/"/g, "")}">`;
      return `<div style="margin:0 0 22px"><div style="font-weight:800;color:#7A1F1F;margin:0 0 6px">${p.caption || "Photo " + (i + 1)}</div>${media}${p.comment ? `<div style="font-size:14px;color:#444;margin-top:6px">${p.comment}</div>` : ""}</div>`;
    }).join("");
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Peaceful Motors — ${meta.number}</title></head>
<body style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;padding:18px;color:#241F1F">
<div style="border-bottom:3px solid #7A1F1F;padding-bottom:10px;margin-bottom:16px">
<div style="font-size:24px;font-weight:900;color:#7A1F1F">PEACEFUL MOTORS</div>
<div style="font-style:italic;color:#2E7D32;font-size:13px">{BRAND.tagline}</div>
<div style="font-size:12px;color:#666">314-919-7456 · peacefulmotors@outlook.com · peacefulmotors.com</div></div>
<p style="font-size:15px"><b>${meta.customer.name || "Customer"}</b> — here's what we found on your <b>${vehicle.ymm || "vehicle"}</b> (${meta.number}).</p>
${items || "<p>(no media attached)</p>"}
${rows.filter((r) => r.desc).length ? `<div style="background:#F5EDE6;border-radius:10px;padding:12px;font-size:14px"><b>Estimate total: ${money(totals.grand)}</b> — full written estimate provided separately.</div>` : ""}
<p style="font-size:12px;color:#666;margin-top:18px">Questions? Call or text 314-919-7456. Warranty: 12 months / 12,000 miles, parts &amp; labor.</p>
</body></html>`;
    const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    const a = document.createElement("a"); a.href = url; a.download = `${meta.number}-customer-report.html`; a.click(); URL.revokeObjectURL(url);
  }

  function exportContactsCsv() {
    const seen = new Map();
    bookings.forEach((b) => { if (b.name || b.phone) seen.set((b.name || "") + (b.phone || ""), b); });
    const rows = Array.from(seen.values());
    if (rows.length === 0) { setErr("No customer records to export yet."); setTimeout(() => setErr(""), 3000); return; }
    const esc = (s) => `"${String(s || "").replace(/"/g, '""')}"`;
    const header = "Name,Phone,Vehicle,Last Date,Notes\n";
    const body = rows.map((b) => [esc(b.name), esc(b.phone), esc(b.vehicle), esc(b.date), esc(b.notes)].join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([header + body], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = `peaceful-os-contacts-${todayStr()}.csv`; a.click(); URL.revokeObjectURL(url);
  }
  function exportCalendarIcs() {
    const upcoming = bookings.filter((b) => b.status === "Scheduled" && b.date);
    if (upcoming.length === 0) { setErr("No scheduled bookings to export yet."); setTimeout(() => setErr(""), 3000); return; }
    const pad = (n) => String(n).padStart(2, "0");
    const stamp = (d, t) => {
      const [y, mo, da] = (d || "").split("-").map(Number);
      const [h, mi] = (t || "09:00").split(":").map(Number);
      return `${y}${pad(mo)}${pad(da)}T${pad(h || 9)}${pad(mi || 0)}00`;
    };
    const nowStamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//" + BRAND.name + "//Bookings//EN", "CALSCALE:GREGORIAN"];
    upcoming.forEach((b) => {
      const start = stamp(b.date, b.time);
      lines.push("BEGIN:VEVENT");
      lines.push("UID:" + b.key + "@peacefulos");
      lines.push("DTSTAMP:" + nowStamp);
      lines.push("DTSTART:" + start);
      lines.push("SUMMARY:" + (b.name || "Job") + " - " + (b.vehicle || "vehicle"));
      lines.push("DESCRIPTION:" + (b.notes || "").replace(/\n/g, "\\n") + (b.phone ? " - " + b.phone : ""));
      lines.push("END:VEVENT");
    });
    lines.push("END:VCALENDAR");
    const url = URL.createObjectURL(new Blob([lines.join("\r\n")], { type: "text/calendar" }));
    const a = document.createElement("a"); a.href = url; a.download = `peaceful-os-bookings-${todayStr()}.ics`; a.click(); URL.revokeObjectURL(url);
  }
  async function backupAll() {
    const listing = await store.list("");
    const dump = { exportedAt: new Date().toISOString(), data: {} };
    if (listing && listing.keys) {
      for (const k of listing.keys) {
        const r = await store.get(k);
        if (r) { try { dump.data[k] = JSON.parse(r.value); } catch (e) { dump.data[k] = r.value; } }
      }
    }
    const url = URL.createObjectURL(new Blob([JSON.stringify(dump, null, 2)], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = `peaceful-os-backup-${todayStr()}.json`; a.click(); URL.revokeObjectURL(url);
  }
  const restoreFileRef = useRef(null);
  async function restoreAll(e) {
    const file = e.target.files && e.target.files[0]; e.target.value = "";
    if (!file) return;
    if (!window.confirm("This adds every record from the backup file into this shop, overwriting any record with the same key. Continue?")) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const entries = parsed && parsed.data ? Object.entries(parsed.data) : null;
      if (!entries) { setErr("That doesn't look like a Peaceful OS backup file."); return; }
      for (const [k, v] of entries) { await store.set(k, v); }
      setErr(`Restored ${entries.length} record(s) — reload the page to see them everywhere.`);
      setTimeout(() => setErr(""), 6000);
    } catch (e2) { setErr("Couldn't read that file — make sure it's an unmodified Peaceful OS backup .json file."); }
  }
  async function cleanUpOldRecords() {
    const years = parseFloat(settings.recordRetentionYears) || 3;
    const cutoff = new Date(); cutoff.setFullYear(cutoff.getFullYear() - years);
    const oldOnes = bookings.filter((b) => (b.status === "Done" || b.status === "Cancelled") && b.date && new Date(b.date) < cutoff);
    if (oldOnes.length === 0) { setErr("Nothing to clean up — no closed records older than " + years + " year(s)."); setTimeout(() => setErr(""), 4000); return; }
    if (!window.confirm(`Delete ${oldOnes.length} closed booking record(s) older than ${years} year(s)? This can't be undone — back up first if unsure.`)) return;
    for (const b of oldOnes) { try { await store.delete(b.key); } catch (e2) {} }
    setErr(`Deleted ${oldOnes.length} old record(s).`); setTimeout(() => setErr(""), 4000);
    loadBookings();
  }
  function importCsv(e) {
    const file = e.target.files && e.target.files[0]; e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const lines = String(reader.result).split(/\r?\n/).filter((l) => l.trim());
        if (lines.length < 2) { setErr("That CSV looks empty."); return; }
        const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/"/g, ""));
        const col = (row, name) => { const i = headers.indexOf(name); return i === -1 ? "" : (row[i] || "").replace(/"/g, "").trim(); };
        let count = 0;
        for (let i = 1; i < lines.length; i++) {
          const row = lines[i].split(",");
          const name = col(row, "name") || col(row, "customer");
          const vehicleField = col(row, "vehicle") || col(row, "vehicle_ymm");
          if (!name && !vehicleField) continue;
          await store.set("bookings:" + todayStr() + "-imported-" + Date.now() + "-" + i, {
            name, phone: col(row, "phone"), vehicle: vehicleField, date: col(row, "date") || todayStr(),
            time: "", tech: "", notes: col(row, "notes") || "Imported from CSV", status: "Scheduled",
          });
          count++;
        }
        setErr(`Imported ${count} record(s) from CSV as bookings — reload to see them.`);
        setTimeout(() => setErr(""), 6000);
      } catch (e2) { setErr("Couldn't read that CSV — expected columns like name, phone, vehicle, date, notes."); }
    };
    reader.readAsText(file);
  }

  function openPartsTech(r) {
    const q = [vehicle.ymm, r.desc, r.part].filter(Boolean).join(" ");
    try { navigator.clipboard.writeText(q); } catch (e) {}
    window.open("https://app.partstech.com", "_blank");
    setErr(`Copied "${q}" — log into PartsTech and paste it into search.`);
    setTimeout(() => setErr(""), 4500);
  }
  function openNexpart(r) {
    const q = [vehicle.ymm, r.desc, r.part].filter(Boolean).join(" ");
    try { navigator.clipboard.writeText(q); } catch (e) {}
    window.open("https://www.nexpart.com", "_blank");
    setErr(`Copied "${q}" — log into Nexpart and paste it into search.`);
    setTimeout(() => setErr(""), 4500);
  }
  function openVendor(v) {
    const q = [vehicle.ymm, complaint, rows.map((r) => r.desc).filter(Boolean).join(", ")].filter(Boolean).join(" | ");
    try { navigator.clipboard.writeText(q); } catch (e) {}
    window.open(v.url, "_blank");
    const acct = (settings.vendorAccounts || {})[v.key];
    setErr(`Opened ${v.name}${acct && acct.user ? " - your login is " + acct.user : ""}. Vehicle and job copied to your clipboard, paste it into their search.`);
    setTimeout(() => setErr(""), 6000);
  }
  function openFitmentLookup(site) {
    const q = vehicle.ymm || "";
    try { navigator.clipboard.writeText(q); } catch (e) {}
    const urls = { autozone: "https://www.autozone.com", oreilly: "https://www.oreillyauto.com" };
    window.open(urls[site], "_blank");
    setErr(q ? `Copied "${q}" — paste into their vehicle lookup for the exact filter, bulb, or fluid spec for this vehicle.` : "Enter a vehicle first, then this copies it for you.");
    setTimeout(() => setErr(""), 5000);
  }

  function emailEstimate() {
    const subject = `Peaceful Motors Estimate ${meta.number} — ${vehicle.ymm || "vehicle"}`;
    const body = customerText();
    setEmailBox({ open: true, to: meta.customer?.email || "", from: settings.defaultEmail || shopEmail(), subject, body: body.slice(0, 1800) });
  }
  function sendEmailBox() {
    if (emailBusy.current) return;            // double-tap guard
    emailBusy.current = true;
    setEmailBox({ ...emailBox, open: false }); // close FIRST so it can't re-fire
    window.location.href = `mailto:${emailBox.to}?subject=${encodeURIComponent(emailBox.subject)}&body=${encodeURIComponent(emailBox.body)}`;
    setTimeout(() => { emailBusy.current = false; }, 1200);
  }

  async function saveEstimate() {
    const record = { meta, vehicle, category, totals, rows, folder: "New", tech: currentTech ? currentTech.name : "", savedAt: new Date().toISOString() };
    await store.set(`estimates:${meta.number}`, record);
    try { localStorage.setItem("pm-workdraft", ""); } catch (e) {} // real save supersedes the crash draft
    // Auto-email a copy to the shop inbox — works on the deployed site once
    // RESEND_API_KEY is set; silently skipped everywhere else.
    // Shop file copy — once per estimate number, not on every save.
    try {
      const sentKey = "emailed:" + meta.number;
      if (!sessionStorage.getItem(sentKey)) {
        sessionStorage.setItem(sentKey, "1");
        apiFetch("/api/email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subject: `Peaceful Motors Estimate ${meta.number} — ${vehicle.ymm || ""}`, text: customerText() }) }).catch(() => {});
      }
    } catch (e) {}
    setSaveMsg("Saved.");
    setTimeout(() => setSaveMsg(""), 2000);
    loadDashboard();
  }
  // ---------- Crash-proof working draft (fixes "it wiped everything") ----------
  // The in-progress estimate used to live only in memory: answer a phone
  // call or open the camera, the OS evicts the tab, the app reloads, and the
  // whole ticket is gone. Now every change writes a local draft on THIS
  // device (never synced — it's scratch paper, not a record), and after any
  // reload the draft comes back automatically. Saving the estimate for real,
  // or dismissing the restore note, clears it.
  const draftRestored = useRef(false);
  const [draftNote, setDraftNote] = useState("");
  useEffect(() => {
    if (draftRestored.current) return; draftRestored.current = true;
    try {
      const raw = localStorage.getItem("pm-workdraft");
      if (!raw) return;
      const d = JSON.parse(raw);
      const hasWork = d && ((d.rows || []).some((r) => r.desc || r.part || num(r.hrs) > 0) || (d.meta && d.meta.customer && d.meta.customer.name) || (d.vehicle && d.vehicle.ymm));
      if (!hasWork) return;
      if (d.rows) setRows(d.rows); if (d.meta) setMeta(d.meta); if (d.vehicle) setVehicle(d.vehicle); if (d.category) setCategory(d.category);
      setDraftNote("Restored your in-progress estimate from " + (d.at ? new Date(d.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "before the reload") + " — nothing was lost.");
    } catch (e) {}
  }, []);
  useEffect(() => {
    if (!draftRestored.current) return;
    const t = setTimeout(() => {
      try {
        const hasWork = rows.some((r) => r.desc || r.part || num(r.hrs) > 0) || (meta.customer && meta.customer.name) || vehicle.ymm;
        localStorage.setItem("pm-workdraft", hasWork ? JSON.stringify({ rows, meta, vehicle, category, at: new Date().toISOString() }) : "");
      } catch (e) {}
    }, 800);
    return () => clearTimeout(t);
  }, [rows, meta, vehicle, category]);
  async function loadDashboard() {
    const listing = await store.list("estimates:");
    if (!listing || !listing.keys) { setSavedEstimates([]); return; }
    const recs = [];
    for (const k of listing.keys) {
      const r = await store.get(k);
      if (r) { try { recs.push(JSON.parse(r.value)); } catch (e) {} }
    }
    setSavedEstimates(recs);
  }
  // ---------- Platform HQ (SOLO app only): the shops you license ----------
  const TIERS = {
    "Founder": { price: 79, feats: { bookings: true, parts: true, ai: true, media: true, portal: true, community: true, academy: false, shield: false, fixes: true, custCommunity: true, inspection: true } },
    "Solo": { price: 99, feats: { bookings: true, parts: true, ai: true, media: true, portal: true, community: false, academy: false, shield: false, fixes: true, custCommunity: true, inspection: true } },
    "Crew": { price: 149, feats: { bookings: true, parts: true, ai: true, media: true, portal: true, community: true, academy: false, shield: false, fixes: true, custCommunity: true, inspection: true } },
    "Enterprise": { price: 249, feats: { bookings: true, parts: true, ai: true, media: true, portal: true, community: true, academy: true, shield: true, fixes: true, custCommunity: true, inspection: true } },
  };
  const [hqShops, setHqShops] = useState([]);
  const [hqForm, setHqForm] = useState({ name: "", contact: "", tier: "Founder", status: "Active" });
  useEffect(() => { if (PLATFORM_HQ) (async () => { const r = await store.get("platform:shops"); if (r) { try { setHqShops(JSON.parse(r.value)); } catch (e) {} } })(); }, []);
  async function hqSave(list) { setHqShops(list); await store.set("platform:shops", list); }
  function hqLicenseLine(shop) {
    // The onboarding config: paste into that shop's Admin → restore/feature
    // area. One line carries the tier's whole feature set.
    return JSON.stringify({ shop: shop.name, tier: shop.tier, status: shop.status, features: (TIERS[shop.tier] || TIERS.Solo).feats });
  }
  // Help bubble parking: tap to open, double-tap to send it left / right / away.
  // When it's tucked away a small dot in the header brings it back, so it can
  // never end up sitting on top of a button he needs.
  const [helpSide, setHelpSide] = useState("left");
  const [apprName, setApprName] = useState("");
  const [apprMsg, setApprMsg] = useState("");
  const [dashSearch, setDashSearch] = useState("");
  const [dashStatus, setDashStatus] = useState("All");
  // ---------- My Times: the shop's own labor-time library ----------
  // The built-in guide is a starting point; YOUR guide-checked numbers win.
  // Pin a time once (from any line) and every future suggestion for that
  // repair uses your number, marked "your time". This library is the labor
  // data the shop owns outright.
  const [myTimes, setMyTimes] = useState({});
  useEffect(() => { (async () => { const r = await store.get("labor:mytimes"); if (r) { try { setMyTimes(JSON.parse(r.value)); } catch (e) {} } })(); }, []);
  async function pinMyTime(name, hrs) {
    const h = num(hrs); if (!name || !(h > 0)) return;
    const next = { ...myTimes, [name]: h };
    setMyTimes(next); await store.set("labor:mytimes", next);
    setErr("Pinned: \"" + name + "\" = " + h + " hr is now YOUR standard time."); setTimeout(() => setErr(""), 3500);
  }
  const bestHours = (r) => (myTimes[r.name] != null ? { hours: myTimes[r.name], mine: true } : { hours: suggestedHours(r, vehicle.ymm).hours, mine: false });
  useEffect(() => { if (tab === "Dashboard") loadDashboard(); }, [tab]);

  const dash = useMemo(() => {
    const n = savedEstimates.length;
    const totalVal = savedEstimates.reduce((s, e) => s + (e.totals?.grand || 0), 0);
    const avg = n ? totalVal / n : 0;
    const byStatus = {};
    STATUSES.forEach((s) => (byStatus[s] = 0));
    savedEstimates.forEach((e) => { byStatus[e.meta?.status || "Draft"] = (byStatus[e.meta?.status || "Draft"] || 0) + 1; });
    const approvedPlus = STATUSES.slice(2).reduce((s, k) => s + (byStatus[k] || 0), 0);
    const approvalRate = n ? Math.round((approvedPlus / n) * 100) : 0;
    const partsTotal = savedEstimates.reduce((s, e) => s + (e.totals?.partsSub || 0), 0);
    const laborTotal = savedEstimates.reduce((s, e) => s + (e.totals?.laborSub || 0), 0);
    return { n, totalVal, avg, byStatus, approvalRate, partsTotal, laborTotal };
  }, [savedEstimates]);

  const input = "w-full bg-white text-neutral-800 rounded-lg px-3.5 py-3 text-base border border-neutral-400 focus:outline-none focus:border-neutral-400 min-h-[48px] mb-1 print:hidden";
  const label = "text-[12px] uppercase tracking-wide text-neutral-600 mb-1.5 mt-1 block print:hidden";
  const card = { background: C.panel, border: `1px solid ${C.line}` };
  const pri = (p) => p === "high" ? C.red : p === "med" ? C.amber : "#6b7280";
  const statusIdx = STATUSES.indexOf(meta.status);
  const invTotal = totals.grand + num(inv.serviceCall) - num(inv.diagCredit);

  // ---------- Customer portal ----------
  if (custPortal) {
    return (
      <div className={"min-h-screen text-neutral-800 overflow-x-hidden p-4" + (settings.nightMode ? " pm-night" : "")} style={{ background: C.ink }}>
        {settings.nightMode && <style>{`
          .pm-night{color:#E8E1DA}
          .pm-night .text-neutral-800{color:#E8E1DA}.pm-night .text-neutral-700{color:#D8CFC7}
          .pm-night .text-neutral-600{color:#C7BDB4}.pm-night .text-neutral-500{color:#A99E94}
          .pm-night .border-neutral-300{border-color:#3B332E}.pm-night .border-neutral-400{border-color:#4A413B}
          .pm-night input,.pm-night select,.pm-night textarea{background:#2A2420;color:#E8E1DA;border-color:#4A413B}
          .pm-night ::placeholder{color:#8a7f76}
        `}</style>}
        <div className="max-w-md mx-auto">
          <div className="rounded-lg overflow-hidden mb-4" style={{ border: `1px solid ${C.line}` }}>
            <div className="px-4 py-3" style={{ background: C.maroon, color: "#fff" }}>
              <div className="text-lg font-black tracking-wide">{BRAND.name}</div>
              <div className="text-xs italic" style={{ color: "#2E7D32" }}>{BRAND.tagline}</div>
            </div>
          </div>
          <div className="rounded-md p-3 mb-3" style={card}>
            <span className={label}>Look up your estimate — phone number or estimate #</span>
            <div className="flex gap-2">
              <input className={input} placeholder="Phone or PM-2026-…" value={portalQ} onChange={(e) => setPortalQ(e.target.value)} />
              <button onClick={portalLookup} className="px-4 rounded font-semibold" style={{ background: C.green, color: "#fff" }}>Find</button>
            </div>
          </div>
          {portalRes !== null && (portalRes.length === 0
            ? <div className="rounded-md p-3 text-sm text-neutral-600 mb-3" style={card}>Nothing found — double-check the number, or call {BRAND.phone}.</div>
            : portalRes.map((e, i) => (
              <div key={i} className="rounded-md p-3 mb-3" style={card}>
                <div className="flex justify-between text-sm"><b>{e.meta && e.meta.number}</b><span>{(e.meta && e.meta.status) || ""}</span></div>
                <div className="text-xs text-neutral-600">{(e.vehicle && e.vehicle.ymm) || ""} · {e.folder || "New"}</div>
                <div className="text-lg font-black mt-1" style={{ color: "#1B5E20" }}>{money((e.totals && e.totals.grand) || 0)}</div>
                {(e.meta && e.meta.approvedBy) ? (
                  <div className="mt-2 text-[12px] font-bold" style={{ color: "#1B5E20" }}>✓ Approved by {e.meta.approvedBy} on {e.meta.approvedAt}</div>
                ) : (
                  <div className="mt-2">
                    <input className={input + " w-full mb-1"} placeholder="Type your full name to approve" value={apprName} onChange={(ev) => setApprName(ev.target.value)} />
                    <button onClick={async () => {
                      if (apprName.trim().length < 3) { setApprMsg("Type your full name first."); return; }
                      const upd = { ...e, meta: { ...e.meta, status: "Approved", approvedBy: apprName.trim(), approvedAt: new Date().toISOString().slice(0, 10) } };
                      await store.set("estimates:" + (e.meta && e.meta.number), upd);
                      setPortalRes(portalRes.map((x, j) => j === i ? upd : x));
                      setApprMsg("Approved — the shop has been notified. Thank you!"); setApprName("");
                    }} className="w-full py-2.5 rounded font-bold" style={{ background: C.green, color: "#fff" }}>✍️ I approve this work</button>
                  </div>
                )}
                {(settings.stripeLink || "").startsWith("http") && (
                  <button onClick={() => window.open(settings.stripeLink, "_blank")} className="mt-2 w-full py-2 rounded font-bold" style={{ background: "#1a5fb4" }}>Pay online</button>
                )}
              </div>
            )))}
          <div className="rounded-md p-3 mb-3" style={card}>
            <span className={label}>Quick answers</span>
            <select className={input} value={faq} onChange={(e) => setFaq(e.target.value)}>
              <option value="">Pick a question…</option>
              <option value="hours">What are your hours?</option>
              <option value="warranty">What's the warranty?</option>
              <option value="pay">How can I pay?</option>
              <option value="area">Do you come to me?</option>
              <option value="deposit">Do I need to pay anything to book?</option>
              <option value="decline">What if I don't agree to the terms?</option>
              <option value="inspection">Do you do pre-purchase inspections?</option>
              <option value="fleet">Do you work with fleets or businesses?</option>
              <option value="community">What's the free community?</option>
              <option value="diesel">Do you work on diesel?</option>
              <option value="mower">Do you fix mowers and small engines?</option>
              <option value="human">I'd rather talk to a person</option>
            </select>
            {faq && <div className="text-xs text-neutral-700 mt-2">{
              faq === "hours" ? "Mon–Fri, 8:30 AM – 5:30 PM. Call or text " + BRAND.phone + " anytime." :
              faq === "warranty" ? "12 months / 12,000 miles on parts & labor, whichever comes first." :
              faq === "pay" ? "All major cards (Stripe), Apple Pay, Google Pay, Cash App Pay, Klarna, or cash." :
              faq === "area" ? "Yes — we're mobile. Home, work, or roadside across the St. Louis metro." :
              faq === "deposit" ? "Booking holds a $50 non-refundable deposit — it's credited straight to your job, not an extra charge." :
              faq === "decline" ? "Declining the posted terms doesn't refuse you service. Work proceeds under those terms either way, and your objection is kept on record." :
              faq === "inspection" ? "Yes — three tiers, $89 to $219, photo-documented with a written report. Ask about the Inspection tab when you book." :
              faq === "fleet" ? "Yes — CREW-5, FLEET-10, and FLEET-15 retainers with monthly inspections and priority scheduling. See the Fleet page." :
              faq === "community" ? "A free members' area to ask questions, learn from confirmed fixes, and message the shop — no repair required to join." :
              faq === "diesel" ? "Yes — diesel and commercial work at $225/hr, 2-hour minimum." :
              faq === "mower" ? "Yes — mowers and small engines are part of the regular rotation, not an afterthought." :
              "Text " + BRAND.phone + " anytime — a real person reads every message."
            }</div>}
          </div>
          <div className="rounded-md p-3 mb-3" style={card}>
            <span className={label}>Book a service — no account needed</span>
            <div className="grid grid-cols-2 gap-2">
              <input className={input} placeholder="Your name" value={portalBk.name} onChange={(e) => setPortalBk({ ...portalBk, name: e.target.value })} />
              <input className={input} placeholder="Phone" value={portalBk.phone} onChange={(e) => setPortalBk({ ...portalBk, phone: e.target.value })} />
              <input className={input} placeholder="Vehicle (yr/make/model)" value={portalBk.vehicle} onChange={(e) => setPortalBk({ ...portalBk, vehicle: e.target.value })} />
              <input className={input} type="date" value={portalBk.date} onChange={(e) => setPortalBk({ ...portalBk, date: e.target.value })} />
            </div>
            {portalBk.date && (
              <div className="mt-2 rounded-lg p-3" style={{ background: "#F7F3EF", border: "1px solid #E2DAD2" }}>
                <div className="text-xs font-bold mb-2" style={{ color: "#241F1F" }}>Open times on {new Date(portalBk.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</div>
                {openSlotsFor(portalBk.date).length === 0 ? (
                  <div className="text-xs" style={{ color: "#8A6D00" }}>That day is full. Try another date, or tap First available below.</div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {openSlotsFor(portalBk.date).map((t) => (
                      <button key={t} onClick={() => setPortalBk({ ...portalBk, time: t })}
                        className="px-3 py-2 rounded-lg text-xs font-bold border-2"
                        style={{ borderColor: portalBk.time === t ? C.green : "#D8CCC0", background: portalBk.time === t ? "rgba(46,125,50,0.12)" : "#fff", color: portalBk.time === t ? "#1B5E20" : "#3A342F" }}>
                        {portalBk.time === t ? "\u2713 " : ""}{prettyTime(t)}
                      </button>
                    ))}
                  </div>
                )}
                <div className="text-[11.5px] mt-2" style={{ color: "#6B625A" }}>These are the times actually open. Tap one and it's held when you send the request.</div>
              </div>
            )}
            <div className="flex gap-2 mt-2">
              <button onClick={() => { const s = firstAvailableSlot(portalBk.date || todayStr()); if (s) { setPortalBk({ ...portalBk, date: s.date, time: s.time }); setPortalBkMsg(`First available: ${s.date} at ${s.time} — it's yours if you send the request now.`); } else setPortalBkMsg("No open slots in the next 30 days — send the request and we'll call you."); }} className="px-4 rounded-lg text-xs font-semibold whitespace-nowrap" style={{ background: C.green, color: "#fff" }}>⚡ First available</button>
            </div>
            <div className="text-[11.5px] text-neutral-500 mt-1">Pick a time or tap First available. Times are first come, first served — the slot is held once your request goes through. Leave the time blank if you'd rather we call you to arrange it.</div>
            {portalBk.date && portalBk.time && slotIsFull(portalBk.date, portalBk.time) && (
              <div className="mt-2 text-xs rounded px-3 py-2" style={{ background: "#3a2c07", border: "1px solid #6b520c", color: "#fcd9a1" }}>That time is already taken — tap First available for the next open slot.</div>
            )}
            <input className={input + " mt-2"} placeholder="What's it doing? Where's the vehicle?" value={portalBk.issue} onChange={(e) => setPortalBk({ ...portalBk, issue: e.target.value })} />
            <input className={input + " mt-2"} placeholder="Email (optional — for estimates by email)" inputMode="email" value={portalBk.email} onChange={(e) => setPortalBk({ ...portalBk, email: e.target.value })} />
            <div className="flex items-center gap-3 mt-2 text-xs text-neutral-700">
              <span>Reply by:</span>
              <label className="flex items-center gap-1"><input type="radio" checked={portalBk.pref === "text"} onChange={() => setPortalBk({ ...portalBk, pref: "text" })} /> Text</label>
              <label className="flex items-center gap-1"><input type="radio" checked={portalBk.pref === "email"} onChange={() => setPortalBk({ ...portalBk, pref: "email" })} /> Email</label>
            </div>
            <div className="flex gap-2 mt-2 items-center flex-wrap">
              {!pvOK ? (<>
                <button onClick={sendVerifyEmail} className="px-3 py-2 rounded-lg text-xs font-semibold border border-neutral-400 text-neutral-700">Email me a code</button>
                <input className={input + " w-24"} placeholder="Code" inputMode="numeric" value={pvCode} onChange={(e) => setPvCode(e.target.value)} />
                <button onClick={checkVerify} className="px-3 py-2 rounded-lg text-xs font-semibold border border-neutral-400 text-neutral-700">Verify</button>
              </>) : (<span className="text-xs font-bold" style={{ color: "#1B5E20" }}>✓ Phone verified</span>)}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-neutral-600">Human check: 3 + 4 =</span>
              <input className={input + " w-16"} inputMode="numeric" value={pHuman} onChange={(e) => setPHuman(e.target.value)} />
            </div>
            <div className="mt-2">
              <label className="text-xs text-neutral-600">Photos help us quote faster — VIN sticker (driver-door jamb) and the problem area (optional, up to 3):</label>
              <input type="file" accept="image/*" multiple onChange={addPortalPhotos} className="block mt-1 text-xs" />
              {pPhotos.length > 0 && (
                <div className="flex gap-2 mt-1">{pPhotos.map((p, i) => (
                  <span key={i} className="relative"><img src={p} className="h-14 w-14 object-cover rounded" alt="upload" /><button onClick={() => setPPhotos(pPhotos.filter((_, j) => j !== i))} className="absolute -top-1 -right-1 bg-black/80 rounded-full w-4 h-4 text-[12px]">✕</button></span>
                ))}</div>
              )}
            </div>
            <button onClick={portalBallpark} className="w-full mt-2 py-2 rounded-lg text-xs font-semibold border border-neutral-400 text-neutral-700">🔎 Get an instant first look (free)</button>
            {(settings.klarnaLink || "").startsWith("http") && settings.klarnaLink !== "https://www.klarna.com/us/business/" && (
              <div className="mt-2 rounded-lg px-3 py-2 text-[12px]" style={{ background: "#fff0f4", border: "1px solid #ffb3c7", color: "#5a2a35" }}>
                💳 <b>Financing available.</b> Larger repairs can be split into payments — <button onClick={() => window.open(settings.klarnaLink, "_blank")} className="underline font-bold">see your options</button> before you book. Approval is between you and the finance provider; the shop just gets you fixed.
              </div>
            )}
            {pBall && (
              <div className="rounded-md p-2 mt-2 text-xs" style={{ background: "#F7F3EF" }}>
                <b style={{ color: "#1B5E20" }}>Usual suspects:</b> {pBall.causes.join(" · ")} — <b>ballpark {money(pBall.lo)}–{money(pBall.hi)}</b> parts + labor.
                <div className="text-[11.5px] text-neutral-500 mt-1">Automated first look from what you typed — not a quote or a diagnosis. Your written estimate comes after we actually look, and it is the only number that counts.</div>
              </div>
            )}
            <input value={pHp} onChange={(e) => setPHp(e.target.value)} tabIndex={-1} autoComplete="off" style={{ position: "absolute", left: "-5000px", height: 0, width: 0, opacity: 0 }} aria-hidden="true" placeholder="company" />
            {(settings.stripeLink || "").startsWith("http") && (
              <div className="rounded-md p-2.5 mt-2" style={{ background: "#F7F3EF", border: "1px solid #333" }}>
                <div className="text-xs font-bold mb-1.5">Deposit required to hold your spot</div>
                <button onClick={() => window.open(settings.stripeLink, "_blank")} className="w-full py-2 rounded-lg text-xs font-semibold" style={{ background: "#1a5fb4" }}>Pay deposit now</button>
                <label className="flex items-center gap-2 text-xs text-neutral-700 mt-2"><input type="checkbox" checked={pDepositPaid} onChange={(e) => setPDepositPaid(e.target.checked)} /> I've paid my deposit</label>
              </div>
            )}
            <button onClick={portalBook} disabled={(settings.stripeLink || "").startsWith("http") && !pDepositPaid} className="mt-2 w-full py-2.5 rounded font-bold" style={{ background: ((settings.stripeLink || "").startsWith("http") && !pDepositPaid) ? "#C9BCAE" : C.maroon, opacity: ((settings.stripeLink || "").startsWith("http") && !pDepositPaid) ? 0.6 : 1 }}>Request my appointment</button>
            {portalBkMsg && <div className="text-xs mt-2" style={{ color: "#1B5E20" }}>{portalBkMsg}</div>}
            <div className="flex items-center gap-3 mt-2 text-xs text-neutral-700">
              <span>Service terms:</span>
              <label className="flex items-center gap-1"><input type="radio" checked={pTerms === "accepted"} onChange={() => setPTerms("accepted")} /> I accept</label>
              <label className="flex items-center gap-1"><input type="radio" checked={pTerms === "declined"} onChange={() => setPTerms("declined")} /> I decline</label>
            </div>
            <div className="text-[11.5px] text-neutral-500 mt-1">Declining does not refuse you service. Work performed at your request proceeds under the posted shop terms to the extent the law allows, and your objection is kept on record. Booking holds a $50 non-refundable deposit (credited to your job); special-order parts returned or cancelled after ordering carry a 10% restocking fee.</div>
            <div className="text-[11.5px] text-neutral-500 mt-1">By requesting, you agree we may text or email you about this appointment. Reply STOP anytime to stop messages.</div>
          </div>
          <button onClick={shareMyLocation} className="w-full py-2.5 rounded font-bold mb-3" style={{ background: C.green, color: "#fff" }}>📍 Share my vehicle's location for service</button>
          <div className="text-[11.5px] text-neutral-500 mb-3">Location is shared once, only in the text you send — we never track you. Your estimate appears here once the shop saves it in this system. Amounts shown are estimates pending final written approval and subject to the shop's posted terms. Full customer accounts, push notifications, and history arrive with the cloud upgrade.</div>
          {(settings.features || {}).custCommunity !== false ? (
          <div className="rounded-md p-3 mb-3" style={{ ...card, border: `1px solid ${C.green}` }}>
            <div className="text-sm font-bold mb-1">🚗 {BRAND.name} community</div>
            {!pmMember ? (<>
              <div className="text-[12px] text-neutral-500 mb-2">Free login for everyone — you don't need a repair to join. Ask questions, learn, talk cars, and message the shop directly.</div>
              <div className="flex gap-2 mb-2">
                <button onClick={() => setMemMode("join")} className="flex-1 py-2 rounded-lg text-xs font-bold" style={{ background: memMode === "join" ? C.green : "#F2ECE6" }}>Join free</button>
                <button onClick={() => setMemMode("login")} className="flex-1 py-2 rounded-lg text-xs font-bold" style={{ background: memMode === "login" ? C.green : "#F2ECE6" }}>Sign in</button>
              </div>
              {memMode === "join" ? (<>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input className={input} placeholder="Your name" value={memForm.name} onChange={(e) => setMemForm({ ...memForm, name: e.target.value })} />
                  <input className={input} placeholder="Phone" inputMode="tel" value={memForm.phone} onChange={(e) => setMemForm({ ...memForm, phone: e.target.value })} />
                  <input className={input} placeholder="Email (optional — gives you a username)" inputMode="email" value={memForm.email || ""} onChange={(e) => setMemForm({ ...memForm, email: e.target.value })} />
                  <input className={input} placeholder="Create a PIN (4+)" inputMode="numeric" value={memForm.pin} onChange={(e) => setMemForm({ ...memForm, pin: e.target.value })} />
                </div>
                <div className="rounded-md p-2 mt-2 text-[12px] text-neutral-600" style={{ background: "#F7F3EF" }}>
                  <b className="text-neutral-700">Community guidelines (your signature below accepts them):</b>
                  {CUST_GUIDELINES.map((g, i) => <div key={i}>• {g}</div>)}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                  <input className={input} placeholder="Type your name to sign" value={memForm.signedName} onChange={(e) => setMemForm({ ...memForm, signedName: e.target.value })} />
                  <label className="flex items-center gap-2 text-xs text-neutral-700"><input type="checkbox" checked={memForm.agree} onChange={(e) => setMemForm({ ...memForm, agree: e.target.checked })} /> I've read and accept the guidelines</label>
                </div>
                <label className="flex items-center gap-2 text-xs text-neutral-600 mt-1"><input type="checkbox" checked={memForm.notify} onChange={(e) => setMemForm({ ...memForm, notify: e.target.checked })} /> OK to text me when the shop replies (STOP anytime)</label>
                <button onClick={memberSignup} className="w-full mt-2 py-2 rounded-lg text-sm font-bold" style={{ background: C.green, color: "#fff" }}>Create my login</button>
              </>) : (<>
                <div className="grid grid-cols-2 gap-2">
                  <input className={input} placeholder="Phone or username" value={memLogin.phone} onChange={(e) => setMemLogin({ ...memLogin, phone: e.target.value })} />
                  <input className={input} placeholder="PIN" inputMode="numeric" value={memLogin.pin} onChange={(e) => setMemLogin({ ...memLogin, pin: e.target.value })} />
                </div>
                <button onClick={memberLogin} className="w-full mt-2 py-2 rounded-lg text-sm font-bold" style={{ background: C.green, color: "#fff" }}>Sign in</button>
              </>)}
              {memMsg && <div className="text-xs mt-2" style={{ color: "#f0b356" }}>{memMsg}</div>}
            </>) : (<>
              <div className="flex items-center gap-2 mb-2"><b className="text-sm flex-1" style={{ color: "#1B5E20" }}>Hey {pmMember.name} 👋</b><button onClick={() => setPmMember(null)} className="text-xs text-neutral-600 underline">Sign out</button></div>
              <div className="rounded-md p-2 mb-2" style={{ background: "#F7F3EF" }}>
                <div className="text-xs font-bold mb-1">💬 Message the shop</div>
                {memChat.slice(-6).map((c, i) => (
                  <div key={i} className="text-xs py-0.5"><b style={{ color: c.from === "shop" ? "#1B5E20" : "#3A342F" }}>{c.from === "shop" ? BRAND.name : "You"}:</b> {c.text}</div>
                ))}
                <div className="flex gap-2 mt-1">
                  <input className={input} placeholder="Ask us anything…" value={memChatText} onChange={(e) => setMemChatText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") sendMemberMsg(); }} />
                  <button onClick={sendMemberMsg} className="px-3 rounded-lg text-xs font-bold shrink-0" style={{ background: C.green, color: "#fff" }}>Send</button>
                </div>
              </div>
              <div className="rounded-md p-2 mb-2" style={{ background: "#F7F3EF" }}>
                <div className="text-xs font-bold mb-1">📎 Send files to the shop</div>
                <div className="text-[11.5px] text-neutral-500 mb-1">Videos, photos, documents - up to 3 files, 7MB total. They land in the shop inbox with your name on them. (Sends on the deployed app.)</div>
                <input type="file" multiple onChange={sendMemberFiles} className="block text-xs" />
                {memFileMsg && <div className="text-[11.5px] mt-1" style={{ color: "#1B5E20" }}>{memFileMsg}</div>}
              </div>
              <div className="rounded-md p-2" style={{ background: "#F7F3EF" }}>
                <div className="flex items-center gap-2 mb-1">
                  <div className="text-xs font-bold flex-1">🗣 Community</div>
                  {["Ask & Learn", "Tips & Wins", ...(pmMember.donor ? ["Donor Room"] : [])].map((ch) => (
                    <button key={ch} onClick={() => setMemChannel(ch)} className="px-3 py-2 rounded text-[11.5px] font-bold" style={{ background: memChannel === ch ? C.green : "#F2ECE6" }}>{ch}</button>
                  ))}
                </div>
                {memFeed.filter((p) => p.ch === memChannel).slice(0, 8).map((p, i) => (
                  <div key={i} className="text-xs py-1 border-b border-neutral-300"><b style={{ color: "#1B5E20" }}>{p.by}</b> <span className="text-[12px] text-neutral-500">{p.ts}</span><div>{p.text}</div></div>
                ))}
                <div className="flex gap-2 mt-1">
                  <input className={input} placeholder={"Post in " + memChannel + "…"} value={memPost} onChange={(e) => setMemPost(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") postMemberFeed(); }} />
                  <button onClick={postMemberFeed} className="px-3 rounded-lg text-xs font-bold shrink-0" style={{ background: C.green, color: "#fff" }}>Post</button>
                </div>
                <div className="text-[12px] text-neutral-500 mt-1">Neighbor-to-neighbor — verify safety-critical advice with a pro. Guidelines apply; the shop can pause accounts.</div>
              </div>
            </>)}
          </div>
          ) : (
          <div className="rounded-md p-3 mb-3" style={card}>
            <div className="text-sm font-bold mb-1">💚 Support the mission</div>
            <div className="text-[12px] text-neutral-600">Our member community is invite-only right now. You can still be part of the work — <b>become a donor</b> to Peaceful Ministries: text {BRAND.phone} or tap Donate on our website.</div>
          </div>
          )}
          <button onClick={() => setPortalTermsOpen(!portalTermsOpen)} className="w-full py-2 rounded border border-neutral-300 text-xs text-neutral-600 mb-3">View service terms (optional)</button>
          {portalTermsOpen && (
            <div className="rounded-md p-3 mb-3 text-[12px] text-neutral-600" style={card}>Estimates are drafts until approved in writing; final invoices may vary with approved supplements. Payments run through secure third-party processors. Message and data rates may apply to texts; reply STOP anytime to stop updates. Full terms are posted by the shop and available on request.</div>
          )}
          <button onClick={() => { setCustPortal(false); setPortalRes(null); setPortalQ(""); setFaq(""); }} className="w-full py-2 rounded border border-neutral-400 text-sm">← Staff login</button>
        </div>
      </div>
    );
  }

  // ---------- Login gate ----------
  if (!currentTech) {
    if (!staffLoginChosen) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 text-neutral-800" style={{ background: C.ink }}>
          <div className="w-full max-w-sm rounded-lg p-5" style={{ background: C.panel, border: `1px solid ${C.maroon}` }}>
            <div className="text-center mb-4">
              <div className="text-xl font-black tracking-wide">{BRAND.name}</div>
              <div className="text-xs italic" style={{ color: "#2E7D32" }}>{BRAND.tagline}</div>
            </div>
            {(settings.features || {}).portal !== false && (
              <button onClick={() => setCustPortal(true)} className="w-full py-3 rounded-lg text-sm font-bold" style={{ background: C.maroon, color: "#fff" }}>I'm a customer — view my estimate / pay</button>
            )}
            {(settings.features || {}).portal !== false && (
              <button onClick={() => { setCustPortal(true); setMemMode("join"); }} className="w-full mt-2 py-3 rounded-lg text-sm font-semibold text-white" style={{ background: C.green, color: "#fff" }}>🚗 Customer community — free, no repair needed</button>
            )}
            <button onClick={() => setStaffLoginChosen(true)} className="w-full mt-6 py-2 rounded text-xs text-neutral-600 border border-neutral-300">Shop staff login</button>
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-neutral-800" style={{ background: C.ink }}>
        <div className="w-full max-w-sm rounded-lg p-5" style={{ background: C.panel, border: `1px solid ${C.maroon}` }}>
          <div className="text-center mb-4">
            <div className="text-xl font-black tracking-wide">{BRAND.name}</div>
            <div className="text-xs italic" style={{ color: "#2E7D32" }}>{BRAND.tagline}</div>
          </div>
          {supabase && (
            <div className="mb-4">
              <div className="text-sm font-bold mb-2">Staff login</div>
              <span className={label}>Email</span>
              <input className={input} placeholder="you@example.com" inputMode="email" autoComplete="username" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} />
              <span className={label + " mt-2 block"}>Password</span>
              <input className={input} placeholder="Password" type="password" autoComplete="current-password" value={authPass}
                onChange={(e) => setAuthPass(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") supaLogin(); }} />
              <button onClick={supaLogin} disabled={authBusy} className="w-full mt-3 py-2.5 rounded font-bold" style={{ background: C.maroon, color: "#fff", opacity: authBusy ? 0.6 : 1 }}>{authBusy ? "Logging in…" : "Log in"}</button>
              <button onClick={supaForgot} disabled={authBusy} className="w-full mt-2 py-1.5 text-xs text-neutral-600 underline min-h-[40px]">Forgot password? Email me a reset link</button>
              {authMsg && <div className="text-[12px] mt-2 text-center font-semibold" style={{ color: "#8A6D00" }}>{authMsg}</div>}
              <button onClick={() => setPinFallbackOpen(!pinFallbackOpen)} className="w-full mt-3 py-2 rounded text-xs text-neutral-500 border border-neutral-300 min-h-[40px]">{pinFallbackOpen ? "Hide" : "Use"} the old PIN login (fallback)</button>
            </div>
          )}
          {(!supabase || pinFallbackOpen || techs.length === 0) && (techs.length === 0 ? (
            <div>
              <div className="text-sm font-bold mb-2">First run — create the owner login</div>
              <input className={input} placeholder="Your name" value={newTech.name} onChange={(e) => setNewTech({ ...newTech, name: e.target.value })} />
              <input className={input + " mt-2"} placeholder="Choose a PIN (4+ digits)" inputMode="numeric" value={newTech.pin} onChange={(e) => setNewTech({ ...newTech, pin: e.target.value })} />
              <input className={input + " mt-2"} placeholder="Your email (for PIN resets)" inputMode="email" value={newTech.email || ""} onChange={(e) => setNewTech({ ...newTech, email: e.target.value })} />
              {!agreeTerms && <label className="flex items-start gap-2 text-[12px] text-neutral-600 mt-2">
                <input type="checkbox" checked={agreeTerms} onChange={(e) => setAgreeTerms(e.target.checked)} className="mt-0.5" />
                <span>I understand: I review anything the app drafts before it goes out, and prices/hours are estimates until I confirm them. (Asked once — saved after this.)</span>
              </label>}
              <button onClick={async () => {
                if (newTech.name && newTech.pin.trim().length >= 4 && (newTech.email || "").includes("@") && agreeTerms) {
                  const email = (newTech.email || "").trim().toLowerCase();
                  const uname = email.split("@")[0].replace(/[^a-z0-9._-]/g, "");
                  const list = [{ name: newTech.name, username: uname, pin: newTech.pin.trim(), email, empId: (settings.shopId || "PM-0000") + "-T01", role: "Owner", title: "Owner", admin: true }];
                  saveTechs(list); setCurrentTech(list[0]);
                  store.set("terms:accepted", { name: newTech.name, ts: new Date().toISOString() }); // one-time acceptance, on record
                  setMeta((m) => ({ ...m, estimator: m.estimator || newTech.name }));
                  const status = await registerShopForApproval(BRAND.name, (newTech.email || "").trim());
                  setSettings((s) => ({ ...s, shopApprovalStatus: status }));
                  setNewTech({ name: "", pin: "", email: "" }); setErr("");
                } else setErr("Enter a name, an email (for password resets), a password of at least 4 characters, and accept the subscriber terms.");
              }} className="w-full mt-3 py-2.5 rounded font-bold" style={{ background: C.green, color: "#fff" }}>Create owner &amp; enter</button>
            </div>
          ) : (
            <div>
              <div className="text-[11.5px] font-black tracking-wide text-neutral-500 mb-2">SHOP ID: {settings.shopId || "…"}</div>
              <span className={label}>Username</span>
              <select className={input} value={loginSel} onChange={(e) => setLoginSel(Number(e.target.value))}>
                {techs.map((t, i) => <option key={i} value={i}>{t.username || t.name}{t.admin ? " (owner)" : ""}</option>)}
              </select>
              <span className={label + " mt-2 block"}>Password</span>
              <input className={input} placeholder="Password" type="password" value={loginPin}
                onChange={(e) => setLoginPin(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") tryLogin(); }} />
              <button onClick={tryLogin} className="w-full mt-3 py-2.5 rounded font-bold" style={{ background: C.maroon, color: "#fff" }}>Log in</button>
              <button onClick={() => { setForgotOpen(!forgotOpen); setForgotMsg(""); }} className="w-full mt-2 py-1.5 text-xs text-neutral-600 underline">Forgot your password?</button>
              {forgotOpen && (
                <div className="mt-2 rounded-lg p-2" style={{ background: "#F2ECE6" }}>
                  <select className={input} value={forgotSel} onChange={(e) => setForgotSel(Number(e.target.value))}>
                    {techs.map((t, i) => <option key={i} value={i}>{t.name}</option>)}
                  </select>
                  <button onClick={resetPinByEmail} className="w-full mt-2 py-2.5 rounded-lg text-sm font-semibold" style={{ background: C.green, color: "#fff" }}>Email me a temporary PIN</button>
                  {forgotMsg && <div className="text-[12px] mt-2 text-neutral-700">{forgotMsg}</div>}
                </div>
              )}
            </div>
          ))}
          {err && <div className="text-[12px] mt-3 text-center font-semibold" style={{ color: "#8A6D00" }}>{err}</div>}
          <button onClick={() => setStaffLoginChosen(false)} className="w-full mt-4 py-1.5 text-xs text-neutral-500 underline">← Not staff? Go back</button>
          <div className="text-[11.5px] text-neutral-500 mt-4">Password login stamps every job to the right tech and keeps casual eyes out. Forgot your password? Use the link above for an emailed reset, or the owner resets it on the Admin tab.</div>
        </div>
      </div>
    );
  }

  // ---------- Shop approval gate ----------
  if (settings.shopApprovalStatus === "pending") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-neutral-800" style={{ background: C.ink }}>
        <div className="w-full max-w-sm rounded-lg p-5 text-center" style={{ background: C.panel, border: `1px solid ${C.maroon}` }}>
          <div className="text-xl font-black tracking-wide mb-1">{BRAND.name}</div>
          <div className="text-sm font-bold mt-4" style={{ color: "#fcd9a1" }}>Waiting on approval</div>
          <div className="text-xs text-neutral-600 mt-2">Your shop signup is in. The platform owner reviews new shops before they go live — you'll hear back once it's approved.</div>
          <div className="text-[11.5px] text-neutral-500 mt-3">Shop ID: {settings.shopId || "…"}</div>
          <button onClick={checkShopApproval} className="w-full mt-4 py-2 rounded text-sm font-semibold border border-neutral-400">Check again</button>
        </div>
      </div>
    );
  }
  if (settings.shopApprovalStatus === "rejected") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-neutral-800" style={{ background: C.ink }}>
        <div className="w-full max-w-sm rounded-lg p-5 text-center" style={{ background: C.panel, border: `1px solid ${C.maroon}` }}>
          <div className="text-xl font-black tracking-wide mb-1">{BRAND.name}</div>
          <div className="text-sm font-bold mt-4" style={{ color: "#ffb3a8" }}>This shop account isn't active</div>
          <div className="text-xs text-neutral-600 mt-2">Reach out to the platform owner if you think this is a mistake.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-neutral-800 overflow-x-hidden print:bg-white print:text-black" style={{ background: C.ink }}>
      <div className="max-w-6xl mx-auto">
      <style>{`input, select, textarea { caret-color: #4ade80; } input:focus, select:focus, textarea:focus { border-color: #4ade80 !important; box-shadow: 0 0 0 3px rgba(74,222,128,0.35); border-radius: 8px; } input[type=checkbox] { accent-color: #2E7D32; width: 18px; height: 18px; } @media print { .no-print { display:none !important; } * { background: #fff !important; } .print-area { display:block !important; color:#000; } body { background:#fff; } } @media (min-width: 1024px) { .pm-grid-desktop { display:grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; align-items: start; } }`}</style>
      {scanOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 no-print">
          <div className="w-full max-w-md rounded-lg overflow-hidden" style={{ background: C.panel, border: `1px solid ${C.maroon}` }}>
            <div className="flex items-center justify-between px-3 py-2" style={{ background: C.maroon, color: "#fff" }}>
              <span className="text-sm font-bold text-white">Scan the VIN barcode</span>
              <button aria-label="Close scanner" onClick={stopScan} className="p-1 text-white"><X size={18} /></button>
            </div>
            <video ref={scanVideo} playsInline muted className="w-full" />
            <div className="text-[12px] text-neutral-600 p-2">Door jamb, title, or windshield barcode — hold steady. Works best in Chrome on Android; if this browser can't scan, close and type the VIN.</div>
          </div>
        </div>
      )}
      {locConsentOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 no-print">
          <div className="w-full max-w-md rounded-lg overflow-hidden" style={{ background: C.panel, border: `1px solid ${C.green}` }}>
            <div className="flex items-center justify-between px-3 py-2" style={{ background: C.green, color: "#fff" }}>
              <span className="text-sm font-bold text-white">Location sharing — your approval</span>
              <button aria-label="Close" onClick={() => setLocConsentOpen(false)} className="p-1 text-white"><X size={18} /></button>
            </div>
            <div className="p-4 text-sm text-neutral-800 space-y-2">
              <div>Share your live location with <b>{BRAND.name}</b> dispatch <b>while you work</b>, so service advisors can give customers accurate ETAs.</div>
              <div className="text-xs text-neutral-600">• Work hours only — sharing stops the moment you tap Stop, close the app, or end your shift.<br/>• Visible only to shop admins/dispatch. Never sold, never used for anything else.<br/>• Records purge on the shop's retention schedule.<br/>• Your approval is recorded with your name and the time.</div>
              <button onClick={approveLocShare} className="w-full py-2.5 rounded-lg font-bold" style={{ background: C.green, color: "#fff" }}>I approve — start sharing</button>
              <button onClick={() => setLocConsentOpen(false)} className="w-full py-2 rounded-lg text-sm border border-neutral-400">Not now</button>
            </div>
          </div>
        </div>
      )}
      <button onClick={() => setBotOpen(!botOpen)} onDoubleClick={() => setHelpSide(helpSide === "left" ? "right" : helpSide === "right" ? "hidden" : "left")} title="Tap to ask · double-tap to move it or tuck it away" className={"fixed z-40 px-4 py-3 rounded-full font-black text-sm no-print shadow-lg flex items-center gap-2 " + (helpSide === "left" ? "left-3" : "right-3")} style={{ bottom: "13rem", background: C.green, color: "#fff", display: helpSide === "hidden" ? "none" : "flex" }}>
        <Stethoscope size={16} /> Ask
      </button>
      {botOpen && (
        <div className={"fixed z-40 w-80 max-w-[92vw] rounded-lg overflow-hidden no-print shadow-2xl " + (helpSide === "left" ? "left-3" : "right-3")} style={{ bottom: "16.5rem", background: C.panel, border: `1px solid ${C.green}` }}>
          <div className="flex items-center justify-between px-3 py-2" style={{ background: C.green, color: "#fff" }}>
            <span className="text-sm font-bold text-white">Shop assistant</span>
            <span className="flex gap-1">
              <button onClick={() => setBotMode("mech")} className="px-3 py-2 rounded text-[11.5px] font-bold" style={{ background: botMode === "mech" ? "#fff" : "rgba(255,255,255,0.25)", color: botMode === "mech" ? C.green : "#fff" }}>Mechanic</button>
              <button onClick={() => setBotMode("writer")} className="px-3 py-2 rounded text-[11.5px] font-bold" style={{ background: botMode === "writer" ? "#fff" : "rgba(255,255,255,0.25)", color: botMode === "writer" ? C.green : "#fff" }}>Service Writer</button>
              <button onClick={() => setBotMode("legal")} className="px-3 py-2 rounded text-[11.5px] font-bold" style={{ background: botMode === "legal" ? "#fff" : "rgba(255,255,255,0.25)", color: botMode === "legal" ? C.green : "#fff" }}>Legal</button>
            </span>
            <button aria-label="Close assistant" onClick={() => setBotOpen(false)} className="p-1 text-white"><X size={16} /></button>
          </div>
          <div className="p-3">
            <div className="flex gap-2">
              <input className={input} placeholder="Ask anything… (vin, invoice, book)" value={botQ} onChange={(e) => setBotQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") askBot(); }} />
              <button onClick={askBot} className="px-3 rounded-lg font-semibold shrink-0" style={{ background: C.green, color: "#fff" }}>{botBusy ? "…" : "Ask"}</button>
            </div>
            {botA && <div className="text-xs text-neutral-800 mt-2 leading-relaxed">{botA}</div>}
            <div className="text-[11.5px] text-neutral-500 mt-2">Guidance only — never legal, tax, or repair advice. Mechanic mode helps you work; Legal mode explains the app's built-in compliance practices; your professionals make the calls.</div>
            <button onClick={reportProblem} className="w-full mt-2 py-2 rounded-lg text-xs font-semibold border border-neutral-400 text-neutral-700">🐞 Report a problem to the owner (recent errors attach automatically)</button>
          </div>
        </div>
      )}
      <div className="max-w-4xl lg:max-w-6xl mx-auto p-4 lg:p-6 pb-72 no-print">
        {/* Letterhead + workflow status */}
        <div className="rounded-lg overflow-hidden mb-3" style={{ border: `1px solid ${C.line}` }}>
          <div className="px-4 py-3 flex items-center gap-3" style={{ background: C.maroon, color: "#fff" }}>
            <div className="rounded-full p-2" style={{ background: C.maroonDark, color: "#fff" }}><Car size={22} /></div>
            <div className="leading-tight">
              <div className="text-lg font-black tracking-wide" style={{ color: "#fff" }}>{BRAND.name}</div>
              <div className="text-xs italic" style={{ color: "#BFE3C0" }}>{BRAND.tagline}</div>
            </div>
            <div className="ml-auto text-right text-[12px]" style={{ color: "#F0E4E4" }}>Estimate #{meta.number}<br />{meta.date}<br />{currentTech && currentTech.admin && (
              <select className="text-xs rounded-lg px-2 py-2 no-print min-h-[44px]" style={{ background: "#5E1515", color: "#fff", border: "1px solid #9a4444" }} value="" onChange={(e) => { const v = e.target.value; if (v) setTab(v); e.target.value = ""; }} title="Owner menu">
                <option value="">👑 Owner ▾</option>
                <option value="Dashboard">Tech reports</option>
                <option value="Details">Customers &amp; history</option>
                <option value="Bookings">Scheduling</option>
                <option value="Community">Community</option>
                <option value="Fixes & Times">📊 Labor guide &amp; fixes</option>
                <option value="Admin">Account &amp; shop settings</option>
              </select>
            )}
            {helpSide === "hidden" && <button aria-label="Bring back the help button" onClick={() => setHelpSide("left")} className="mr-2 py-2 px-1 inline-block min-h-[40px] text-base">❓</button>}<button aria-label="Switch day/night mode" onClick={() => setSettings({ ...settings, nightMode: !settings.nightMode })} className="mr-2 py-2 px-1 inline-block min-h-[40px] text-base">{settings.nightMode ? "☀️" : "🌙"}</button><button onClick={copyAppLink} className="underline mr-2 py-2 px-1 inline-block min-h-[40px]" style={{ color: "#F0E4E4" }}>copy link</button><button onClick={logOut} className="underline py-2 px-1 inline-block min-h-[40px]" style={{ color: "#F0E4E4" }}>{currentTech.name} · log out</button></div>
          </div>
          <div className="flex" style={{ background: "#111" }}>
            {STATUSES.map((s, i) => (
              <button key={s} onClick={() => setMeta({ ...meta, status: s })}
                className="flex-1 py-2 text-[11.5px] font-semibold flex flex-col items-center gap-1"
                style={{ color: i <= statusIdx ? "#1B5E20" : "#6B625A", borderBottom: i <= statusIdx ? `2px solid ${C.green}` : "2px solid #333" }}>
                {i < statusIdx ? <CheckCircle2 size={13} /> : <Circle size={13} />}{s}
              </button>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="relative sticky top-0 z-40 -mx-4 px-4" style={{ background: C.ink }}>
            {(() => {
              const steps = [
                { tab: "Details", n: 1, label: "Customer & car", done: !!(meta.customer.name || vehicle.ymm) },
                { tab: "Photo Estimate", n: 2, label: "What's wrong", done: !!complaint },
                { tab: "Line Items", n: 3, label: "Build it", done: rows.some((r) => (r.desc || "").trim()) },
                { tab: "Invoice", n: 4, label: "Get paid", done: inv.status === "paid" },
              ];
              const next = steps.find((st) => !st.done);
              return (
                <div className="rounded-md p-2.5 mb-3 no-print" style={{ background: "#fff", border: "1px solid #E2DAD2" }}>
                  <div className="flex gap-1.5">
                    {steps.map((st) => (
                      <button key={st.tab} onClick={() => setTab(st.tab)} className="flex-1 rounded-lg py-2 px-1 text-center"
                        style={{ background: tab === st.tab ? C.green : st.done ? "#EAF3EA" : "#F7F3EF", border: "1px solid " + (tab === st.tab ? C.green : "#E2DAD2") }}>
                        <div className="text-[13px] font-black" style={{ color: tab === st.tab ? "#fff" : st.done ? "#1B5E20" : "#8A8078" }}>{st.done && tab !== st.tab ? "\u2713" : st.n}</div>
                        <div className="text-[12px] font-bold leading-tight" style={{ color: tab === st.tab ? "#fff" : "#3A342F" }}>{st.label}</div>
                      </button>
                    ))}
                  </div>
                  {next && <div className="text-[12px] mt-2 text-center" style={{ color: "#1B5E20" }}><b>Next:</b> step {next.n} &mdash; {next.label}</div>}
                  {!next && <div className="text-[12px] mt-2 text-center font-bold" style={{ color: "#1B5E20" }}>All four steps done.</div>}
                </div>
              );
            })()}
          <div className="flex gap-1.5 mb-1 overflow-x-auto md:flex-wrap md:overflow-visible py-2">
            {TABS.filter(tabEnabled).map((t) => {
              const notifCount = t === "Notifications" ? errLog.length + bookings.filter((b) => b.status === "Requested").length : 0;
              return (
                <button key={t} onClick={() => setTab(t)} className="relative px-3.5 py-2.5 rounded-lg text-[13px] font-semibold whitespace-nowrap min-h-[44px]"
                  style={{ background: tab === t ? C.green : "#F2ECE6", color: tab === t ? "#fff" : "#5A524B" }}>{t}
                  {notifCount > 0 && <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] rounded-full text-[11.5px] font-black flex items-center justify-center px-1" style={{ background: errLog.length > 0 ? "#B3261E" : C.green, color: "#fff" }}>{notifCount}</span>}
                </button>
              );
            })}
          </div>
          <div className="md:hidden pointer-events-none absolute right-4 top-2 bottom-1 w-10" style={{ background: `linear-gradient(90deg, transparent, ${C.ink})` }} />
          <div className="md:hidden text-center text-[11.5px] pb-1" style={{ color: "#6b6b6b" }}>{TABS.filter(tabEnabled).length} tabs total — swipe left/right for more →</div>
        </div>

        {settings.locationOn && (
          <div className="flex items-center gap-2 mb-3 rounded-md px-3 py-2 text-xs no-print" style={card}>
            <MapPin size={14} style={{ color: sharingLoc ? "#1B5E20" : "#888" }} />
            <span className="flex-1">Location sharing for dispatch ETAs: <b>{sharingLoc ? "ON" : "OFF"}</b></span>
            {sharingLoc
              ? <button onClick={stopLoc} className="px-3 py-1 rounded font-semibold" style={{ background: C.maroon, color: "#fff" }}>Stop</button>
              : <button onClick={startLoc} className="px-3 py-1 rounded font-semibold" style={{ background: C.green, color: "#fff" }}>Share my location</button>}
          </div>
        )}
        {draftNote && <div className="text-[13px] rounded px-3 py-2 mb-3 font-semibold flex items-center gap-2" style={{ background: "#EAF3EA", border: "2px solid #2E7D32", color: "#1B5E20" }}><span className="flex-1">💾 {draftNote}</span><button aria-label="Dismiss and discard draft" onClick={() => { setDraftNote(""); try { localStorage.setItem("pm-workdraft", ""); } catch (e) {} }} className="underline text-xs min-h-[40px] px-2">Dismiss</button></div>}
        {err && <div className="text-[13px] rounded px-3 py-2 mb-3 font-semibold" style={{ background: "#FFF6E5", border: "2px solid #B8860B", color: "#6B4E00" }}>{err}</div>}

        {/* ============ DETAILS TAB ============ */}
        {tab === "Details" && (
          <div className="space-y-4">
            {!meta.customer.name && rows.length === 0 && (
              <div className="rounded-md p-3" style={{ background: "#F2F7F2", border: "2px solid #2E7D32" }}>
                <div className="text-base font-black mb-1" style={{ color: "#1B5E20" }}>First day? Do these four things.</div>
                <div className="text-xs" style={{ color: "#3A342F" }}>
                  <div className="py-1"><b>1.</b> Fill in the customer's name and phone right below this box.</div>
                  <div className="py-1"><b>2.</b> Type the vehicle, or tap <b>Browse all vehicles</b> and type a few letters of it.</div>
                  <div className="py-1"><b>3.</b> Go to the <b>Photo Estimate</b> tab and type what the customer said in their own words &mdash; "shaking at 70," "won't start," "grinding when I brake." The app lists the likely repairs with hours and dollars already worked out.</div>
                  <div className="py-1"><b>4.</b> Tap <b>Add</b> beside any of them. That builds the estimate. Then <b>Invoice</b> to print or send it.</div>
                  <div className="mt-2 pt-2" style={{ borderTop: "1px solid #C9DCC9" }}>Not sure how to say something to a customer? Tap the green <b>Ask</b> button, choose <b>Service Writer</b>, and it gives you the words in plain English.</div>
                </div>
              </div>
            )}
            <div className="rounded-md p-3" style={card}>
              <div className="text-sm font-bold mb-1">Shop update log — revisions · changes · corrections</div>
              <div className="text-[12px] text-neutral-500 mb-2">This shop's own record, written in this shop's own words. Entries save with the date and who wrote them.</div>
              <div className="flex gap-2 flex-wrap">
                <select className={input + " w-36"} value={logType} onChange={(e) => setLogType(e.target.value)}>
                  {["Revision", "Change", "Correction"].map((x) => <option key={x}>{x}</option>)}
                </select>
                <input className={input + " flex-1 min-w-[150px]"} placeholder="What changed?" value={logText} onChange={(e) => setLogText(e.target.value)} />
                <button onClick={addLogEntry} className="px-4 rounded-lg font-semibold" style={{ background: C.green, color: "#fff" }}>Add</button>
              </div>
              {shopLog.map((l, i2) => (
                <div key={i2} className="text-xs py-1.5 border-b border-neutral-300"><b style={{ color: l.type === "Correction" ? "#f0b356" : l.type === "Change" ? "#1B5E20" : "#3A342F" }}>{l.type}</b> · {l.ts} {l.by && "· " + l.by} — {l.text}</div>
              ))}
              {shopLog.length === 0 && <div className="text-xs text-neutral-500">No entries yet — the first one is yours.</div>}
            </div>
            <div className="rounded-md p-3" style={card}>
              <div className="flex items-center gap-2 mb-2"><User size={15} style={{ color: C.green }} /><span className="text-sm font-bold">Customer</span></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input className={input} placeholder="Name" value={meta.customer.name} onChange={(e) => setMeta({ ...meta, customer: { ...meta.customer, name: e.target.value } })} />
                <input className={input} placeholder="Phone" value={meta.customer.phone} onChange={(e) => setMeta({ ...meta, customer: { ...meta.customer, phone: e.target.value } })} />
                <input className={input} placeholder="Email" value={meta.customer.email} onChange={(e) => setMeta({ ...meta, customer: { ...meta.customer, email: e.target.value } })} />
                <input className={input} placeholder="Address" value={meta.customer.address} onChange={(e) => setMeta({ ...meta, customer: { ...meta.customer, address: e.target.value } })} />
              </div>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <label className="flex items-center gap-2 text-xs text-neutral-700">
                  <input type="checkbox" checked={meta.customer.notify !== false} onChange={(e) => setMeta({ ...meta, customer: { ...meta.customer, notify: e.target.checked } })} />
                  Customer OK'd text/email updates
                </label>
                <button onClick={sendUpdate} disabled={meta.customer.notify === false} className="ml-auto px-3 py-2.5 rounded-lg text-xs font-semibold min-h-[44px] disabled:opacity-40" style={{ background: C.green, color: "#fff" }}>Text status update</button>
              </div>
              <div className="text-[11.5px] text-neutral-500 mt-1">Get their OK before texting (TCPA) — this toggle is your consent record. See the compliance guide.</div>
              <button onClick={() => setShowInsurance(!showInsurance)} className="text-xs mt-2 py-2 flex items-center gap-1 min-h-[40px]" style={{ color: C.green }}>
                <ShieldCheck size={13} /> {showInsurance ? "Hide" : "Add"} insurance / claim info
              </button>
              {showInsurance && (
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <input className={input} placeholder="Insurance company" value={meta.insurance.company} onChange={(e) => setMeta({ ...meta, insurance: { ...meta.insurance, company: e.target.value } })} />
                  <input className={input} placeholder="Claim #" value={meta.insurance.claim} onChange={(e) => setMeta({ ...meta, insurance: { ...meta.insurance, claim: e.target.value } })} />
                <input className={input} placeholder="Warranty company (if warranty job)" value={meta.warrCo || ""} onChange={(e) => setMeta({ ...meta, warrCo: e.target.value })} />
                <input className={input} placeholder="Warranty contract / claim #" value={meta.warrNum || ""} onChange={(e) => setMeta({ ...meta, warrNum: e.target.value })} />
                  <input className={input} placeholder="Adjuster" value={meta.insurance.adjuster} onChange={(e) => setMeta({ ...meta, insurance: { ...meta.insurance, adjuster: e.target.value } })} />
                  <input className={input} placeholder="Deductible" value={meta.insurance.deductible} onChange={(e) => setMeta({ ...meta, insurance: { ...meta.insurance, deductible: e.target.value } })} />
                </div>
              )}
            </div>

            <div className="rounded-md p-3" style={card}>
              <div className="flex items-center gap-2 mb-2"><User size={15} style={{ color: C.green }} /><span className="text-sm font-bold">Customer history</span>
                <button onClick={lookupHistory} className="ml-auto px-3 py-2.5 rounded-lg text-xs font-semibold min-h-[44px]" style={{ background: C.green, color: "#fff" }}>Look up</button>
              </div>
              {history === null
                ? <div className="text-[12px] text-neutral-500">Type the customer's name or phone above, then Look up — every prior job, what was done, and what they paid.</div>
                : history.length === 0
                  ? <div className="text-xs text-neutral-500">No prior jobs found on this device. Shared history across every phone turns on with the Supabase database (see the guide).</div>
                  : <div className="space-y-1">{history.map((h, i) => (
                      <div key={i} className="text-xs py-1 border-b border-neutral-300">
                        <b>{h.meta && h.meta.number}</b> · {h.savedAt ? h.savedAt.slice(0, 10) : ""} · {(h.vehicle && h.vehicle.ymm) || "-"} · {money((h.totals && h.totals.grand) || 0)} · {h.folder || "New"}
                        <div className="text-neutral-500">{(h.rows || []).filter((r) => r.desc).map((r) => r.desc).slice(0, 4).join(" · ")}</div>
                      </div>
                    ))}</div>}
            </div>

            <div className="rounded-md p-3" style={card}>
              <div className="flex items-center gap-2 mb-2"><FileText size={15} style={{ color: C.green }} /><span className="text-sm font-bold">Estimate details</span></div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div><span className={label}>Estimate #</span><input className={input} value={meta.number} onChange={(e) => setMeta({ ...meta, number: e.target.value })} /></div>
                <div><span className={label}>Date</span><input className={input} type="date" value={meta.date} onChange={(e) => setMeta({ ...meta, date: e.target.value })} /></div>
                <div><span className={label}>Expires</span><input className={input} type="date" value={meta.expiration} onChange={(e) => setMeta({ ...meta, expiration: e.target.value })} /></div>
              </div>
              <div className="mt-2"><span className={label}>Estimator / technician</span><input className={input} value={meta.estimator} onChange={(e) => setMeta({ ...meta, estimator: e.target.value })} /></div>
            </div>

            <span className={label}>What are we fixing?</span>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((c) => (
                <button key={c.key} onClick={() => setCategory(c.key)} className="px-3 py-2.5 rounded-lg text-xs font-semibold min-h-[44px]"
                  style={{ background: category === c.key ? C.green : "#F2ECE6", color: category === c.key ? "#fff" : "#5A524B" }}>{c.label}</button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><span className={label}>{isLawn ? "Make / Model" : "Vehicle"}</span>
                {!isLawn && (
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    <div><span className="text-[11.5px] text-neutral-500">Year</span>
                      <select className={input + " w-full"} value={ymmSel.year} onChange={(e) => setYmmSel({ ...ymmSel, year: e.target.value })}>
                        <option value="">Year</option>{YMM_YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                      </select></div>
                    <div><span className="text-[11.5px] text-neutral-500">Make</span>
                      <select className={input + " w-full"} value={ymmSel.make} onChange={(e) => setYmmSel({ ...ymmSel, make: e.target.value, model: "" })}>
                        <option value="">Make</option>{YMM_MAKES.map((m) => <option key={m} value={m}>{m}</option>)}
                      </select></div>
                    <div><span className="text-[11.5px] text-neutral-500">Model {ymmLoading ? "…" : ""}</span>
                      <select className={input + " w-full"} value={ymmSel.model} onChange={(e) => setYmmSel({ ...ymmSel, model: e.target.value })} disabled={!ymmModels.length}>
                        <option value="">{ymmModels.length ? "Model" : ymmSel.make ? (ymmLoading ? "Loading…" : "Type below") : "Pick make"}</option>
                        {ymmModels.map((m) => <option key={m} value={m}>{m}</option>)}
                      </select></div>
                  </div>
                )}
                <input className={input} list="pmVehicleList" value={vehicle.ymm} onChange={(e) => setVehicle({ ...vehicle, ymm: e.target.value })} placeholder={isLawn ? "Type or pick from the list" : "Or type it — trim, engine, anything extra"} />
                <button onClick={saveEstimate} className="mt-2 w-full py-2.5 rounded-lg text-sm font-bold" style={{ background: saveMsg ? C.green : "#F2ECE6", color: saveMsg ? "#fff" : "#1B5E20", border: `2px solid ${C.green}` }}>{saveMsg ? "✓ Saved to the system" : "💾 Save this to the system"}</button>
                <button onClick={() => setShowVehList(!showVehList)} className="mt-1 py-2 text-[12px] underline text-neutral-600 min-h-[40px]">{showVehList ? "Hide" : "Browse all " + POPULAR_VEHICLES.length + " vehicles & equipment"}</button>
                {showVehList && (
                  <div className="mt-2 rounded-lg p-2" style={{ background: "#F7F3EF", border: "1px solid #333" }}>
                    <input className={input + " w-full"} placeholder="Type any letters to filter — e.g. 'sil' or 'diesel'" value={vehSearch} onChange={(e) => setVehSearch(e.target.value)} />
                    <div className="text-[11.5px] text-neutral-500 mt-1">{POPULAR_VEHICLES.filter((v) => v.toLowerCase().includes(vehSearch.toLowerCase())).length} match</div>
                    <div className="mt-1" style={{ maxHeight: "220px", overflowY: "auto" }}>
                      {POPULAR_VEHICLES.filter((v) => v.toLowerCase().includes(vehSearch.toLowerCase())).slice(0, 200).map((v, i) => (
                        <button key={i} onClick={() => { setVehicle({ ...vehicle, ymm: v }); setShowVehList(false); setVehSearch(""); }}
                          className="block w-full text-left px-2 py-1.5 text-xs rounded" style={{ color: "#3A342F" }}>{v}</button>
                      ))}
                    </div>
                  </div>
                )}
                <datalist id="pmVehicleList">{POPULAR_VEHICLES.map((v, i) => <option key={i} value={v} />)}</datalist>
              </div>
              <div><span className={label}>{isLawn ? "Serial #" : "VIN"}</span>
                <div className="flex gap-1">
                  <input className={input} value={vehicle.id} onChange={(e) => setVehicle({ ...vehicle, id: e.target.value })} />
                  {!isLawn && (
                    <button onClick={decodeVin} title="Decode VIN — fills year/make/model from the free NHTSA database"
                      className="px-2 rounded border border-neutral-300 text-neutral-700 shrink-0 text-[11.5px] font-bold" style={{ background: "#F2ECE6" }}>
                      {vinBusy ? <Loader2 size={14} className="animate-spin" /> : "VIN→"}
                    </button>
                  )}
                  {!isLawn && (
                    <button onClick={startScan} title="Scan the VIN barcode with the camera" className="px-2 rounded border border-neutral-300 shrink-0 text-neutral-700" style={{ background: "#F2ECE6" }}><Camera size={14} /></button>
                  )}
                </div></div>
              <div><span className={label}>{isLawn ? "Engine hours" : "Mileage"}</span>
                <input className={input} value={vehicle.use} onChange={(e) => setVehicle({ ...vehicle, use: e.target.value })} /></div>
            </div>

            {isCar && (
              <div><span className={label}>Job type</span>
                <div className="flex rounded overflow-hidden border border-neutral-300 text-xs">
                  {[["both", "Both"], ["collision", "Collision"], ["mechanical", "Mechanical"]].map(([v, l]) => (
                    <button key={v} onClick={() => setJobType(v)} className="flex-1 py-2.5 min-h-[44px]"
                      style={{ background: jobType === v ? C.green : "#F2ECE6", color: jobType === v ? "#fff" : "#5A524B" }}>{l}</button>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-md p-3" style={card}>
              <div className="flex items-center gap-2">
                <Wrench size={15} style={{ color: C.green }} /><span className={label + " mb-0"}>Labor type</span>
              </div>
              {autoRateNote && <div className="text-[12px] mt-1 font-semibold" style={{ color: "#1B5E20" }}>⚡ {autoRateNote}</div>}
              <div className="grid grid-cols-2 gap-2 mt-2">
                {(settings.laborRates || []).map((r, i) => {
                  const active = String(areas[activeArea]?.rate || "") === String(r.rate);
                  return (
                    <button key={i} onClick={() => setAreas(areas.map((a, j) => j === activeArea ? { ...a, rate: r.rate } : a))}
                      className="py-2.5 rounded-lg text-xs font-bold border-2"
                      style={{ borderColor: active ? C.green : "#D8CCC0", background: active ? "rgba(46,125,50,0.18)" : "transparent", color: active ? "#1B5E20" : "#5A524B" }}>
                      {active ? "\u2713 " : ""}{r.name || "Rate " + (i + 1)}<div className="text-[12px] font-normal opacity-80">${r.rate}/hr</div>
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-2 mt-3">
                <MapPin size={15} style={{ color: C.green }} /><span className={label + " mb-0"}>Job area &amp; rate</span>
                <button onClick={() => setShowAreas(!showAreas)} className="ml-auto text-xs text-neutral-600 py-2 px-1 flex items-center gap-1 min-h-[40px]">Manage <ChevronDown size={13} className={showAreas ? "rotate-180" : ""} /></button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                <select className={input} value={activeArea} onChange={(e) => setActiveArea(Number(e.target.value))}>
                  {areas.map((a, i) => <option key={i} value={i}>{a.label || `Area ${i + 1}`}</option>)}
                </select>
                <div className="flex items-center px-3 rounded-lg bg-white border-2 min-h-[52px]" style={{ borderColor: rateNum ? C.green : "#6b520c" }}>
                  <span className="text-neutral-600 text-lg mr-1">$</span>
                  <input className="w-full bg-transparent focus:outline-none py-2 text-xl font-bold" inputMode="decimal"
                    placeholder={settings.defaultRate ? "default: " + settings.defaultRate : "rate/hr"}
                    value={areas[activeArea]?.rate || ""} onChange={(e) => setAreas(areas.map((a, i) => i === activeArea ? { ...a, rate: e.target.value } : a))} />
                  <span className="text-neutral-500 text-sm">/hr</span>
                </div>
              </div>
              <div className="text-[11.5px] text-neutral-500 mt-1">Picking a labor type fills in the rate below — you can still fine-tune it by hand for this one job.</div>
              {showAreas && (
                <div className="mt-3 space-y-2 border-t border-neutral-300 pt-3">
                  {areas.map((a, i) => (
                    <div key={i} className="flex gap-2">
                      <input className={input} placeholder="Area / ZIP" value={a.label} onChange={(e) => setAreas(areas.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} />
                      <input className={input + " w-24"} placeholder="rate" inputMode="decimal" value={a.rate} onChange={(e) => setAreas(areas.map((x, j) => j === i ? { ...x, rate: e.target.value } : x))} />
                      {areas.length > 1 && <button aria-label="Remove" onClick={() => { setAreas(areas.filter((_, j) => j !== i)); setActiveArea(0); }} className="text-neutral-500 hover:text-red-400"><X size={15} /></button>}
                    </div>
                  ))}
                  <button onClick={() => setAreas([...areas, { label: "", rate: settings.defaultRate || "" }])} className="text-sm py-2 flex items-center gap-1" style={{ color: "#1B5E20" }}><Plus size={15} /> Add area (starts at your default rate)</button>
                </div>
              )}
            </div>

            <div className="rounded-md p-3" style={card}>
              <div className="flex items-center gap-2">
                <Store size={15} style={{ color: C.green }} /><span className={label + " mb-0"}>Local parts — {CATEGORIES.find((c) => c.key === category)?.label}</span>
                <button onClick={() => setShowLocal(!showLocal)} className="ml-auto text-xs text-neutral-600 py-2 px-1 flex items-center gap-1 min-h-[40px]">{showLocal ? "Hide" : "Show"} <ChevronDown size={13} className={showLocal ? "rotate-180" : ""} /></button>
              </div>
              {showLocal && (
                <div className="mt-2 space-y-2">
                  {localList.map((s, i) => (<div key={i} className="text-xs"><div className="font-semibold text-neutral-800">{s.name}</div><div className="text-neutral-600">{s.meta}</div></div>))}
                  <div className="text-[11.5px] text-neutral-500 pt-1 border-t border-neutral-300">Independents have no live inventory API — call to confirm.</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============ PHOTOS & AI TAB ============ */}
        {tab === "Photo Estimate" && (
          <div className="space-y-4">
            <div className="flex gap-2 items-start rounded-md px-3 py-2 text-[13px]" style={{ background: "#3a2c07", border: "1px solid #6b520c" }}>
              <AlertTriangle size={16} className="mt-0.5 shrink-0" style={{ color: C.amber }} />
              <span className="text-amber-100">Drafted items land in a <b>staging area</b> below — nothing reaches the quote until you approve it line by line. Labor hours are drafted estimates, not certified guide times — verify against your licensed labor guide (MOTOR/Mitchell/ALLDATA; Autodata for overseas coverage).</span>
            </div>

            <div><span className={label}>Photos (used for estimate + diagnosis)</span>
              <div className="flex flex-wrap gap-2">
                {photos.map((p, i) => (
                  <div key={i} className="relative w-20 h-20 rounded overflow-hidden border border-neutral-300">
                    <img src={p.dataUrl} alt="" className="w-full h-full object-cover" />
                    <button aria-label="Remove" onClick={() => setPhotos(photos.filter((_, j) => j !== i))} className="absolute top-0 right-0 bg-black/70 p-0.5"><X size={12} /></button>
                  </div>
                ))}
                <button onClick={() => fileRef.current?.click()} className="w-20 h-20 rounded border-2 border-dashed border-neutral-400 flex flex-col items-center justify-center text-neutral-600 text-[11.5px]"><Camera size={20} /><span className="mt-1">Add</span></button>
                <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple onChange={onFiles} className="hidden" />
              </div>
            </div>

            <button onClick={analyze} disabled={busy} className="w-full py-3 rounded-md font-bold flex items-center justify-center gap-2" style={{ background: busy ? "#C9BCAE" : C.green }}>
              {busy ? <Loader2 size={18} className="animate-spin" /> : <Wrench size={18} />}{busy ? "Reading the photos…" : "Analyze photos & draft estimate"}
            </button>

            {staged.length > 0 && (
              <div className="rounded-md p-3" style={{ background: C.panel, border: `1px solid ${C.amber}` }}>
                <div className="flex items-center justify-between mb-2 flex-wrap gap-1.5">
                  <span className="text-sm font-bold">Staged AI suggestions — review each</span>
                  <div className="flex gap-1.5">
                    <button onClick={() => { setStaged([]); analyze(); }} disabled={busy} className="text-xs px-2 py-1 rounded border border-neutral-400 flex items-center gap-1"><Loader2 size={12} className={busy ? "animate-spin" : ""} /> Retry</button>
                    <button onClick={approveAllStaged} className="text-xs px-2 py-1 rounded" style={{ background: C.green, color: "#fff" }}>Use all these</button>
                  </div>
                </div>
                <div className="space-y-4">
                  {staged.map((s) => (
                    <div key={s.sid} className="rounded p-2" style={{ background: "#F2ECE6", border: `1px solid ${s.confidence === "high" ? C.green : s.confidence === "med" ? C.amber : C.red}` }}>
                      <div className="text-sm font-semibold">{s.operation}{s.partName ? ` — ${s.partName}` : ""}</div>
                      <div className="flex flex-wrap gap-2 mt-1 text-[11.5px]">
                        <span className="px-1.5 py-0.5 rounded uppercase font-bold" style={{ background: OP_GROUPS.find(g=>g.key===s.opGroup)? "#3d3d3d":"#3d3d3d" }}>{s.opGroup}</span>
                        <span className="text-neutral-600">confidence: {s.confidence}</span>
                        <span className="text-neutral-600">{s.laborHours} hrs</span>
                        {s.needsTeardown && <span className="px-1.5 py-0.5 rounded font-bold" style={{ background: C.red, color: "#fff" }}>needs teardown</span>}
                      </div>
                      {s.note && <div className="text-[12px] text-neutral-500 mt-1">{s.note}</div>}
                      <div className="flex gap-2 mt-2">
                        <button onClick={() => approveStaged(s.sid)} className="flex-1 py-2.5 min-h-[44px] rounded text-xs font-semibold flex items-center justify-center gap-1" style={{ background: C.green, color: "#fff" }}><Check size={13} /> Use this estimate</button>
                        <button onClick={() => rejectStaged(s.sid)} className="px-3 py-1.5 rounded text-xs border border-neutral-400">Reject</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Diagnosis */}
            <div className="rounded-md p-3" style={{ background: C.panel, border: `1px solid ${C.maroon}` }}>
              <div className="flex items-center gap-2 mb-2"><Stethoscope size={16} style={{ color: "#1B5E20" }} /><span className="text-sm font-bold">Diagnosis</span></div>
              <div className="mb-2"><span className={label}>Customer complaint / symptom</span><input className={input} value={complaint} onChange={(e) => setComplaint(e.target.value)} placeholder="e.g. shaking at 70 mph, overheating, won't start" /></div>
              {(() => {
                const m0 = matchSymptom(complaint); const m = m0 ? { ...m0, repairs: rankForVehicle(m0.repairs, vehicle.ymm).slice(0, 12) } : null;
                if (!m) return null;
                return (
                  <div className="rounded-lg p-3 mb-3" style={{ background: "#F2F7F2", border: "2px solid #2E7D32" }}>
                    <div className="text-sm font-black" style={{ color: "#1B5E20" }}>Likely areas &mdash; quote from these</div>
                    <div className="text-[12px] mb-2" style={{ color: "#3A342F" }}>{m.note}</div>
                    {m.repairs.length === 0 && <div className="text-xs text-neutral-600">No direct labor-guide match &mdash; use the repair search below.</div>}
                    {m.repairs.map((r, i) => (
                      <div key={i} className="flex items-center gap-2 py-1.5" style={{ borderTop: i ? "1px solid #D8CCC0" : "none" }}>
                        {(() => { const sh = suggestedHours(r, vehicle.ymm); return (
                        <>
                        <div className="flex-1">
                          <div className="text-xs font-semibold" style={{ color: "#241F1F" }}>{r.name}</div>
                          <div className="text-[12px]"><b style={{ color: "#1B5E20", fontSize: "13px" }}>{sh.hours} hr</b>{rateNum ? <b style={{ color: "#1B5E20" }}> &middot; {money(sh.hours * rateNum)}</b> : null}</div>
                          <div className="text-[12px]" style={{ color: "#8A8078" }}>{r.cat} &middot; {sh.adjusted ? sh.cls + " \u00d7" + sh.mult + " of " : ""}{r.lo}&ndash;{r.hi} hr base</div>
                        </div>
                        <button onClick={() => { setRows([...rows, mkRow({ desc: r.name, hrs: String(bestHours(r).hours) })]); setErr("Added \"" + r.name + "\" at " + bestHours(r).hours + " hr \u2014 edit the hours on the line if this one runs different."); setTimeout(() => setErr(""), 4000); }}
                          className="px-3 py-2 rounded-lg text-[12px] font-bold" style={{ background: C.green, color: "#fff" }}>Add</button>
                        </>
                        ); })()}
                      </div>
                    ))}
                    <div className="text-[11.5px] mt-2" style={{ color: "#6B625A" }}>From your own labor guide &mdash; works offline. Confirm on the vehicle before quoting.</div>
                  </div>
                );
              })()}
              <div className="mb-2"><span className={label}>Recent work / notes</span><input className={input} value={recentWork} onChange={(e) => setRecentWork(e.target.value)} /></div>
              {/^(?=.*(a\/?c|air ?condition|not cold|blow(ing)? hot|heater|hvac|refrigerant|freon))/i.test(complaint) && (
                <div className="rounded-lg p-2.5 mb-2" style={{ background: "#F7F3EF", border: "1px solid #E2DAD2" }}>
                  <div className="text-[12px] font-bold mb-2" style={{ color: "#241F1F" }}>A/C gauge readings <span className="font-normal" style={{ color: "#6B625A" }}>(optional — only if you've got gauges on it)</span></div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div><span className={label}>Low psi</span><input className={input} inputMode="decimal" value={readings.low} onChange={(e) => setReadings({ ...readings, low: e.target.value })} /></div>
                    <div><span className={label}>High psi</span><input className={input} inputMode="decimal" value={readings.high} onChange={(e) => setReadings({ ...readings, high: e.target.value })} /></div>
                    <div><span className={label}>Vent °F</span><input className={input} inputMode="decimal" value={readings.vent} onChange={(e) => setReadings({ ...readings, vent: e.target.value })} /></div>
                    <div><span className={label}>Outside °F</span><input className={input} inputMode="decimal" value={readings.ambient} onChange={(e) => setReadings({ ...readings, ambient: e.target.value })} /></div>
                  </div>
                </div>
              )}
              <button onClick={getDiagnostics} disabled={dxBusy} className="w-full py-2 rounded-md text-sm font-semibold flex items-center justify-center gap-2" style={{ background: dxBusy ? "#C9BCAE" : C.maroon }}>
                {dxBusy ? <Loader2 size={16} className="animate-spin" /> : <Stethoscope size={16} />}{dxBusy ? "Diagnosing…" : "Get diagnostic tips"}
              </button>
              <button onClick={() => { try { navigator.clipboard.writeText([vehicle.ymm, complaint].filter(Boolean).join(" — ")); } catch (e) {} window.open("https://www.identifix.com", "_blank"); }} className="mt-2 w-full py-2 rounded-md text-sm font-semibold border border-neutral-400 text-neutral-800">Open Identifix Direct-Hit (copies vehicle + complaint)</button>
              <button onClick={() => { try { navigator.clipboard.writeText([vehicle.ymm, complaint].filter(Boolean).join(" — ")); } catch (e) {} window.open("https://www.prodemand.com", "_blank"); }} className="mt-2 w-full py-2 rounded-md text-sm font-semibold border border-neutral-400 text-neutral-800">Open Mitchell 1 ProDemand (copies vehicle + complaint)</button>
              <button onClick={() => { setRows((rs) => [...rs, mkRow({ desc: "Warranty diagnostics — cause & correction documented for the warranty administrator", hrs: "1" })]); setErr("Warranty-diagnostic line added to Line Items."); setTimeout(() => setErr(""), 2500); }} className="mt-2 w-full py-2 rounded-md text-sm font-semibold border border-neutral-400 text-neutral-800">＋ Warranty diagnostic line (cause &amp; correction)</button>
              <button onClick={draftFixFromJob} className="mt-2 w-full py-2 rounded-md text-sm font-semibold" style={{ background: C.green, color: "#fff" }}>✅ Publish this repair as a confirmed fix (customer info stripped)</button>
              {dxTips.length > 0 && (
                <div className="mt-3 space-y-2">
                  {dxTips.map((t, i) => (
                    <div key={i} className="rounded p-2 text-xs" style={{ background: "#F2ECE6", borderLeft: `3px solid ${pri(t.priority)}` }}>
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded text-[12px] uppercase font-bold" style={{ background: pri(t.priority), color: "#111" }}>{t.priority}</span>
                        <span className="font-semibold text-neutral-800">{t.check}</span>
                      </div>
                      {t.why && <div className="text-neutral-600 mt-1">{t.why}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-md p-3 text-xs text-neutral-600" style={card}>Customer photos, videos, labels &amp; comments now live on the <b className="text-neutral-800">Media</b> tab.</div>
          </div>
        )}

        {/* ============ LINE ITEMS TAB ============ */}
        {tab === "Line Items" && (
          <div className="space-y-4">
            {vehicle.ymm ? (
              <div className="rounded-md p-3" style={{ background: "#EAF3EA", border: "2px solid #2E7D32" }}>
                <div className="flex items-center gap-2 flex-wrap">
                  <Car size={16} style={{ color: "#1B5E20" }} />
                  <div className="flex-1">
                    <div className="text-sm font-black" style={{ color: "#1B5E20" }}>{vehicle.ymm}</div>
                    <div className="text-[12px]" style={{ color: "#3A342F" }}>
                      {(() => { const c = vehicleClass(vehicle.ymm); return c.mult === 1
                        ? "Standard vehicle — times shown are the base guide times."
                        : `${c.cls} — times below are adjusted \u00d7${c.mult} for the extra access time these take.`; })()}
                    </div>
                    {vehicle.id && <div className="text-[11.5px]" style={{ color: "#6B625A" }}>VIN {vehicle.id}</div>}
                  </div>
                  <button onClick={() => setTab("Details")} className="px-3 py-2 rounded-lg text-[12px] font-bold border" style={{ borderColor: "#2E7D32", color: "#1B5E20" }}>Change</button>
                </div>
              </div>
            ) : (
              <div className="rounded-md p-3" style={{ background: "#FFF6E5", border: "2px solid #B8860B" }}>
                <div className="text-sm font-black" style={{ color: "#6B4E00" }}>No vehicle entered yet</div>
                <div className="text-[12px] mt-1" style={{ color: "#6B4E00" }}>Times below are generic averages until you tell it what you're working on. A Ferrari and a Civic are not the same brake job.</div>
                <button onClick={() => setTab("Details")} className="mt-2 px-3 py-2 rounded-lg text-xs font-bold" style={{ background: C.green, color: "#fff" }}>Add the vehicle</button>
              </div>
            )}
            <div className="rounded-md p-3" style={card}>
              <span className={label}>Quick add from your service menu</span>
              <select className={input} value="" onChange={(e) => { addFromMenu(e.target.value); e.target.value = ""; }}>
                <option value="">Pick a service…</option>
                {SERVICE_MENU.map((m, i) => (
                  <option key={i} value={i}>{m.label}{m.flat != null ? ` — $${m.flat}` : ` — ${m.hrs} hr labor + parts`}</option>
                ))}
              </select>
              <div className="text-[11.5px] text-neutral-500 mt-1">Flat services add at your set price; hourly ones price at this area's labor rate — add parts on the line after.</div>
            </div>
            {OP_GROUPS.map((g) => {
              const glist = rows.filter((r) => r.opGroup === g.key);
              if (!glist.length) return null;
              const gt = groupTotals[g.key];
              return (
                <div key={g.key}>
                  <div className="flex justify-between text-xs font-bold uppercase tracking-wide text-neutral-600 mt-3 mb-1">
                    <span>{g.label}</span><span>{money(gt.parts + gt.labor)}</span>
                  </div>
                  {glist.map((r) => {
                    const p = priceFor(r), labor = num(r.hrs) * rateNum;
                    return (
                      <div key={r.id} className="rounded-md p-2.5 mb-2" style={{ background: C.panel, border: `1px solid ${r.aiDraft ? "#6b520c" : C.line}` }}>
                        <div className="flex items-start gap-2">
                          <input className={input + " flex-1"} placeholder="Operation / description" value={r.desc} onChange={(e) => setRow(r.id, "desc", e.target.value)} />
                          <select className={input + " w-32"} value={r.opGroup} onChange={(e) => setRow(r.id, "opGroup", e.target.value)}>
                            {OP_GROUPS.map((og) => <option key={og.key} value={og.key}>{og.label}</option>)}
                          </select>
                          <button onClick={() => delRow(r.id)} className="p-1.5 text-neutral-500 hover:text-red-400"><Trash2 size={16} /></button>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-1 text-[11.5px]">
                          {r.aiDraft && <span className="px-1.5 py-0.5 rounded" style={{ background: C.amber, color: "#3a2c07" }}>AI DRAFT · APPROVED</span>}
                          {r.confidence && <span className="text-neutral-600">confidence: {r.confidence}</span>}
                          <label className="flex items-center gap-1 text-neutral-600"><input type="checkbox" checked={r.teardown} onChange={(e) => setRow(r.id, "teardown", e.target.checked)} /> needs teardown</label>
                          {r.note && <span className="text-neutral-500">{r.note}</span>}
                        </div>
                        <div className="grid grid-cols-3 gap-2 mt-2">
                          <div><span className={label}>Condition</span>
                            <select className={input} value={r.condition} onChange={(e) => setRow(r.id, "condition", e.target.value)}>
                              {CONDITIONS.map((c) => <option key={c}>{c}</option>)}
                            </select>
                          </div>
                          <div><span className={label}>Part #</span><input className={input} value={r.part} onChange={(e) => setRow(r.id, "part", e.target.value)} /></div>
                          <div><span className={label}>Supplier</span><input className={input} value={r.supplier} onChange={(e) => setRow(r.id, "supplier", e.target.value)} /></div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                          <div><span className={label}>Cost</span>
                            <div className="flex gap-1">
                              <input className={input} inputMode="decimal" value={r.cost} onChange={(e) => setRow(r.id, "cost", e.target.value)} />
                              <button onClick={() => lookupPrice(r.id)} title="Ballpark cost" className="px-2 rounded border border-neutral-300 text-neutral-700 shrink-0" style={{ background: "#F2ECE6" }}>
                                {r.priceBusy ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                              </button>
                              <button onClick={() => openPartsTech(r)} title="Copy this line & open PartsTech" className="px-2 rounded border border-neutral-300 text-[12px] font-black shrink-0" style={{ background: "#F2ECE6", color: "#1B5E20" }}>PT</button>
                              <button onClick={() => openNexpart(r)} title="Copy this line & open Nexpart" className="px-2 rounded border border-neutral-300 text-[12px] font-black shrink-0" style={{ background: "#F2ECE6", color: "#a8c5e8" }}>NX</button>
                              <button onClick={() => openRepairLink(r)} title="Copy this line & open RepairLink (OEM parts)" className="px-2 rounded border border-neutral-300 text-[12px] font-black shrink-0" style={{ background: "#F2ECE6", color: "#fcd9a1" }}>RL</button>
                            </div>
                          </div>
                          <div><span className={label}>Markup %</span><input className={input} inputMode="decimal" value={r.markup} disabled={r.manualPrice} onChange={(e) => setRow(r.id, "markup", e.target.value)} /></div>
                          <div><span className={label}>Customer price {r.manualPrice ? "(manual)" : "(auto)"}</span>
                            <input className={input} inputMode="decimal" value={r.manualPrice ? r.price : p.toFixed(2)}
                              onFocus={() => setRow(r.id, "manualPrice", true)}
                              onChange={(e) => setRow(r.id, "price", e.target.value)} />
                          </div>
                          <div><span className={label}>Core charge</span><input className={input} inputMode="decimal" value={r.core} onChange={(e) => setRow(r.id, "core", e.target.value)} /></div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 mt-2">
                          <div><span className={label}>Labor hrs</span><input className={input} inputMode="decimal" value={r.hrs} onChange={(e) => setRow(r.id, "hrs", e.target.value)} />
                            {currentTech && currentTech.admin && r.desc && num(r.hrs) > 0 && myTimes[r.desc] !== num(r.hrs) && <button onClick={() => pinMyTime(r.desc, r.hrs)} className="text-[11px] underline mt-1 min-h-[32px]" style={{ color: "#7A1F1F" }}>📌 Make {r.hrs} hr MY time for this</button>}</div>
                          <div><span className={label}>Availability</span><input className={input} value={r.availability} onChange={(e) => setRow(r.id, "availability", e.target.value)} /></div>
                          <div><span className={label}>Price date</span><input className={input} type="date" value={r.priceDate} onChange={(e) => setRow(r.id, "priceDate", e.target.value)} /></div>
                        </div>
                        {r.priceSrc && <div className="text-[11.5px] mt-1" style={{ color: C.amber }}>{r.priceSrc}</div>}
                        <div className="flex justify-end gap-4 mt-2 text-xs text-neutral-600"><span>Labor {money(labor)}</span><span className="text-neutral-800 font-semibold">Line {money(p + labor)}</span></div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
            <button onClick={() => setRows([...rows, mkRow()])} className="mt-2 w-full py-2 rounded-md border border-neutral-300 text-sm text-neutral-700 flex items-center justify-center gap-2"><Plus size={16} /> Add line manually</button>
            <button onClick={() => setPasteOpen(!pasteOpen)} className="mt-2 w-full py-2 rounded-md border text-sm font-semibold flex items-center justify-center gap-2" style={{ borderColor: C.green, color: "#1B5E20" }}>📋 {pasteOpen ? "Close" : "Paste parts from your supplier cart"}</button>
            {pasteOpen && (
              <div className="mt-2 rounded-md p-3" style={card}>
                <div className="text-[12px] text-neutral-500 mb-2">Nexpart and PartsTech can&apos;t send your cart back to this app automatically — no supplier offers that connection publicly. Here&apos;s the bridge: on the vendor page, select your cart or quote lines, copy, paste below. Each line with a price becomes an estimate line — part number saved internally, vendor cost as YOUR cost, your markup pricing it out.</div>
                <textarea className={input + " w-full"} rows={5} placeholder={"Example:\n2 x GKN 304166 Axle Shaft Assembly $189.00 $378.00\nVAICO V20-2764 Valve Cover Assembly $287.43"} value={pasteText} onChange={(e) => setPasteText(e.target.value)} />
                <button onClick={parseCart} className="mt-2 w-full py-2 rounded font-bold text-sm" style={{ background: C.green, color: "#fff" }}>Read the cart</button>
                {pasteParsed.length > 0 && (
                  <div className="mt-2">
                    <div className="text-[12px] font-bold mb-1">Found {pasteParsed.length} part{pasteParsed.length > 1 ? "s" : ""} — check before adding:</div>
                    {pasteParsed.map((pp, i) => (
                      <div key={i} className="text-[12px] py-1 border-b border-neutral-300 flex items-center gap-2">
                        <span className="flex-1">{pp.desc}{pp.qty > 1 ? ` ×${pp.qty}` : ""}</span>
                        <span className="text-neutral-500">{pp.part || "no #"}</span>
                        <b>{"$" + pp.extendedCost.toFixed(2)}</b>
                        <button aria-label="Remove" onClick={() => setPasteParsed(pasteParsed.filter((_, j) => j !== i))} className="text-neutral-500 min-h-[40px] px-1"><X size={14} /></button>
                      </div>
                    ))}
                    <button onClick={addParsedParts} className="mt-2 w-full py-2.5 rounded font-bold text-sm" style={{ background: C.maroon, color: "#fff" }}>Add {pasteParsed.length} to the estimate</button>
                  </div>
                )}
                {pasteParsed.length === 0 && pasteText && <div className="text-[12px] mt-2 text-neutral-500">Nothing readable yet — make sure each pasted line includes the price.</div>}
              </div>
            )}
            <div className="mt-3 rounded-md p-3" style={card}>
              <div className="text-sm font-bold mb-1">Fleet packages — one-tap build-out</div>
              <div className="text-[12px] text-neutral-500 mb-2">Bundled labor + typical parts cost for repeat fleet work. Adds every line at once — confirm the parts cost against the actual vehicle before invoicing.</div>
              {FLEET_PACKAGES.map((pkg, i) => (
                <button key={i} onClick={() => applyFleetPackage(pkg)} className="w-full text-left rounded-lg p-2.5 mb-1.5 border border-neutral-300 hover:border-neutral-500">
                  <div className="text-sm font-semibold" style={{ color: "#1B5E20" }}>{pkg.name}</div>
                  <div className="text-[11.5px] text-neutral-500">{pkg.desc} · {pkg.items.length} line items</div>
                </button>
              ))}
            </div>
            <div className="mt-2">
              <label className="text-[12px] text-neutral-500 block mb-1">Or start from a common repair ({COMMON_REPAIRS.length} in the guide — starting-point ranges, always confirm for this vehicle):</label>
              <div className="flex flex-wrap gap-1 mb-2">
                {Object.entries(COMMON_REPAIRS.reduce((g, r) => { g[r.cat] = (g[r.cat] || 0) + 1; return g; }, {})).sort((a, b) => b[1] - a[1]).map(([cat, n]) => (
                  <button key={cat} onClick={() => setRepairSearch(cat)} className="text-[11.5px] px-2 py-1 rounded-full border border-neutral-300" style={{ color: "#5A524B" }}>{cat} <b style={{ color: "#1B5E20" }}>{n}</b></button>
                ))}
              </div>
              <input className={input + " w-full mb-1"} placeholder="Search repairs — type 'brake', 'diesel', 'mower'…" value={repairSearch} onChange={(e) => setRepairSearch(e.target.value)} />
              {repairSearch && (
                <div className="rounded-lg p-2 mb-2" style={{ background: "#F7F3EF", border: "1px solid #333", maxHeight: "200px", overflowY: "auto" }}>
                  {rankForVehicle(COMMON_REPAIRS.filter((r) => (r.name + " " + r.cat).toLowerCase().includes(repairSearch.toLowerCase())), vehicle.ymm).slice(0, 60).map((r, i) => (
                    <button key={i} onClick={() => { const bh = bestHours(r); setRows([...rows, mkRow({ desc: r.name, hrs: String(bh.hours) })]); setRepairSearch(""); setErr("Added \"" + r.name + "\" at " + bh.hours + " hr" + (bh.mine ? " (your time)" : "") + "."); setTimeout(() => setErr(""), 3000); }}
                      className="block w-full text-left px-2 py-1.5 text-xs rounded" style={{ color: "#3A342F" }}>{r.name} <b style={{ color: "#1B5E20" }}>— {bestHours(r).hours} hr</b> {bestHours(r).mine ? <span style={{ color: "#7A1F1F", fontSize: "10px", fontWeight: 700 }}>📌 your time</span> : <span style={{ color: "#8A8078", fontSize: "10px" }}>({r.lo}-{r.hi} base)</span>}</button>
                  ))}
                </div>
              )}
              <select className={input + " w-full"} defaultValue="" onChange={(e) => {
                const idx = Number(e.target.value); if (Number.isNaN(idx)) return;
                const r = COMMON_REPAIRS[idx]; if (!r) return;
                const sh = suggestedHours(r, vehicle.ymm);
                setRows([...rows, mkRow({ desc: r.name, hrs: String(sh.hours) })]);
                e.target.value = "";
              }}>
                <option value="" disabled>Pick a repair…</option>
                {Object.entries(COMMON_REPAIRS.reduce((g, r, i) => { (g[r.cat] = g[r.cat] || []).push([r, i]); return g; }, {})).map(([cat, items]) => (
                  <optgroup key={cat} label={cat}>
                    {items.map(([r, i]) => <option key={i} value={i}>{r.name} — {suggestedHours(r, vehicle.ymm).hours} hr</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* ============ CUSTOMER VIEW TAB ============ */}
        {tab === "Customer View" && (
          <div className="space-y-4">
            <div className="rounded-md p-3" style={card}>
              <div className="text-base font-black mb-1" style={{ color: "#1B5E20" }}>WHAT TO SAY</div>
              <div className="text-[12px] mb-2" style={{ color: "#5A524B" }}>
                Read these out loud &mdash; they already have {meta.customer.name || "the customer"}&apos;s name{(areas[activeArea] && areas[activeArea].label) ? " and their area" : ""} in them. Tap any line to copy it.
              </div>
              {PITCH_LINES.map((pl) => {
                const zip = ((areas[activeArea] && areas[activeArea].label) || "").match(/\d{5}/);
                const line = pl.t(meta.customer.name || "", zip ? zip[0] : "");
                return (
                  <button key={pl.k} onClick={() => { try { navigator.clipboard.writeText(line); } catch (e) {} setErr("Copied \u2014 paste it into a text or read it as-is."); setTimeout(() => setErr(""), 2500); }}
                    className="block w-full text-left rounded-lg p-2.5 mb-2" style={{ background: "#F7F3EF", border: "1px solid #E2DAD2" }}>
                    <div className="text-[11.5px] font-black uppercase tracking-wide" style={{ color: "#1B5E20" }}>{pl.label}</div>
                    <div className="text-xs mt-1" style={{ color: "#241F1F" }}>{line}</div>
                  </button>
                );
              })}
              <div className="text-[11.5px]" style={{ color: "#8A8078" }}>No pressure lines and no manufactured urgency in here on purpose. Tell people the truth and the work comes back.</div>
            </div>

          <div className="print-area rounded-md p-4 bg-white text-black">
            <div className="flex justify-between items-start border-b-2 pb-3 mb-3" style={{ borderColor: C.maroon }}>
              <div><div className="text-2xl font-black" style={{ color: C.maroon }}>{BRAND.name}</div><div className="text-xs italic" style={{ color: C.green }}>{BRAND.tagline}</div></div>
              <div className="text-right text-xs"><div className="font-bold">Estimate #{meta.number}</div><div>{meta.date} · expires {meta.expiration}</div><div className="uppercase font-bold mt-1" style={{ color: C.maroon }}>{meta.status}</div></div>
            </div>
            <div className="grid grid-cols-2 gap-4 text-xs mb-3">
              <div><b>Customer:</b> {meta.customer.name || "-"}<br />{meta.customer.phone || ""} {meta.customer.email || ""}</div>
              <div><b>Vehicle:</b> {vehicle.ymm || "-"}<br />{isLawn ? "Serial" : "VIN"}: {vehicle.id || "-"} · {isLawn ? "Hrs" : "Mi"}: {vehicle.use || "-"}</div>
            </div>
            {meta.insurance.company && <div className="text-xs mb-3"><b>Insurance:</b> {meta.insurance.company} · Claim# {meta.insurance.claim}</div>}
            <table className="w-full text-xs border-collapse mb-3">
              <thead><tr className="border-b-2" style={{ borderColor: "#ccc" }}><th className="text-left py-1">Description</th><th className="text-left py-1">Condition</th><th className="text-right py-1">Parts</th><th className="text-right py-1">Labor</th><th className="text-right py-1">Total</th></tr></thead>
              <tbody>
                {rows.filter((r) => r.desc).map((r) => {
                  const p = priceFor(r), labor = num(r.hrs) * rateNum;
                  return (<tr key={r.id} className="border-b" style={{ borderColor: "#eee" }}>
                    <td className="py-1">{r.desc}{r.teardown ? " (pending teardown confirmation)" : ""}</td>
                    <td className="py-1">{r.condition}</td><td className="py-1 text-right">{money(p)}</td><td className="py-1 text-right">{money(labor)}</td><td className="py-1 text-right font-semibold">{money(p + labor)}</td>
                  </tr>);
                })}
              </tbody>
            </table>
            <div className="flex justify-end mb-4"><div className="w-64 text-xs">
              <div className="flex justify-between py-0.5"><span>Parts</span><span>{money(totals.partsSub)}</span></div>
              <div className="flex justify-between py-0.5"><span>Labor</span><span>{money(totals.laborSub)}</span></div>
              <div className="flex justify-between py-0.5"><span>Sublet</span><span>{money(num(sublet))}</span></div>
              <div className="flex justify-between py-0.5"><span>Supplies</span><span>{money(num(supplies))}</span></div>
              {num(paintMat) > 0 && <div className="flex justify-between py-0.5"><span>Paint &amp; materials</span><span>{money(num(paintMat))}</span></div>}
              <div className="flex justify-between py-0.5"><span>Tax</span><span>{money(totals.tax)}</span></div>
              <div className="flex justify-between py-1 font-black text-sm mt-1" style={{ background: C.maroon, color: "#fff", padding: "6px 8px", borderRadius: 4 }}><span>GRAND TOTAL</span><span>{money(totals.grand)}</span></div>
            </div></div>
            <div className="text-[11.5px] text-neutral-600 border-t pt-2 mb-3">
              <p>Estimate only. Hidden or additional damage found at teardown may require a supplement before work continues.</p>
              <p>Warranty: 12 months / 12,000 miles on parts &amp; labor, whichever comes first.</p>
              <p>Parts prices subject to supplier availability at time of order. Replaced parts are available for return upon request.</p>
              <p>No work beyond this written estimate will be performed without the customer's prior authorization.</p>
            </div>
            <div className="border-t pt-3 no-print">
              <div className="text-xs font-bold mb-2">Authorization to proceed — before any repair begins</div>
              <label className="flex items-center gap-2 text-xs mb-2"><input type="checkbox" checked={authorized} onChange={(e) => { setAuthorized(e.target.checked); if (e.target.checked && !authDate) setAuthDate(todayStr()); }} /> Customer authorizes Peaceful Motors to perform the work described above at the price quoted. No additional work will be performed without further approval.</label>
              {authorized && (
                <div>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <input className="border rounded px-2 py-1 text-xs" placeholder="Customer full name" value={authName} onChange={(e) => setAuthName(e.target.value)} />
                    <input className="border rounded px-2 py-1 text-xs" type="date" value={authDate} onChange={(e) => setAuthDate(e.target.value)} />
                  </div>
                  {!sigTyped ? (
                    <div>
                      <div className="text-[11.5px] text-neutral-600 mb-1">Sign below with your finger or mouse:</div>
                      <canvas ref={sigRef} width={560} height={140}
                        className="w-full border rounded bg-white touch-none" style={{ borderColor: "#999", touchAction: "none" }}
                        onPointerDown={sigStart} onPointerMove={sigMove} onPointerUp={sigEnd} onPointerLeave={sigEnd} />
                      <div className="flex gap-3 mt-1 text-[12px]">
                        <button onClick={sigClear} className="underline text-neutral-600">Clear &amp; re-sign</button>
                        <button onClick={() => setSigTyped(true)} className="underline text-neutral-600">Trouble signing? Type instead</button>
                        {sigData && <span style={{ color: C.green }} className="font-bold">✓ signature captured</span>}
                      </div>
                    </div>
                  ) : (
                    <div className="text-[12px]">Typed signature accepted (pad skipped). <button onClick={() => setSigTyped(false)} className="underline text-neutral-600">Use the signature pad instead</button></div>
                  )}
                </div>
              )}
            </div>
            <div className="no-print">
              <button onClick={sendForApproval} className="w-full py-2.5 rounded-lg font-bold text-sm" style={{ background: C.maroon, color: "#fff" }}>📩 Send to the customer to approve</button>
              {sendApprovalMsg && <div className="text-[12px] mt-1 font-semibold" style={{ color: "#1B5E20" }}>{sendApprovalMsg}</div>}
            </div>
            {authorized && (authName || sigData) && (
              <div className="hidden print:block text-xs mt-4">
                Authorized by: <b>{authName || "customer"}</b> on {authDate}
                {sigData && !sigTyped && <img src={sigData} alt="signature" style={{ height: 60, display: "block", marginTop: 4 }} />}
              </div>
            )}
          </div>
          </div>
        )}

        {/* ============ INVOICE TAB ============ */}
        {tab === "Invoice" && (
          <div className="space-y-4">
            <div className="rounded-md px-3 py-2 flex items-center justify-between" style={{ background: C.maroon, color: "#fff" }}>
              <span className="font-black text-base">INVOICE #{meta.number}</span>
              <span className="text-[12px]">{meta.date}{vehicle.ymm ? " · " + vehicle.ymm : ""}</span>
            </div>
            <div className="rounded-md p-3 no-print" style={card}>
              <div className="text-sm font-bold mb-1">🤝 Assistant tools <span className="text-[11.5px] font-normal text-neutral-500">— drafts for YOUR review; nothing sends itself</span></div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={draftSupplement} disabled={asstBusy} className="py-2.5 rounded font-bold text-xs" style={{ background: C.maroon, color: "#fff", opacity: asstBusy ? 0.6 : 1 }}>{asstBusy && asstKind === "supplement" ? "Drafting…" : "🧾 Draft insurance supplement"}</button>
                <button onClick={draftCustomerExplainer} disabled={asstBusy} className="py-2.5 rounded font-bold text-xs" style={{ background: C.green, color: "#fff", opacity: asstBusy ? 0.6 : 1 }}>{asstBusy && asstKind === "customer" ? "Drafting…" : "💬 Explain it for the customer"}</button>
              </div>
              {asstText && (
                <div className="mt-2">
                  <textarea className={input + " w-full"} rows={8} value={asstText} onChange={(e) => setAsstText(e.target.value)} />
                  <button onClick={() => { navigator.clipboard.writeText(asstText); setErr("Copied — paste it wherever it needs to go."); setTimeout(() => setErr(""), 2500); }} className="mt-1 w-full py-2 rounded text-xs font-bold border border-neutral-400">Copy the draft</button>
                </div>
              )}
            </div>
            {currentTech && currentTech.admin && (() => {
              // ---------- Profit check (Phase 3) — owner/admin eyes only ----------
              // Real margin math from the same rows the invoice bills from:
              // what the parts cost you vs. what they sell for, plus labor.
              const partsCost = rows.reduce((s, r) => s + num(r.cost), 0);
              const partsCharge = totals.partsSub;
              const laborCharge = totals.laborSub;
              const revenue = partsCharge + laborCharge + num(inv.serviceCall) - num(inv.diagCredit);
              const profit = revenue - partsCost;
              const marginPct = revenue > 0 ? Math.round((profit / revenue) * 100) : 0;
              const thin = revenue > 0 && marginPct < 30;
              return (
                <div className="rounded-md p-3 no-print" style={{ ...card, border: `1px solid ${thin ? "#B3261E" : C.green}` }}>
                  <div className="text-sm font-bold mb-1">💰 Profit check <span className="text-[11.5px] font-normal text-neutral-500">(owner view — never prints, never emails)</span></div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[12px]">
                    <div>Parts cost you<br /><b>{money(partsCost)}</b></div>
                    <div>Parts bill out<br /><b>{money(partsCharge)}</b></div>
                    <div>Labor bills out<br /><b>{money(laborCharge)}</b></div>
                    <div>Job profit<br /><b style={{ color: thin ? "#B3261E" : "#1B5E20" }}>{money(profit)} ({marginPct}%)</b></div>
                  </div>
                  {thin && <div className="text-[12px] mt-2 font-semibold" style={{ color: "#B3261E" }}>Margin under 30% — check the parts markup or the hours before this goes out.</div>}
                  {partsCost === 0 && partsCharge > 0 && <div className="text-[12px] mt-2 text-neutral-500">No part costs entered on the lines — profit shown assumes the parts were free, which they weren't. Add costs on Line Items for a real number.</div>}
                </div>
              );
            })()}
            <div className="rounded-md p-3 no-print" style={card}>
              <div className="text-sm font-bold mb-2">Final invoice — flows from your approved lines</div>
              {rows.filter((r) => r.desc).length === 0 && (
                <div className="text-xs rounded px-3 py-2 mb-2" style={{ background: "#3a2c07", border: "1px solid #6b520c", color: "#fcd9a1" }}>
                  No line items yet. Snap photos on the Photos &amp; AI tab, approve the drafted lines, and they populate this invoice automatically.
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div><span className={label}>Invoice #</span><input className={input} placeholder={meta.number.replace("PM-", "INV-")} value={inv.number} onChange={(e) => setInv({ ...inv, number: e.target.value })} /></div>
                <div><span className={label}>Status</span>
                  <select className={input} value={inv.status} onChange={(e) => { setInv({ ...inv, status: e.target.value }); if (e.target.value === "paid" && settings.emailOnPaid !== false) autoReceipt(); }}>
                    <option value="due">BALANCE DUE</option><option value="paid">PAID</option>
                  </select></div>
                <div><span className={label}>Service call $</span><input className={input} inputMode="decimal" value={inv.serviceCall} onChange={(e) => setInv({ ...inv, serviceCall: e.target.value })} /></div>
                <div><span className={label}>Diag credit $</span><input className={input} inputMode="decimal" value={inv.diagCredit} onChange={(e) => setInv({ ...inv, diagCredit: e.target.value })} /></div>
              </div>
              <button onClick={() => setTimeout(() => window.print(), 150)} className="mt-3 w-full py-2.5 rounded font-bold flex items-center justify-center gap-2" style={{ background: C.maroon, color: "#fff" }}><Printer size={16} /> Print / Save PDF invoice</button>
              <button onClick={sendInvoiceEmail} className="mt-2 w-full py-2.5 rounded font-bold flex items-center justify-center gap-2" style={{ background: C.green, color: "#fff" }}><Mail size={16} /> Send invoice by email</button>
              {inv.status === "due" && (settings.stripeLink || "").startsWith("http") && (
                <button onClick={() => { try { navigator.clipboard.writeText(settings.stripeLink); } catch (e) {} window.open(settings.stripeLink, "_blank"); }} className="mt-2 w-full py-2.5 rounded font-bold flex items-center justify-center gap-2" style={{ background: "#1a5fb4" }}>$ Collect payment — Stripe (link copied to text the customer)</button>
              )}
              {inv.status === "due" && (settings.altPayLink || "").startsWith("http") && (
                <button onClick={() => { try { navigator.clipboard.writeText(settings.altPayLink); } catch (e) {} window.open(settings.altPayLink, "_blank"); }} className="mt-2 w-full py-2.5 rounded font-bold flex items-center justify-center gap-2" style={{ background: "#5b21b6" }}>$ Collect via {settings.altPayName || "alt processor"}</button>
              )}
              {inv.status === "due" && (settings.klarnaLink || "").startsWith("http") && (
                <button onClick={() => window.open(settings.klarnaLink, "_blank")} className="mt-2 w-full py-2.5 rounded font-bold flex items-center justify-center gap-2" style={{ background: "#ffb3c7", color: "#17120f" }}>
                  {settings.klarnaLink === "https://www.klarna.com/us/business/" ? "Set up Klarna financing (not active yet)" : "Finance with Klarna"}
                </button>
              )}
              {inv.status === "due" && !(settings.stripeLink || "").startsWith("http") && !(settings.altPayLink || "").startsWith("http") && (
                <div className="mt-2 text-xs rounded px-3 py-2" style={{ background: "#3a2c07", border: "1px solid #6b520c", color: "#fcd9a1" }}>No online payment link configured yet — add a Stripe payment link or another processor's link in Admin so a Pay button shows up here.</div>
              )}
              {inv.status === "paid" && (
                <button onClick={queueCarfax} className="w-full py-2 rounded-lg text-sm font-semibold border border-neutral-400 text-neutral-800 mb-2">🚗 Queue this repair for CARFAX (vehicle + services only — never customer info)</button>
              )}
              {inv.status === "paid" && (
                <button onClick={logJobTimes} className="w-full py-2 rounded-lg text-sm font-semibold border border-neutral-400 text-neutral-800 mb-2">📊 Log this job's times to the labor guide</button>
              )}
              {inv.status === "paid" && meta.customer.notify !== false && (
                <button onClick={() => { const msg = "Thank you for choosing " + BRAND.name + "! If we earned it, a quick Google review means the world: " + (settings.reviewLink || ""); sendTextSmart(meta.customer.phone || "", msg); }} className="mt-2 w-full py-2.5 rounded font-bold flex items-center justify-center gap-2" style={{ background: C.green, color: "#fff" }}>★ Request a Google review by text</button>
              )}
              {askEmail && (
                <div className="mt-2 rounded p-2" style={{ background: "#F2ECE6" }}>
                  <span className={label}>Which email should this default to?</span>
                  <div className="flex gap-2">
                    <input className={input} placeholder="name@example.com" value={emailTo} onChange={(e) => setEmailTo(e.target.value)} />
                    <button onClick={() => { if (emailTo.includes("@")) { const sNew = { ...settings, defaultEmail: emailTo.trim() }; setSettings(sNew); store.set("settings:shop", sNew); setAskEmail(false); setErr("Default email saved — hit Send again."); setTimeout(() => setErr(""), 3000); } }} className="px-3 rounded text-sm font-semibold" style={{ background: C.green, color: "#fff" }}>Save</button>
                    <button onClick={() => setAskEmail(false)} className="px-2 rounded border border-neutral-400 text-sm">✕</button>
                  </div>
                </div>
              )}
            </div>

            <div className="print-area rounded-md p-4 bg-white text-black">
              <div className="flex justify-between items-start border-b-2 pb-3 mb-3" style={{ borderColor: C.maroon }}>
                <div>
                  <div className="text-2xl font-black" style={{ color: C.maroon }}>{BRAND.name}</div>
                  <div className="text-xs italic" style={{ color: C.green }}>{BRAND.tagline}</div>
                  <div className="text-[11.5px] text-neutral-600 mt-1">{BRAND.phone} · {BRAND.email} · {BRAND.site}</div>
                </div>
                <div className="text-right text-xs">
                  <div className="font-black text-xl" style={{ color: C.maroon }}>INVOICE</div>
                  <div>#{inv.number || meta.number.replace("PM-", "INV-")}</div>
                  <div>{meta.date}</div>
                  <div className="inline-block font-black mt-1 px-3 py-1 rounded-full text-[12px]"
                    style={inv.status === "paid" ? { background: "#EAF4E6", color: C.green, border: `1.5px solid ${C.green}` } : { background: "#FDECEC", color: "#B3261E", border: "1.5px solid #B3261E" }}>
                    {inv.status === "paid" ? "PAID — THANK YOU" : "BALANCE DUE"}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-xs mb-3">
                <div><b>Billed to:</b> {meta.customer.name || "-"}<br />{meta.customer.phone || ""} {meta.customer.email || ""}</div>
                <div><b>Vehicle:</b> {vehicle.ymm || "-"}<br />{isLawn ? "Serial" : "VIN"}: {vehicle.id || "-"} · {isLawn ? "Hrs" : "Mi"}: {vehicle.use || "-"}</div>
              </div>
              <table className="w-full text-xs border-collapse mb-3">
                <thead><tr className="border-b-2" style={{ borderColor: "#ccc" }}><th className="text-left py-1">Description</th><th className="text-right py-1">Parts</th><th className="text-right py-1">Labor</th><th className="text-right py-1">Total</th></tr></thead>
                <tbody>
                  {rows.filter((r) => r.desc).map((r) => {
                    const p = priceFor(r), labor = num(r.hrs) * rateNum;
                    return (<tr key={r.id} className="border-b" style={{ borderColor: "#eee" }}>
                      <td className="py-1">{r.desc}</td><td className="py-1 text-right">{money(p)}</td><td className="py-1 text-right">{money(labor)}</td><td className="py-1 text-right font-semibold">{money(p + labor)}</td>
                    </tr>);
                  })}
                </tbody>
              </table>
              <div className="flex justify-end mb-4"><div className="w-64 text-xs">
                <div className="flex justify-between py-0.5"><span>Parts</span><span>{money(totals.partsSub)}</span></div>
                <div className="flex justify-between py-0.5"><span>Labor ({money(rateNum)}/hr)</span><span>{money(totals.laborSub)}</span></div>
                {num(sublet) > 0 && <div className="flex justify-between py-0.5"><span>Sublet</span><span>{money(num(sublet))}</span></div>}
                {num(supplies) > 0 && <div className="flex justify-between py-0.5"><span>Shop supplies</span><span>{money(num(supplies))}</span></div>}
                {num(paintMat) > 0 && <div className="flex justify-between py-0.5"><span>Paint &amp; materials</span><span>{money(num(paintMat))}</span></div>}
                {num(inv.serviceCall) > 0 && <div className="flex justify-between py-0.5"><span>Mobile service call</span><span>{money(num(inv.serviceCall))}</span></div>}
                {totals.tax > 0 && <div className="flex justify-between py-0.5"><span>Tax</span><span>{money(totals.tax)}</span></div>}
                {num(inv.diagCredit) > 0 && <div className="flex justify-between py-0.5"><span>Diagnostic credit</span><span>−{money(num(inv.diagCredit))}</span></div>}
                <div className="flex justify-between py-1.5 px-3 font-black text-sm mt-1 rounded" style={{ background: C.maroon, color: "#fff" }}><span>TOTAL {inv.status === "paid" ? "PAID" : "DUE"}</span><span>{money(invTotal)}</span></div>
              </div></div>
              <div className="text-[11.5px] text-neutral-600 border-t pt-2">
                <p className="mb-1"><b>We accept:</b> All major cards (Stripe) · Apple Pay · Google Pay · Cash App Pay · Klarna · Cash</p>
                <p className="mb-1">Warranty: 12 months / 12,000 miles on parts &amp; labor, whichever comes first. Labor-only guarantee on customer-supplied parts. Replaced parts available for return upon request.</p>
                <p className="mb-1">Serviced by: {meta.estimator || currentTech.name}. Thank you — referrals earn $25 off your next service or a free oil change.</p>
                <div className="flex gap-8 mt-5 text-neutral-500">
                  <div className="flex-1 border-t pt-1" style={{ borderColor: "#999" }}>Customer signature</div>
                  <div className="flex-1 border-t pt-1" style={{ borderColor: "#999" }}>Date</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============ MEDIA TAB ============ */}
        {tab === "Media" && (
          <div className="space-y-4">
            <div className="rounded-md p-3" style={card}>
              <div className="flex items-center gap-2 mb-1"><ImagePlus size={16} style={{ color: C.green }} /><span className="text-sm font-bold">Customer media — photos &amp; videos</span></div>
              <div className="text-[12px] text-neutral-500 mb-2">Label each shot, leave a comment the customer will read, then download the report and text or email that one file — works from phone, tablet, or computer. Keep videos short (under ~20 MB); text big ones directly.</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {custPhotos.map((p, i) => (
                  <div key={i} className="rounded-md p-2" style={{ background: "#F2ECE6", border: `1px solid ${C.line}` }}>
                    <div className="relative rounded overflow-hidden border border-neutral-300">
                      {p.kind === "video"
                        ? <video controls className="w-full max-h-48" src={p.dataUrl} />
                        : <img src={p.dataUrl} alt="" className="w-full max-h-48 object-cover" />}
                      <button aria-label="Remove" onClick={() => setCustPhotos(custPhotos.filter((_, j) => j !== i))} className="absolute top-1 right-1 bg-black/70 rounded p-1"><X size={13} /></button>
                    </div>
                    <input className={input + " mt-2"} placeholder="Label (e.g. RF rotor — before)" value={p.caption || ""} onChange={(e) => setCustPhotos(custPhotos.map((x, j) => j === i ? { ...x, caption: e.target.value } : x))} />
                    <textarea className={input + " mt-1"} rows={2} placeholder="Comment for the customer…" value={p.comment || ""} onChange={(e) => setCustPhotos(custPhotos.map((x, j) => j === i ? { ...x, comment: e.target.value } : x))} />
                  </div>
                ))}
                <button onClick={() => custRef.current?.click()} className="min-h-32 rounded border-2 border-dashed border-neutral-400 flex flex-col items-center justify-center text-neutral-600 text-xs"><Camera size={22} /><span className="mt-1">Add photo / video</span></button>
                <input ref={custRef} type="file" accept="image/*,video/*" capture="environment" multiple onChange={onCustFiles} className="hidden" />
              </div>
              <button onClick={downloadCustomerReport} className="mt-3 w-full py-2.5 rounded font-bold flex items-center justify-center gap-2" style={{ background: C.maroon, color: "#fff" }}><Download size={16} /> Download customer report (share by text/email)</button>
            </div>
          </div>
        )}

        {/* ============ ADMIN TAB ============ */}
        {tab === "Admin" && (
          <div className="space-y-4">
            {PLATFORM_HQ && currentTech && currentTech.admin && (
              <div className="rounded-md p-3" style={{ ...card, border: `2px solid ${C.maroon}` }}>
                <div className="text-base font-black mb-1" style={{ color: settings.nightMode ? "#E8B4B4" : C.maroon }}>👑 Platform HQ — the shops you license</div>
                <div className="text-[12px] text-neutral-500 mb-2">This is command. Every licensed shop lives here with its tier; the tier decides its feature set. Today, enforcement is the onboarding license line below (paste it into the shop's app when you set them up, or when their tier changes). When the shared multi-shop database goes live, this same roster pushes tier changes to their apps automatically — the roster you build now is the roster that system reads.</div>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <input className={input} placeholder="Shop name" value={hqForm.name} onChange={(e) => setHqForm({ ...hqForm, name: e.target.value })} />
                  <input className={input} placeholder="Owner phone/email" value={hqForm.contact} onChange={(e) => setHqForm({ ...hqForm, contact: e.target.value })} />
                  <select className={input} value={hqForm.tier} onChange={(e) => setHqForm({ ...hqForm, tier: e.target.value })}>{Object.keys(TIERS).map((t) => <option key={t}>{t}</option>)}</select>
                  <button onClick={() => { if (!hqForm.name.trim()) return; hqSave([{ ...hqForm, since: new Date().toISOString().slice(0, 10) }, ...hqShops]); setHqForm({ name: "", contact: "", tier: "Founder", status: "Active" }); }} className="py-2 rounded font-bold text-sm" style={{ background: C.green, color: "#fff" }}>+ Add shop</button>
                </div>
                {hqShops.length === 0 && <div className="text-xs text-neutral-500">No licensed shops yet — the first ten get Founder for life.</div>}
                {hqShops.map((sh, i) => (
                  <div key={i} className="py-2 border-b border-neutral-300">
                    <div className="flex items-center gap-2 text-sm">
                      <b className="flex-1">{sh.name} <span className="text-[11px] font-normal text-neutral-500">{sh.contact} · since {sh.since}</span></b>
                      <select className={input + " w-28"} value={sh.tier} onChange={(e) => hqSave(hqShops.map((x, j) => j === i ? { ...x, tier: e.target.value } : x))}>{Object.keys(TIERS).map((t) => <option key={t}>{t}</option>)}</select>
                      <select className={input + " w-24"} value={sh.status} onChange={(e) => hqSave(hqShops.map((x, j) => j === i ? { ...x, status: e.target.value } : x))}>{["Active", "Trial", "Past due", "Cancelled"].map((t) => <option key={t}>{t}</option>)}</select>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11.5px] font-bold" style={{ color: "#1B5E20" }}>${(TIERS[sh.tier] || {}).price}/mo</span>
                      <button onClick={() => { navigator.clipboard.writeText(hqLicenseLine(sh)); setErr("License line copied — paste it into " + sh.name + "'s app during setup."); setTimeout(() => setErr(""), 3500); }} className="text-[11px] underline min-h-[32px]" style={{ color: "#7A1F1F" }}>Copy license line</button>
                      <button aria-label="Remove shop" onClick={() => { if (window.confirm("Remove " + sh.name + " from the roster?")) hqSave(hqShops.filter((_, j) => j !== i)); }} className="text-[11px] underline text-neutral-500 min-h-[32px]">Remove</button>
                    </div>
                  </div>
                ))}
                {hqShops.length > 0 && <div className="text-[12px] font-bold mt-2" style={{ color: "#1B5E20" }}>Monthly run rate: ${hqShops.filter((x) => x.status === "Active").reduce((t, x) => t + ((TIERS[x.tier] || {}).price || 0), 0)}/mo from {hqShops.filter((x) => x.status === "Active").length} active shop(s)</div>}
              </div>
            )}
            <div className="rounded-md p-3" style={card}>
              <div className="text-[13px] font-black mb-2" style={{ color: "#1B5E20" }}>Jump to a section</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[["acct", "Account & access", "Shop ID, logins, passwords"],
                  ["pricing", "Pricing, tax & policy", "Rates, deposits, tax"],
                  ["team", "Your account & team", "Technicians, roles, pay"],
                  ["tools", "Pricing tools & content", "Service menu, markups"],
                  ["system", "System & communication", "Switches, email, texting"]].map(([id, t, sub]) => (
                  <button key={id} onClick={() => { const el = document.getElementById("adm-" + id); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); }}
                    className="text-left rounded-lg p-3" style={{ background: "#F7F3EF", border: "1px solid #E2DAD2" }}>
                    <div className="text-[13px] font-bold" style={{ color: "#241F1F" }}>{t}</div>
                    <div className="text-[11.5px]" style={{ color: "#6B625A" }}>{sub}</div>
                  </button>
                ))}
              </div>
              <div className="text-[11.5px] mt-2" style={{ color: "#6B625A" }}>Set these once when you start. You will not need most of them again.</div>
            </div>
            <div id="adm-acct" className="pt-5 pb-2 px-1 border-b-2" style={{ borderColor: "#7A1F1F", scrollMarginTop: "120px" }}>
              <div className="text-[15px] font-black tracking-widest" style={{ color: "#B3372B" }}>ACCOUNT & ACCESS</div>
              <div className="text-[11.5px] text-neutral-500">Shop ID, logins, password resets</div>
            </div>
            <div className="rounded-md p-3" style={card}>
              <div className="text-base font-black mb-1" style={{ color: "#1B5E20" }}>LOGIN & ACCESS</div>
              <div className="text-[12px] text-neutral-500 mb-2">Three separate logins, none of them sharing a password with the others.</div>
              <div className="text-xs space-y-1.5">
                <div><b>Owner & staff</b> — a 4+ digit PIN per person on the roster below, plus the site-wide password set in your hosting account. Forgot a PIN? "Forgot your PIN?" on the login screen emails a temporary one; the owner can also view or reset any PIN on the roster directly.</div>
                <div><b>Customers</b> — no password to remember or leak. Every portal visit verifies fresh with a code texted or emailed on the spot.</div>
                <div><b>Site-wide password</b> — set once in your hosting account's environment settings (APP_PASSWORD), not inside this app. To change it: update that value where the app is hosted, then redeploy.</div>
              </div>
            </div>
            <div id="adm-pricing" className="pt-5 pb-2 px-1 border-b-2" style={{ borderColor: "#7A1F1F", scrollMarginTop: "120px" }}>
              <div className="text-[15px] font-black tracking-widest" style={{ color: "#B3372B" }}>PRICING, TAX &amp; POLICY</div>
              <div className="text-[11.5px] text-neutral-500">What's required, what's charged, what's shown to customers</div>
            </div>
            <div className="rounded-md p-3" style={card}>
              <div className="text-base font-black mb-1" style={{ color: "#1B5E20" }}>REPAIR ORDER REQUIREMENTS</div>
              <div className="text-[12px] text-neutral-500 mb-2">What must be on file before an estimate starts. A customer can always decline to provide something — that gets recorded, not forced.</div>
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                {[["techOnStart", "Technician assigned"], ["vehicleVin", "VIN"], ["vehicleYMM", "Year / make / model"], ["customerPhone", "Customer phone"], ["customerAddress", "Customer address"]].map(([k, lbl]) => (
                  <label key={k} className="flex items-center gap-2"><input type="checkbox" checked={!!settings.reqFields?.[k]} onChange={(e) => setSettings({ ...settings, reqFields: { ...settings.reqFields, [k]: e.target.checked } })} /> {lbl}</label>
                ))}
              </div>
              <label className="flex items-center gap-2 text-xs mt-2 pt-2 border-t border-neutral-300"><input type="checkbox" checked={!!settings.reqFields?.allowDeclined} onChange={(e) => setSettings({ ...settings, reqFields: { ...settings.reqFields, allowDeclined: e.target.checked } })} /> Allow "customer declined" as an answer to any required field</label>
            </div>
            <div className="rounded-md p-3" style={card}>
              <div className="text-base font-black mb-1" style={{ color: "#1B5E20" }}>LABOR RATES</div>
              <div className="text-[12px] text-neutral-500 mb-2">Standard is the default on new estimates. Pick a different rate per job from the Photo Estimate tab.</div>
              {(settings.laborRates || []).map((r, i) => (
                <div key={i} className="flex items-center gap-2 mb-1.5">
                  <input className={input + " flex-1"} value={r.name} onChange={(e) => { const l = [...settings.laborRates]; l[i] = { ...l[i], name: e.target.value }; setSettings({ ...settings, laborRates: l }); }} />
                  <span className="text-neutral-500 text-sm">$</span>
                  <input className={input + " w-20"} inputMode="decimal" value={r.rate} onChange={(e) => { const l = [...settings.laborRates]; l[i] = { ...l[i], rate: e.target.value }; setSettings({ ...settings, laborRates: l }); }} />
                  <span className="text-neutral-500 text-xs">/hr</span>
                  <button onClick={() => setSettings({ ...settings, laborRates: settings.laborRates.filter((_, j) => j !== i) })} className="text-neutral-500 hover:text-red-400"><Trash2 size={15} /></button>
                </div>
              ))}
              <button onClick={() => setSettings({ ...settings, laborRates: [...(settings.laborRates || []), { name: "", rate: "" }] })} className="text-xs underline" style={{ color: "#1B5E20" }}>+ Add a rate</button>
              <div className="mt-3 pt-2 border-t border-neutral-300">
                <label className="flex items-center gap-2 text-[12.5px] font-bold min-h-[40px]">
                  <input type="checkbox" checked={!!settings.showPartNumbers} onChange={(e) => setSettings({ ...settings, showPartNumbers: e.target.checked })} />
                  Show part numbers on customer documents
                </label>
                <div className="text-[11.5px] text-neutral-500">OFF (recommended): customers see the part description and price only — your part numbers and sourcing stay your business. Part numbers are always kept on the line internally and in your saved records. Missouri estimates need the part identified and its condition (new/used/rebuilt) — the description and condition tag cover that; the number itself is not required.</div>
              </div>
              <div className="mt-3 pt-2 border-t border-neutral-300">
                <div className="text-[12.5px] font-bold mb-1">Auto-rate by vehicle</div>
                <div className="text-[11.5px] text-neutral-500 mb-2">When the vehicle contains the match word, the estimate's labor rate sets itself to this amount (the writer can still override by tapping a labor type). Example: BMW → 170.</div>
                {(settings.rateRules || []).map((ru, i) => (
                  <div key={i} className="flex items-center gap-2 mb-1">
                    <input className={input + " flex-1"} placeholder="Match word (e.g. BMW)" value={ru.match} onChange={(e) => { const l = [...(settings.rateRules || [])]; l[i] = { ...l[i], match: e.target.value }; setSettings({ ...settings, rateRules: l }); }} />
                    <span className="text-xs">$</span>
                    <input className={input + " w-20"} inputMode="decimal" placeholder="170" value={ru.rate} onChange={(e) => { const l = [...(settings.rateRules || [])]; l[i] = { ...l[i], rate: e.target.value }; setSettings({ ...settings, rateRules: l }); }} />
                    <span className="text-xs">/hr</span>
                    <button aria-label="Remove rule" onClick={() => setSettings({ ...settings, rateRules: (settings.rateRules || []).filter((_, j) => j !== i) })} className="text-neutral-500 hover:text-red-400 min-h-[40px] px-1"><Trash2 size={15} /></button>
                  </div>
                ))}
                <button onClick={() => setSettings({ ...settings, rateRules: [...(settings.rateRules || []), { match: "", rate: "" }] })} className="text-xs underline min-h-[40px]" style={{ color: "#1B5E20" }}>+ Add a vehicle rate rule</button>
              </div>
            </div>
            <div className="rounded-md p-3" style={card}>
              <div className="text-base font-black mb-1" style={{ color: "#1B5E20" }}>SALES TAX</div>
              <div className="text-[12px] text-neutral-500 mb-2">Missouri: labor is generally untaxed when separately stated, parts are retail-taxable. Confirm your exact combined rate with a CPA before relying on it.</div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {[["labor", "Labor %"], ["parts", "Parts %"], ["hazmat", "Hazmat %"]].map(([k, lbl]) => (
                  <div key={k}><div className="text-neutral-500 mb-1">{lbl}</div><input className={input} inputMode="decimal" value={settings.salesTax?.[k] || ""} onChange={(e) => setSettings({ ...settings, salesTax: { ...settings.salesTax, [k]: e.target.value } })} /></div>
                ))}
              </div>
            </div>
            <div className="rounded-md p-3" style={card}>
              <div className="text-base font-black mb-1" style={{ color: "#1B5E20" }}>DISCOUNT POLICY</div>
              <div className="text-[12px] text-neutral-500 mb-2">The most you'll authorize off labor or parts on a job, printed on estimates so it's a stated policy, not a guess in the moment.</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><div className="text-neutral-500 mb-1">Labor discount cap %</div><input className={input} inputMode="decimal" value={settings.discountLimits?.labor || ""} onChange={(e) => setSettings({ ...settings, discountLimits: { ...settings.discountLimits, labor: e.target.value } })} /></div>
                <div><div className="text-neutral-500 mb-1">Parts discount cap %</div><input className={input} inputMode="decimal" value={settings.discountLimits?.parts || ""} onChange={(e) => setSettings({ ...settings, discountLimits: { ...settings.discountLimits, parts: e.target.value } })} /></div>
              </div>
            </div>
            <div className="rounded-md p-3" style={card}>
              <div className="text-base font-black mb-1" style={{ color: "#1B5E20" }}>PAYMENT TYPES</div>
              <div className="text-[12px] text-neutral-500 mb-2">Shown to customers on the Customer View and Invoice tabs.</div>
              <div className="flex flex-wrap gap-1.5">
                {(settings.paymentTypes || []).map((p, i) => (
                  <span key={i} className="text-xs px-2 py-1 rounded-full flex items-center gap-1.5" style={{ background: "#F7F3EF", border: "1px solid #333" }}>{p}
                    <button aria-label="Remove" onClick={() => setSettings({ ...settings, paymentTypes: settings.paymentTypes.filter((_, j) => j !== i) })} className="text-neutral-500 hover:text-red-400"><X size={11} /></button>
                  </span>
                ))}
              </div>
              <input className={input + " w-full mt-2"} placeholder="Add a payment type, press Enter" onKeyDown={(e) => { if (e.key === "Enter" && e.target.value.trim()) { setSettings({ ...settings, paymentTypes: [...(settings.paymentTypes || []), e.target.value.trim()] }); e.target.value = ""; } }} />
            </div>
            <div className="rounded-md p-3" style={card}>
              <div className="text-base font-black mb-1" style={{ color: "#1B5E20" }}>CUSTOMER SOURCE</div>
              <div className="text-[12px] text-neutral-500 mb-2">Where jobs come from — pick one per customer on Details, so you know which outreach is actually working.</div>
              <div className="flex flex-wrap gap-1.5">
                {(settings.customerSources || []).map((p, i) => (
                  <span key={i} className="text-xs px-2 py-1 rounded-full flex items-center gap-1.5" style={{ background: "#F7F3EF", border: "1px solid #333" }}>{p}
                    <button aria-label="Remove" onClick={() => setSettings({ ...settings, customerSources: settings.customerSources.filter((_, j) => j !== i) })} className="text-neutral-500 hover:text-red-400"><X size={11} /></button>
                  </span>
                ))}
              </div>
              <input className={input + " w-full mt-2"} placeholder="Add a source, press Enter" onKeyDown={(e) => { if (e.key === "Enter" && e.target.value.trim()) { setSettings({ ...settings, customerSources: [...(settings.customerSources || []), e.target.value.trim()] }); e.target.value = ""; } }} />
            </div>
            <div className="rounded-md p-3" style={card}>
              <div className="text-base font-black mb-1" style={{ color: "#1B5E20" }}>WHAT CUSTOMERS SEE</div>
              <div className="text-[12px] text-neutral-500 mb-2">Labor hours are never itemized to customers, by design — only the total. These two control the rest.</div>
              <label className="flex items-center gap-2 text-xs mb-1.5"><input type="checkbox" checked={settings.custDisplay?.showItemizedParts !== false} onChange={(e) => setSettings({ ...settings, custDisplay: { ...settings.custDisplay, showItemizedParts: e.target.checked } })} /> Show itemized part prices (off = total parts line only)</label>
              <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={!!settings.custDisplay?.showRecPricesDefault} onChange={(e) => setSettings({ ...settings, custDisplay: { ...settings.custDisplay, showRecPricesDefault: e.target.checked } })} /> Show recommended-service prices by default (off = customer taps to reveal)</label>
            </div>
            <div className="rounded-md p-3" style={card}>
              <div className="text-base font-black mb-1" style={{ color: "#1B5E20" }}>SHOP SUPPLY FEE</div>
              <div className="text-[12px] text-neutral-500 mb-2">Optional. Covers rags, fluids disposal, and small consumables that don't get itemized. Leave the rate at 0 to skip it — it never applies unless you set a rate.</div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div><div className="text-neutral-500 mb-1">Rate %</div><input className={input} inputMode="decimal" value={settings.shopSupplyFee?.rate || ""} onChange={(e) => setSettings({ ...settings, shopSupplyFee: { ...settings.shopSupplyFee, rate: e.target.value } })} /></div>
                <div><div className="text-neutral-500 mb-1">Cap $</div><input className={input} inputMode="decimal" value={settings.shopSupplyFee?.cap || ""} onChange={(e) => setSettings({ ...settings, shopSupplyFee: { ...settings.shopSupplyFee, cap: e.target.value } })} /></div>
                <label className="flex items-center gap-1.5 mt-4"><input type="checkbox" checked={!!settings.shopSupplyFee?.taxable} onChange={(e) => setSettings({ ...settings, shopSupplyFee: { ...settings.shopSupplyFee, taxable: e.target.checked } })} /> Taxable</label>
              </div>
              <div className="text-[11.5px] text-neutral-500 mt-2">On the Photo Estimate tab, an "Apply shop fee" button next to the supplies line fills in this rate's math — it never applies itself.</div>
            </div>
            <div className="rounded-md p-3" style={card}>
              <div className="text-base font-black mb-1" style={{ color: "#1B5E20" }}>CUSTOMER EMAILS</div>
              <div className="text-[12px] text-neutral-500 mb-2">Default for automatic emails. You can always send one manually regardless of these.</div>
              <label className="flex items-center gap-2 text-xs mb-1.5"><input type="checkbox" checked={settings.emailOnStart} onChange={(e) => setSettings({ ...settings, emailOnStart: e.target.checked })} /> Send a confirmation when a job is booked</label>
              <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={settings.emailOnPaid} onChange={(e) => setSettings({ ...settings, emailOnPaid: e.target.checked })} /> Send a receipt automatically when marked PAID</label>
            </div>
            <div id="adm-team" className="pt-5 pb-2 px-1 border-b-2" style={{ borderColor: "#7A1F1F", scrollMarginTop: "120px" }}>
              <div className="text-[15px] font-black tracking-widest" style={{ color: "#B3372B" }}>YOUR ACCOUNT &amp; TEAM</div>
              <div className="text-[11.5px] text-neutral-500">Your login, the roster, subscribed shops, legal templates</div>
            </div>
            <div className="rounded-md p-3" style={card}>
              <div className="text-base font-black mb-1" style={{ color: "#1B5E20" }}>ACCOUNT SETTINGS (YOU)</div>
              <div className="text-[12px] text-neutral-500 mb-2">Your own login — separate from the shop-wide settings below.</div>
              {currentTech && !(techs.find((t) => t.name === currentTech.name) || {}).email && (
                <div className="text-xs font-bold mb-2 p-2 rounded" style={{ background: "rgba(179,55,43,0.15)", color: "#ff9e8f" }}>No recovery email on file — if you forget your password, there is no way to reset it until you add one here.</div>
              )}
              {currentTech && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input className={input} value={currentTech.name} disabled title="Name changes: owner edits the roster" />
                  <input className={input} placeholder="My email — needed for password reset" inputMode="email" value={(techs.find((t) => t.name === currentTech.name) || {}).email || ""} onChange={(e) => saveTechs(techs.map((t) => t.name === currentTech.name ? { ...t, email: e.target.value } : t))} />
                  <input className={input} placeholder="My password" value={(techs.find((t) => t.name === currentTech.name) || {}).pin || ""} onChange={(e) => saveTechs(techs.map((t) => t.name === currentTech.name ? { ...t, pin: e.target.value } : t))} />
                </div>
              )}
            </div>
            {currentTech && currentTech.admin && (
              <div className="rounded-md p-3" style={card}>
                <div className="text-base font-black mb-1" style={{ color: "#1B5E20" }}>SUBSCRIBED SHOPS (MASTER VIEW)</div>
                <div className="flex items-center gap-2 text-sm py-1.5 border-b border-neutral-300"><span className="flex-1"><b>{BRAND.name}</b> <span className="text-[12px] text-neutral-500">— this deployment · owner: {(techs.find((t) => t.admin) || {}).name || "-"}</span></span><span className="text-[11.5px] font-black px-2 py-1 rounded-full text-white" style={{ background: C.green, color: "#fff" }}>ACTIVE</span></div>
                <div className="text-[11.5px] text-neutral-500 mt-2">Every subscribing shop lists here with plan, status, and a support jump-in — populated from the shops table the moment cloud accounts switch on. The master login sees all shops; each owner sees only their own.</div>
              </div>
            )}
            {currentTech && currentTech.admin && (
              <div className="rounded-md p-3" style={card}>
                <div className="text-base font-black mb-1" style={{ color: "#1B5E20" }}>PLATFORM BUILD LOG (OWNER ONLY)</div>
                {RELEASE_NOTES.map((r, i2) => (
                  <div key={i2} className="text-xs py-1.5 border-b border-neutral-300"><b className="text-neutral-700">{r[0]}</b> — <span className="text-neutral-500">{r[1]}</span></div>
                ))}
                <div className="text-[11.5px] text-neutral-500 mt-2">Owner logins only; at the cloud tier this panel is master-admin only. Shop-facing notes live in Help → Shop update log.</div>
              </div>
            )}
            {(settings.features || {}).shield === true && currentTech && currentTech.admin && (
              <div className="rounded-md p-3" style={card}>
                <div className="text-base font-black mb-1" style={{ color: "#1B5E20" }}>BUSINESS SHIELD — LEGAL TEMPLATE LIBRARY</div>
                <div className="text-[12px] text-neutral-500 mb-2">Owner-only. Copy or email any template; signed copies go in the shop's legal folder. Have your attorney look over the wording before first use.</div>
                {SHIELD_DOCS.map((d, i) => (
                  <div key={i} className="py-2 border-b border-neutral-300">
                    <div className="flex items-center gap-2 flex-wrap">
                      <b className="text-sm flex-1">{d[0]}</b>
                      <button onClick={() => { try { navigator.clipboard.writeText(d[1]); setErr("Template copied."); setTimeout(() => setErr(""), 2000); } catch (e) {} }} className="px-3 py-2.5 rounded-lg text-xs font-semibold min-h-[44px]" style={{ background: "#F2ECE6", color: "#1B5E20" }}>Copy</button>
                      <select className={input + " w-40"} defaultValue="" onChange={(e) => { const t = techs[Number(e.target.value)]; if (t && t.email) { window.location.href = "mailto:" + t.email + "?subject=" + encodeURIComponent(BRAND.name + " — " + d[0]) + "&body=" + encodeURIComponent(d[1]); } else if (t) { setErr("No email saved for " + t.name + " — add one on the roster."); } e.target.value = ""; }}>
                        <option value="">Email to tech…</option>
                        {techs.map((t, j) => <option key={j} value={j}>{t.name}</option>)}
                      </select>
                    </div>
                    <div className="text-[11.5px] text-neutral-500 mt-1">{d[1].slice(0, 110)}…</div>
                  </div>
                ))}
              </div>
            )}
            {!currentTech.admin ? (
              <div className="rounded-md p-3 text-sm" style={card}>Admin is owner-only. Ask {techs.find((t) => t.admin)?.name || "the owner"} to make roster changes.</div>
            ) : (
              <>
                <div className="rounded-md p-3" style={card}>
                  <div className="text-base font-black mb-1" style={{ color: "#1B5E20" }}>TECHNICIAN LOGINS</div>
                  <div className="text-[12px] text-neutral-500 mb-2">Add someone with their email and they get their own login emailed to them, plus an employee ID tied to this shop. They reset their own password any time from the login screen — you don't have to do it for them. Roles listed here are the ones your shop's enabled features actually support.</div>
                  {techs.map((t, i) => (
                    <div key={i} className="rounded-lg p-2.5 mb-2" style={{ background: "#F2ECE6" }}>
                      <div className="flex items-center flex-wrap gap-2 text-sm">
                        <span className="flex-1 font-semibold">{t.name} {t.admin && <span className="text-[11.5px] px-1.5 py-0.5 rounded ml-1" style={{ background: C.green, color: "#fff" }}>owner</span>}</span>
                        <span className="text-[11.5px] font-mono text-neutral-500">{t.empId || "—"}</span>
                        {!t.admin && <button onClick={() => saveTechs(techs.filter((_, j) => j !== i))} className="text-neutral-500 hover:text-red-400"><Trash2 size={15} /></button>}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                        <select className={input} title="Role" value={t.role || (t.admin ? "Owner" : "Technician")} onChange={(e) => saveTechs(techs.map((x, j) => j === i ? { ...x, role: e.target.value } : x))}>
                          {availableRoles().map((r) => <option key={r}>{r}</option>)}
                        </select>
                        <input className={input} title="Job title (what's on their shirt)" placeholder="title" value={t.title || ""} onChange={(e) => saveTechs(techs.map((x, j) => j === i ? { ...x, title: e.target.value } : x))} />
                        <input className={input} title="Pay ($/hr — owner reference; payroll runs outside the app)" placeholder="pay $/hr" inputMode="decimal" value={t.pay || ""} onChange={(e) => saveTechs(techs.map((x, j) => j === i ? { ...x, pay: e.target.value } : x))} />
                        <input className={input} title="Username (from their email)" placeholder="username" value={t.username || ""} onChange={(e) => saveTechs(techs.map((x, j) => j === i ? { ...x, username: e.target.value } : x))} />
                        <input className={input} title="Email — their password resets go here" placeholder="email" inputMode="email" value={t.email || ""} onChange={(e) => saveTechs(techs.map((x, j) => j === i ? { ...x, email: e.target.value } : x))} />
                        <input className={input} title="Password (they can reset it themselves)" placeholder="password" value={t.pin} onChange={(e) => saveTechs(techs.map((x, j) => j === i ? { ...x, pin: e.target.value } : x))} />
                      </div>
                    </div>
                  ))}
                  <div className="text-xs font-bold mt-3 mb-1">Add a technician</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input className={input} placeholder="Full name" value={newTech.name} onChange={(e) => setNewTech({ ...newTech, name: e.target.value })} />
                    <input className={input} placeholder="Work email (required)" inputMode="email" value={newTech.email || ""} onChange={(e) => setNewTech({ ...newTech, email: e.target.value })} />
                    <select className={input} value={newTech.role} onChange={(e) => setNewTech({ ...newTech, role: e.target.value })}>
                      {availableRoles().filter((r) => r !== "Owner").map((r) => <option key={r}>{r}</option>)}
                    </select>
                    <input className={input} placeholder="Job title (optional)" value={newTech.title || ""} onChange={(e) => setNewTech({ ...newTech, title: e.target.value })} />
                  </div>
                  <div className="text-[11.5px] text-neutral-500 mt-1">Their username becomes the part of the email before the @, and a temporary password is generated and emailed to them automatically.</div>
                  <button onClick={addTechnician} className="mt-2 w-full py-2 rounded text-sm font-semibold" style={{ background: C.green, color: "#fff" }}>Add technician &amp; email their login</button>
                </div>
                <div className="rounded-md p-3" style={card}>
                  <div className="text-sm font-bold mb-1">Shop settings — permanent defaults</div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div><span className={label}>Default labor rate $/hr</span><input className={input} inputMode="decimal" value={settings.defaultRate} onChange={(e) => setSettings({ ...settings, defaultRate: e.target.value })} /></div>
                    <div><span className={label}>Parts gross profit / markup %</span><input className={input} inputMode="decimal" value={settings.defaultMarkup} onChange={(e) => setSettings({ ...settings, defaultMarkup: e.target.value })} /></div>
                    <div><span className={label}>Default send-to email</span><input className={input} placeholder="name@example.com" value={settings.defaultEmail} onChange={(e) => setSettings({ ...settings, defaultEmail: e.target.value })} /></div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                    <div><span className={label}>Stripe payment link (Collect payment button)</span><input className={input} placeholder="https://buy.stripe.com/..." value={settings.stripeLink || ""} onChange={(e) => setSettings({ ...settings, stripeLink: e.target.value })} /></div>
                    <div><span className={label}>Google review link (review request text)</span><input className={input} value={settings.reviewLink || ""} onChange={(e) => setSettings({ ...settings, reviewLink: e.target.value })} /></div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                    <div><span className={label}>Alt processor name (360 Payments / APS…)</span><input className={input} placeholder="360 Payments" value={settings.altPayName || ""} onChange={(e) => setSettings({ ...settings, altPayName: e.target.value })} /></div>
                    <div><span className={label}>Alt processor pay link / virtual terminal URL</span><input className={input} placeholder="https://…" value={settings.altPayLink || ""} onChange={(e) => setSettings({ ...settings, altPayLink: e.target.value })} /></div>
                    <div><span className={label}>Klarna financing link — needs your own Klarna Business merchant account first (real approval process, not automatic)</span><input className={input} placeholder="https://www.klarna.com/us/business/" value={settings.klarnaLink || ""} onChange={(e) => setSettings({ ...settings, klarnaLink: e.target.value })} /></div>
                  </div>
                  <label className="flex items-center gap-2 text-sm mt-3">
                    <input type="checkbox" checked={settings.requireSig} onChange={(e) => setSettings({ ...settings, requireSig: e.target.checked })} />
                    Require customer signature (finger-drawn) before starting the repair
                  </label>
                  <label className="flex items-center gap-2 text-sm mt-2">
                    <input type="checkbox" checked={!!settings.locationOn} onChange={(e) => setSettings({ ...settings, locationOn: e.target.checked })} />
                    Enable tech location sharing (opt-in GPS for dispatch ETAs)
                  </label>
                  <label className="flex items-center gap-2 text-sm mt-2">
                    <input type="checkbox" checked={settings.msgMaster !== false} onChange={(e) => setSettings({ ...settings, msgMaster: e.target.checked })} />
                    Customer messaging enabled shop-wide (off = no texts leave this shop; a customer's own opt-out is never overridden)
                  </label>
                  <label className="flex items-center gap-2 text-sm mt-2">
                    <input type="checkbox" checked={settings.assistantPro !== false} onChange={(e) => setSettings({ ...settings, assistantPro: e.target.checked })} />
                    Assistant Master Elite — master-level depth, built to help masters (flagship tier)
                  </label>
                  <div className="text-[11.5px] text-neutral-500 mt-1">Optional on purpose — if the pad gives you trouble in the field, a typed-name fallback is always one tap away on the estimate.</div>
                  <button onClick={saveSettings} className="mt-2 w-full py-2 rounded text-sm font-semibold" style={{ background: C.green, color: "#fff" }}>{setMsg || "Save settings"}</button>
                  <div className="text-[11.5px] text-neutral-500 mt-1">Markup applies to every new line from now on; the rate fills any area without one. Existing lines keep what they have.</div>
                </div>
                <div id="adm-tools" className="pt-5 pb-2 px-1 border-b-2" style={{ borderColor: "#7A1F1F", scrollMarginTop: "120px" }}>
              <div className="text-[15px] font-black tracking-widest" style={{ color: "#B3372B" }}>PRICING TOOLS &amp; CONTENT</div>
              <div className="text-[11.5px] text-neutral-500">ZIP-based pricing, labor guide subscriptions</div>
            </div>
            <div className="rounded-md p-3" style={card}>
                  <div className="text-base font-black mb-1" style={{ color: "#1B5E20" }}>PARTS MARKUP BY ZIP</div>
                  <div className="text-[12px] text-neutral-500 mb-2">Market guidance: 40–50% parts GP is the common range; denser metro ZIPs support the high end. Applies when the job area's label contains the ZIP. Only admins on YOUR deployment can edit this — cross-shop lockdown (nobody else's shop touching your ZIP rules) ships with the cloud accounts.</div>
                  {(settings.zipMarkups || []).map((z, i) => (
                    <div key={i} className="flex gap-2 mb-1">
                      <input className={input} placeholder="ZIP" value={z.zip} onChange={(e) => setSettings({ ...settings, zipMarkups: settings.zipMarkups.map((x, j) => j === i ? { ...x, zip: e.target.value } : x) })} />
                      <input className={input} placeholder="markup %" inputMode="decimal" value={z.markup} onChange={(e) => setSettings({ ...settings, zipMarkups: settings.zipMarkups.map((x, j) => j === i ? { ...x, markup: e.target.value } : x) })} />
                      <button aria-label="Remove" onClick={() => setSettings({ ...settings, zipMarkups: settings.zipMarkups.filter((_, j) => j !== i) })} className="text-neutral-500 hover:text-red-400"><X size={15} /></button>
                    </div>
                  ))}
                  <button onClick={() => setSettings({ ...settings, zipMarkups: [...(settings.zipMarkups || []), { zip: "", markup: "45" }] })} className="text-xs flex items-center gap-1 mt-1" style={{ color: "#1B5E20" }}><Plus size={13} /> Add ZIP rule</button>
                  <div className="text-[11.5px] text-neutral-500 mt-2">Hit Save settings above to keep changes.</div>
                </div>
                <div className="rounded-md p-3" style={card}>
                  <div className="text-base font-black mb-1" style={{ color: "#1B5E20" }}>SERVICE AREAS</div>
                  <div className="text-[12px] text-neutral-500 mb-2">Tag jobs by area — color-coded on the Bookings board so a full week's map is a glance, not a guess.</div>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {(settings.serviceAreas || []).map((a, i) => (
                      <span key={i} className="text-xs px-2 py-1 rounded-full flex items-center gap-1.5" style={{ background: "#F7F3EF", border: `1px solid ${a.color}` }}>
                        <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: a.color }} />{a.name}
                        <button aria-label="Remove" onClick={() => setSettings({ ...settings, serviceAreas: settings.serviceAreas.filter((_, j) => j !== i) })} className="text-neutral-500 hover:text-red-400"><X size={11} /></button>
                      </span>
                    ))}
                  </div>
                  <input className={input + " w-full"} placeholder="Add an area, press Enter" onKeyDown={(e) => { if (e.key === "Enter" && e.target.value.trim()) { const palette = ["#B3372B", "#2E7D32", "#7A1F1F", "#1a5fb4", "#6b8fd4", "#B8860B"]; setSettings({ ...settings, serviceAreas: [...(settings.serviceAreas || []), { name: e.target.value.trim(), color: palette[(settings.serviceAreas || []).length % palette.length] }] }); e.target.value = ""; } }} />
                </div>
                <div className="rounded-md p-3" style={card}>
                  <div className="text-base font-black mb-1" style={{ color: "#1B5E20" }}>LABOR GUIDES &amp; WIRING — SUBSCRIPTIONS</div>
                  <label className="flex items-center gap-2 text-sm mb-2">
                    <input type="checkbox" checked={!!settings.guidesOn} onChange={(e) => setSettings({ ...settings, guidesOn: e.target.checked })} />
                    Show the Guides tab to techs
                  </label>
                  {GUIDE_SOURCES.map((g) => (
                    <label key={g.key} className="flex items-center gap-2 text-xs py-1 text-neutral-700">
                      <input type="checkbox" checked={!!(settings.guideSubs && settings.guideSubs[g.key])}
                        onChange={(e) => setSettings({ ...settings, guideSubs: { ...(settings.guideSubs || {}), [g.key]: e.target.checked } })} />
                      {g.name}
                    </label>
                  ))}
                  <div className="text-[11.5px] text-neutral-500 mt-1">Check only what you actually pay for — Guides opens YOUR portals; no guide content is copied into the app (copyright-clean, acquisition-safe). Save settings above.</div>
                </div>
                <div id="adm-system" className="pt-5 pb-2 px-1 border-b-2" style={{ borderColor: "#7A1F1F", scrollMarginTop: "120px" }}>
              <div className="text-[15px] font-black tracking-widest" style={{ color: "#B3372B" }}>SYSTEM &amp; COMMUNICATION</div>
              <div className="text-[11.5px] text-neutral-500">What's on, texting, and email</div>
            </div>
            <div className="rounded-md p-3" style={card}>
              <div className="text-base font-black mb-1" style={{ color: "#1B5E20" }}>SHOP APPROVALS (PLATFORM OWNER)</div>
              <div className="text-[12px] text-neutral-500 mb-2">New shops that sign up land here and can't use the tools until you approve them. This needs the shared Supabase database turned on — without it there's no cross-shop registry to review, and a single solo install is simply active, which is correct for one shop.</div>
              <button onClick={loadPendingShops} className="w-full py-2 rounded text-sm font-semibold border border-neutral-400">Refresh pending list</button>
              {pendingShops.length === 0 && <div className="text-xs text-neutral-500 mt-2">No shops waiting.</div>}
              {pendingShops.map((sh, i) => (
                <div key={i} className="rounded-lg p-2.5 mt-2" style={{ background: "#F2ECE6" }}>
                  <div className="text-sm font-bold">{sh.shop_name || "(no name)"} <span className="text-[11.5px] text-neutral-500">{sh.shop_id}</span></div>
                  <div className="text-[12px] text-neutral-600">{sh.owner_email || "no email"}</div>
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => setShopStatus(sh.shop_id, "approved")} className="flex-1 py-2 rounded text-xs font-bold" style={{ background: C.green, color: "#fff" }}>Approve</button>
                    <button onClick={() => setShopStatus(sh.shop_id, "rejected")} className="px-3 py-2 rounded text-xs border border-neutral-400">Reject</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-md p-3" style={card}>
              <div className="text-base font-black mb-1" style={{ color: "#1B5E20" }}>RECORD KEEPING</div>
              <div className="text-[12px] text-neutral-500 mb-2">Closed (Done/Cancelled) booking records older than this get cleared out when you run cleanup — active/open ones are never touched. This is a reasonable small-business default, not legal advice; confirm your real requirement with your own accountant or attorney and adjust the number.</div>
              <div className="flex items-center gap-2">
                <input className={input + " w-20"} inputMode="decimal" value={settings.recordRetentionYears} onChange={(e) => setSettings({ ...settings, recordRetentionYears: e.target.value })} />
                <span className="text-xs text-neutral-600">years to keep closed records</span>
              </div>
              <button onClick={cleanUpOldRecords} className="mt-2 w-full py-2 rounded text-sm font-semibold border border-neutral-400">Clean up old closed records now</button>
            </div>
            <div className="rounded-md p-3" style={card}>
                  <div className="text-base font-black mb-1" style={{ color: "#1B5E20" }}>FEATURE SWITCHES (THIS SHOP)</div>
                  <div className="text-[12px] text-neutral-500 mb-2">Turn whole sections on or off for this shop. Off = the tab disappears for every tech here. With cloud accounts, the master admin flips these per subscriber shop from one screen.</div>
                  {[["bookings", "Bookings board + online booking requests"],
                    ["parts", "Parts catalog + supplier launchers"],
                    ["ai", "Photo Estimate estimating"],
                    ["media", "Media — photos/videos + customer report"],
                    ["portal", "Customer portal (login-screen entrance)"],
                    ["fixes", "Peacefully Accurate — confirmed-fix library"],
                    ["custCommunity", "Customer community (portal login area)"]].map(([k, lbl]) => (
                    <label key={k} className="flex items-center gap-2 text-sm py-1">
                      <input type="checkbox" checked={(settings.features || {})[k] !== false} onChange={(e) => setSettings({ ...settings, features: { ...(settings.features || {}), [k]: e.target.checked } })} />
                      {lbl}
                    </label>
                  ))}
                  <label className="flex items-center gap-2 text-sm py-1">
                    <input type="checkbox" checked={(settings.features || {}).academy === true} onChange={(e) => setSettings({ ...settings, features: { ...(settings.features || {}), academy: e.target.checked } })} />
                    Academy — in-house training modules (premium; priced per tech)
                  </label>
                  <label className="flex items-center gap-2 text-sm py-1">
                    <input type="checkbox" checked={(settings.features || {}).shield === true} onChange={(e) => setSettings({ ...settings, features: { ...(settings.features || {}), shield: e.target.checked } })} />
                    Business Shield — legal template library (premium)
                  </label>
                  <div className="text-[11.5px] text-neutral-500 mt-1">Guides and tech GPS have their own switches above. Premium switches are honest client-side toggles today; tamper-proof per-shop entitlement enforcement lands server-side with cloud accounts.</div>
                  <button onClick={saveSettings} className="mt-2 w-full py-2 rounded text-sm font-semibold" style={{ background: C.green, color: "#fff" }}>{setMsg || "Save these switches"}</button>
                </div>
                <div className="rounded-md p-3" style={card}>
                  <div className="text-base font-black mb-1" style={{ color: "#1B5E20" }}>CONNECTED TOOLS</div>
                  <div className="text-[12px] text-neutral-500 mb-2">What actually talks to this app today — real connections only, nothing checked here that doesn't do anything.</div>
                  <div className="text-xs space-y-1"><b style={{ color: "#1B5E20" }}>Live now:</b>
                    <div>PartsTech, RepairLink &amp; Nexpart — parts pricing (Integrations tab)</div>
                    <div>Stripe — card payments</div>
                    <div>Resend — outbound email &amp; receipts</div>
                    <div>Your phone's own Messages app — every text opens a box, then sends free from your real number</div>
                    <div>CARFAX — service reporting (toggle in Privacy)</div>
                  </div>
                  <div className="text-xs mt-2 pt-2 border-t border-neutral-300 text-neutral-500">Not connected yet: accounting software sync, a full parts-vendor marketplace. Real integrations get added here when they're real — never a checkbox for something that isn't built.</div>
                </div>
                <div className="rounded-md p-3" style={card}>
                  <div className="text-base font-black mb-1" style={{ color: "#1B5E20" }}>TEXTING — FREE, YOUR OWN NUMBER</div>
                  <div className="text-[12px] text-neutral-500 mb-2">No paid texting service running — every text button opens a box with the message ready, then hands off to your own phone's Messages app. Free forever, sends from your real number, works exactly like texting already does.</div>
                  <div className="text-xs space-y-1 text-neutral-600">
                    <div>What this trades away: a customer's text back to you lands in your regular Messages app, not inside this app's inbox — and nothing sends itself in the background without you tapping once.</div>
                    <div>If you ever want a dedicated shop number and true background sending, that is a real paid upgrade (Telnyx or a similar service) — not required to run the shop today.</div>
                  </div>
                  <div className="text-base font-black mb-1 mt-3" style={{ color: "#1B5E20" }}>SHOP EMAIL</div>
                  <div className="text-[12px] text-neutral-500 mb-1">Your business email — receipts, file drop-offs, and reports go here, and every subscriber shop sets its own. Company default: {BRAND.email}. Changing it here changes it everywhere in this app.</div>
                  <input className={input + " w-full"} placeholder={BRAND.email} inputMode="email" value={settings.shopEmail || ""} onChange={(e) => setSettings({ ...settings, shopEmail: e.target.value })} />
                </div>
                {settings.locationOn && (
                  <div className="rounded-md p-3" style={card}>
                    <div className="flex items-center gap-2 mb-2"><MapPin size={15} style={{ color: C.green }} /><span className="text-base font-black" style={{ color: "#1B5E20" }}>TECH LOCATIONS — DISPATCH</span>
                      <button onClick={refreshLocs} className="ml-auto px-3 py-2.5 rounded-lg text-xs font-semibold min-h-[44px]" style={{ background: C.green, color: "#fff" }}>Refresh</button>
                    </div>
                    {locList.length === 0 && <div className="text-xs text-neutral-500">No techs sharing yet. Techs opt in from the bar under the tabs — sharing is consent-based and they can stop anytime.</div>}
                    {locList.map((l, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs py-1.5 border-b border-neutral-300">
                        <span className="flex-1"><b>{l.tech}</b> · {l.ts ? l.ts.slice(11, 16) + " UTC" : ""}</span>
                        <button onClick={() => window.open(`https://www.google.com/maps?q=${l.lat},${l.lng}`, "_blank")} className="px-3 py-1 rounded font-semibold" style={{ background: "#F2ECE6", color: "#1B5E20" }}>Map</button>
                      </div>
                    ))}
                    <div className="text-[11.5px] text-neutral-500 mt-2">This device shows techs saved here; with the Supabase cloud database on, every shop's techs feed one table and the master admin (you) sees all locations across all shops. Legal ground rules: written consent, work hours only, revocable anytime, disclosed in your policy — see Compliance_Roadmap.md; attorney signs off.</div>
                  </div>
                )}
                <div className="rounded-md p-3 text-[12px] text-neutral-600" style={card}>
                  Straight talk: PIN login stamps every estimate to the right tech and keeps casual eyes out. It is NOT bank-grade security — anyone holding an unlocked device can get past it. Password-protect the deployed site in your host's settings (free), and when you go multi-crew we add real per-user accounts.
                </div>
              </>
            )}
          </div>
        )}

        {/* ============ HELP TAB ============ */}
        {tab === "Help" && (
          <div className="rounded-md p-4 text-sm leading-relaxed" style={card}>
            <div className="text-base font-bold mb-2">How to use Peaceful OS</div>
            <ol className="list-decimal ml-5 space-y-2 text-neutral-700">
              <li><b>Log in</b> with your name + PIN. The owner adds techs on the Admin tab.</li>
              <li><b>Details</b> — customer, vehicle (tap <b>VIN→</b> to auto-fill from the VIN), insurance if it's a claim, job area &amp; labor rate.</li>
              <li><b>Photos &amp; AI</b> — snap the damage or problem and hit <b>Analyze</b>. Claude drafts line items into a staging list. <b>Approve each line you agree with</b> — nothing hits the quote until you do. Diagnostic tips work the same way from photos + your gauge readings.</li>
              <li><b>Line Items</b> — quick-add from the service menu, set cost + markup (customer price calculates automatically), tap the magnifier for a ballpark cost. Always confirm real prices with your supplier before quoting.</li>
              <li><b>Customer View</b> — the branded estimate. Print / Save PDF from the bottom bar and get the customer's authorization.</li>
              <li><b>Invoice</b> — your approved lines flow in automatically. Set the service call and diagnostic credit, mark PAID when collected, print or save the PDF.</li>
              <li><b>Save</b> stamps the job to you and feeds the Dashboard. <b>Email</b> opens your mail app prefilled to the shop inbox.</li>
              <li><b>Media</b> — label photos, leave comments the customer reads, attach short videos, then <b>Download customer report</b> and text or email that one file. Works from phone, tablet, or computer.</li>
              <li><b>PartsTech &amp; backup</b> — the <b>PT</b> button on any line copies the vehicle + part and opens PartsTech (paste into its search after login). Dashboard's <b>Backup</b> downloads everything as one JSON file, and Save auto-emails each estimate to the shop inbox on the deployed site.</li>
              <li><b>Put it on your phone:</b> open the deployed site → browser menu → <b>Add to Home Screen</b>. It installs like an app, camera and all.</li>
            </ol>
            <div className="mt-3 text-[12px] text-neutral-500">Two habits: you approve every AI line before it goes out, and photos beat memory — take them.</div>
          </div>
        )}

        {/* ============ BOOKINGS TAB ============ */}
        {tab === "Bookings" && (
          <div className="space-y-4">
            {replyDraft && (
              <div className="rounded-md p-3" style={{ ...card, border: `1px solid ${C.green}` }}>
                <div className="text-sm font-bold mb-1">Drafted reply + ballpark — you edit, you send</div>
                <div className="text-[12px] text-neutral-500 mb-2">To: {replyDraft.name} · {replyDraft.pref === "email" ? (replyDraft.email || "no email on request") : replyDraft.phone} · customer prefers {replyDraft.pref === "email" ? "EMAIL ✉" : "TEXT 📱"}</div>
                <div className="text-xs mb-2"><b className="text-neutral-600">Probable causes (drafted — verify on inspection):</b> {replyDraft.causes.join(" · ")} <b className="text-neutral-600 ml-2">Ballpark:</b> <span style={{ color: "#1B5E20" }}>{money(replyDraft.lo)}–{money(replyDraft.hi)}</span></div>
                <textarea className={input + " w-full"} rows={5} value={replyDraft.msg} onChange={(e) => setReplyDraft({ ...replyDraft, msg: e.target.value })} />
                <div className="flex gap-2 mt-2 flex-wrap">
                  <button onClick={() => sendTextSmart(replyDraft.phone, replyDraft.msg)} className="px-3 py-2 rounded-lg text-sm font-semibold" style={{ background: C.green, color: "#fff" }}>Send by text</button>
                  <button onClick={sendDraftEmail} className="px-3 py-2 rounded-lg text-sm font-semibold border border-neutral-400">Send by email</button>
                  <button onClick={() => { const bk = bookings.find((b2) => b2.key === replyDraft.key); if (bk) bookingToEstimate(bk); }} className="px-3 py-2 rounded-lg text-sm font-semibold" style={{ background: C.maroon, color: "#fff" }}>Open as estimate</button>
                  <button onClick={() => setReplyDraft(null)} className="px-3 py-2 rounded-lg text-sm border border-neutral-400">Close</button>
                </div>
                <div className="text-[11.5px] text-neutral-500 mt-1">Nothing sends until you tap send. The message keeps the STOP line; ballparks are drafted ranges, never quotes.</div>
              </div>
            )}
            <div className="rounded-md p-3" style={card}>
              <div className="text-sm font-bold mb-2">New booking</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input className={input} placeholder="Customer name" value={bkForm.name} onChange={(e) => setBkForm({ ...bkForm, name: e.target.value })} />
                <input className={input} placeholder="Phone" value={bkForm.phone} onChange={(e) => setBkForm({ ...bkForm, phone: e.target.value })} />
              </div>
              <div className="flex gap-2 mt-3">
                <input className={input + " flex-1"} placeholder="VIN (17 characters)" value={bkForm.vin} onChange={(e) => setBkForm({ ...bkForm, vin: e.target.value })} />
                <button onClick={decodeVinForBooking} disabled={bkVinBusy} className="px-4 rounded-lg text-xs font-semibold whitespace-nowrap" style={{ background: C.green, color: "#fff" }}>{bkVinBusy ? "…" : "Decode VIN"}</button>
              </div>
              <input className={input + " w-full mt-3"} list="pmVehicleListBooking" placeholder="Vehicle — type or pick from the list, or decode a VIN above" value={bkForm.vehicle} onChange={(e) => setBkForm({ ...bkForm, vehicle: e.target.value })} />
              <datalist id="pmVehicleListBooking">{POPULAR_VEHICLES.map((v, i) => <option key={i} value={v} />)}</datalist>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                <input className={input} type="date" value={bkForm.date} onChange={(e) => setBkForm({ ...bkForm, date: e.target.value })} />
                <input className={input} type="time" value={bkForm.time} onChange={(e) => setBkForm({ ...bkForm, time: e.target.value })} />
                <select className={input} value={bkForm.tech} onChange={(e) => setBkForm({ ...bkForm, tech: e.target.value })}>
                  <option value="">Assign tech…</option>
                  {techs.map((t, i) => <option key={i} value={t.name}>{t.name}</option>)}
                </select>
              </div>
              <button onClick={() => { const s = firstAvailableSlot(bkForm.date || todayStr()); if (s) { setBkForm({ ...bkForm, date: s.date, time: s.time }); setErr(""); } else setErr("No open slots in the next 30 days."); }} className="mt-2 w-full py-2 rounded text-xs font-semibold border border-neutral-400">⚡ Use first available slot</button>
              {bkForm.date && bkForm.time && slotIsFull(bkForm.date, bkForm.time) && (
                <div className="mt-2 text-xs rounded px-3 py-2" style={{ background: "#3a2c07", border: "1px solid #6b520c", color: "#fcd9a1" }}>That slot is full — {bookingsAt(bkForm.date, bkForm.time).length} booked, {techCapacity()} tech{techCapacity() === 1 ? "" : "s"} available. Pick another time or add a tech in Admin.</div>
              )}
              <input className={input + " mt-3"} placeholder="Notes (what's it doing, where's the vehicle)" value={bkForm.notes} onChange={(e) => setBkForm({ ...bkForm, notes: e.target.value })} />
              <button onClick={saveBooking} className="mt-3 w-full py-2.5 rounded text-sm font-semibold" style={{ background: C.green, color: "#fff" }}>Add booking</button>
              <div className="text-[11.5px] text-neutral-500 mt-2">Customers book themselves from your website (they land here as “Requested” — confirm to Scheduled, then tap Text to open the confirmation in your Messages app). Or add a job yourself with the form above for anyone who called or walked up — no customer app needed either way.</div>
            </div>
            <div className="rounded-md p-4" style={{ background: C.panel, border: `2px solid ${C.green}` }}>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-base font-black tracking-widest" style={{ color: "#1B5E20" }}>📅 SCHEDULE</span>
                <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: "#F2ECE6", color: "#5A524B" }}>{bookings.filter((b2) => b2.status !== "Done" && b2.status !== "Cancelled").length} open</span>
              </div>
              <div className="text-xs text-neutral-600 mb-3">{BRAND.name}{settings.shopId ? " · Shop " + settings.shopId : ""}</div>
              {bookings.length === 0 && <div className="text-sm text-neutral-500 py-2">No bookings yet — add one above, or they land here when customers book from your portal.</div>}
              {bookings.filter((b2) => b2.status === "Requested").map((bk) => (
                <div key={bk.key} className="rounded-lg p-3 mb-2" style={{ background: "#3a2c07", border: "1.5px solid #b8860b" }}>
                  <div className="text-sm font-bold text-amber-100">🌐 NEW REQUEST — {bk.name || "-"} · {bk.vehicle || "-"} {bk.verified && <span className="text-[12px] font-black px-1.5 py-0.5 rounded" style={{ background: "#2E7D32", color: "#fff" }}>✓ VERIFIED</span>} {bk.terms === "declined" && <span className="text-[12px] font-black px-1.5 py-0.5 rounded" style={{ background: "#B8860B", color: "#fff" }}>TERMS DECLINED - NOTED</span>} <span className="text-[12px] font-bold" style={{ color: bk.pref === "email" ? "#1B5E20" : "#fcd9a1" }}>{bk.pref === "email" ? "✉ auto-confirmed by email" : "📱 prefers text — tap Text below to confirm"}</span></div>
                    {bk.photos && bk.photos.length > 0 && (
                      <div className="flex gap-1 mt-1">{bk.photos.map((p, pi) => <img key={pi} src={p} className="h-14 w-14 object-cover rounded" alt="customer" />)}</div>
                    )}
                    {bk.ball && <div className="text-[11.5px] text-neutral-500 mt-1">Customer saw first look: {bk.ball.causes.join(", ")} · {money(bk.ball.lo)}–{money(bk.ball.hi)}</div>}
                  <div className="text-xs mt-0.5" style={{ color: "#e8d5a0" }}>{bk.date} {bk.time} · {bk.phone || ""}{bk.notes ? " · " + bk.notes : ""}</div>
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => setBookingStatus(bk.key, "Scheduled")} className="flex-1 py-2.5 rounded-lg text-sm font-bold" style={{ background: C.green, color: "#fff" }}>✓ Confirm booking</button>
                    <button onClick={() => autoDraft(bk)} className="px-3 py-2.5 rounded-lg text-sm font-bold" style={{ background: "#1a5fb4" }}>⚡ Draft reply</button>
                    <button onClick={() => setBookingStatus(bk.key, "Cancelled")} className="px-3 py-2.5 rounded-lg text-sm border border-neutral-400">Decline</button>
                  </div>
                </div>
              ))}
              {[...new Set(bookings.filter((b2) => b2.status !== "Requested").map((b2) => b2.date || ""))].map((d) => (
                <div key={d} className="mb-4">
                  <div className="text-[12px] font-black uppercase tracking-wider mt-4 mb-2 py-2 px-3 rounded-lg" style={{ background: "#F2ECE6", color: d === todayStr() ? "#1B5E20" : "#999" }}>{d === todayStr() ? "⭐ TODAY — " : ""}{d ? new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) : "No date set"}</div>
                  {bookings.filter((b2) => (b2.date || "") === d && b2.status !== "Requested").map((bk) => (
                    <div key={bk.key} className="rounded-lg p-3 mb-2.5" style={{ background: "#F2ECE6", borderLeft: `4px solid ${bk.status === "Done" ? "#6B625A" : bk.status === "Cancelled" ? "#B3261E" : C.green}` }}>
                      <div className="flex items-center gap-2">
                        <b className="flex-1 text-sm">{bk.time ? bk.time + " · " : ""}{bk.name || "-"} — {bk.vehicle || "-"}</b>
                        <span className="text-[11.5px] font-black px-2 py-1 rounded-full" style={{ background: bk.status === "Scheduled" ? C.green : bk.status === "In Progress" ? "#8a5a00" : bk.status === "Done" ? "#8A8078" : "#B3261E", color: "#fff" }}>{(bk.status || "Scheduled").toUpperCase()}</span>
                      </div>
                      <div className="text-[12px] text-neutral-500 mt-0.5">{bk.source === "portal" ? "🌐 online · " : ""}{bk.tech ? "Tech: " + bk.tech + " · " : ""}{bk.phone || ""}{bk.notes ? " · " + bk.notes : ""}</div>
                      <div className="flex gap-2 mt-2 flex-wrap">
                        <button onClick={() => bookingToEstimate(bk)} className="px-3 py-2 rounded-lg text-xs font-semibold" style={{ background: C.maroon, color: "#fff" }}>Start estimate</button>
                        {bk.status === "Scheduled" && <button onClick={() => bookingText(bk, "otw")} className="px-3 py-2 rounded-lg text-xs font-semibold" style={{ background: "#1a5fb4" }}>🚗 On my way</button>}
                        {bk.status === "Scheduled" && <button onClick={() => bookingText(bk, "rem")} className="px-3 py-2 rounded-lg text-xs font-semibold border border-neutral-400">Remind</button>}
                        {bk.status === "Scheduled" && <button onClick={() => startJob(bk.key)} className="px-3 py-2 rounded-lg text-xs font-semibold" style={{ background: "#8a5a00" }}>🔧 Start job</button>}
                        {(bk.status === "Scheduled" || bk.status === "In Progress") && <button onClick={() => markDoneAndPromptNext(bk.key)} className="px-3 py-2 rounded-lg text-xs font-semibold border border-neutral-400">Mark done</button>}
                        {bk.status !== "Cancelled" && bk.status !== "Done" && <button onClick={() => setBookingStatus(bk.key, "Cancelled")} className="px-3 py-2 rounded-lg text-xs text-neutral-600 border border-neutral-300">Cancel</button>}
                        {(bk.status === "Done" || bk.status === "Cancelled") && <button onClick={() => deleteBooking(bk.key)} title="Delete this closed record" className="px-3 py-2 rounded-lg text-xs text-red-400 border border-neutral-300"><Trash2 size={13} /></button>}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ============ PARTS TAB ============ */}
        {tab === "Parts" && (
          <div className="space-y-4">
            <div className="rounded-md p-3" style={card}>
              <div className="text-sm font-bold mb-1">Filters, bulbs & fluid capacities — by exact vehicle</div>
              <div className="text-[12px] text-neutral-500 mb-2">Same reasoning as part numbers: the exact filter, bulb, or fluid spec depends on engine/trim/options, and a wrong one here could send you chasing the wrong part. AutoZone and O'Reilly both run free, real, currently-maintained year/make/model lookup tools for exactly this — copies your vehicle so you can paste it straight in.</div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => openFitmentLookup("autozone")} className="py-2 rounded-lg text-xs font-semibold border border-neutral-400">AutoZone fitment lookup</button>
                <button onClick={() => openFitmentLookup("oreilly")} className="py-2 rounded-lg text-xs font-semibold border border-neutral-400">O'Reilly fitment lookup</button>
              </div>
            </div>
            <div className="rounded-md p-3" style={card}>
              <div className="text-sm font-bold mb-1">Common parts — typical MSRP range</div>
              <div className="text-[12px] text-neutral-500 mb-2">General reference only — deliberately NOT specific part numbers. A real part number has to match the exact vehicle (engine, trim, options), and a wrong one printed here could send you chasing the wrong part. Look up the real part number in PartsTech/RepairLink for the vehicle in front of you, then save it to your catalog below so it's there next time.</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
                {[
                  ["Brake pads (set, one axle)", "$25 – $90"], ["Brake rotor (each)", "$35 – $120"],
                  ["Alternator", "$120 – $350"], ["Starter", "$100 – $300"], ["Battery", "$100 – $250"],
                  ["Water pump", "$40 – $150"], ["Serpentine belt", "$20 – $60"], ["Radiator", "$100 – $350"],
                  ["Struts (each)", "$60 – $200"], ["CV axle (each)", "$60 – $180"], ["Wheel bearing/hub (each)", "$50 – $180"],
                  ["Spark plug (each)", "$5 – $20"], ["Oxygen sensor", "$40 – $150"], ["Fuel pump", "$80 – $300"],
                  ["Oil filter", "$5 – $15"], ["Air filter", "$10 – $30"], ["Cabin air filter", "$10 – $30"],
                  ["Catalytic converter", "$150 – $600"], ["Muffler", "$60 – $200"],
                ].map(([n, p], i) => <div key={i} className="flex justify-between px-2 py-1 rounded" style={{ background: "#F2ECE6" }}><span>{n}</span><span className="text-neutral-600">{p}</span></div>)}
              </div>
            </div>
            <div className="rounded-md p-3" style={card}>
              <div className="text-sm font-bold mb-1">My parts catalog — your negotiated prices</div>
              <div className="text-[12px] text-neutral-500 mb-2">Build your book here: every part you price through RepairLink, dealer wholesale, or a counter deal gets saved with YOUR cost and YOUR price — that's the parts margin for your parts guy. Straight talk: nobody can hand you "all OEM parts at discounted prices" in one database — OEM discounts come from your RepairLink + dealer wholesale accounts, and this catalog is where those wins accumulate.</div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <input className={input} placeholder="Description" value={ptForm.desc} onChange={(e) => setPtForm({ ...ptForm, desc: e.target.value })} />
                <input className={input} placeholder="Part #" value={ptForm.part} onChange={(e) => setPtForm({ ...ptForm, part: e.target.value })} />
                <input className={input} placeholder="Source" value={ptForm.source} onChange={(e) => setPtForm({ ...ptForm, source: e.target.value })} />
                <input className={input} placeholder="Cost $" inputMode="decimal" value={ptForm.cost} onChange={(e) => setPtForm({ ...ptForm, cost: e.target.value })} />
                <input className={input} placeholder="Sell $ (opt)" inputMode="decimal" value={ptForm.price} onChange={(e) => setPtForm({ ...ptForm, price: e.target.value })} />
              </div>
              <button onClick={addMyPart} className="mt-2 w-full py-2 rounded text-sm font-semibold" style={{ background: C.green, color: "#fff" }}>Save to my catalog</button>
              {myParts.length > 0 && <div className="mt-3">
                {myParts.map((p, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs py-1.5 border-b border-neutral-300">
                    <span className="flex-1"><b>{p.desc}</b> {p.part && "· " + p.part} {p.source && "· " + p.source} {p.cost && "· cost $" + p.cost}{p.price && " · sell $" + p.price}</span>
                    <button onClick={() => partToEstimate(p)} className="px-3 py-2 rounded font-semibold" style={{ background: C.green, color: "#fff" }}>Add to estimate</button>
                    <button onClick={() => delMyPart(i)} className="text-neutral-500 hover:text-red-400"><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>}
            </div>
            <div className="rounded-md p-3" style={card}>
              <div className="text-sm font-bold mb-2">Parts sources — one tap</div>
              {[["PartsTech", "https://app.partstech.com", "aftermarket, multi-supplier — free"],
                ["RepairLink", "https://repairlinkshop.com", "OEM dealer parts at wholesale/discount — free"],
                ["Nexpart", "https://nexpart.com", "WHI aftermarket network — free"],
                ["RockAuto", "https://www.rockauto.com", "online aftermarket, deep catalog"],
                ["Copart", "https://www.copart.com", "salvage/recycled — body panels & assemblies"],
                ["RepairPal", "https://repairpal.com", "market repair-price reference (sanity-check your quotes)"]].map(([nm, url, d]) => (
                <div key={nm} className="flex items-center gap-2 text-sm py-1.5 border-b border-neutral-300">
                  <span className="flex-1"><b>{nm}</b> <span className="text-[12px] text-neutral-500">— {d}</span></span>
                  <button onClick={() => window.open(url, "_blank")} className="px-3 py-1 rounded text-xs font-semibold" style={{ background: C.green, color: "#fff" }}>Open</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ============ GUIDES TAB ============ */}
        {tab === "Guides" && (
          <div className="space-y-4">
            {!settings.guidesOn ? (
              <div className="rounded-md p-3 text-sm text-neutral-600" style={card}>The owner hasn't turned on the Guides page yet (Admin → Labor guides &amp; wiring).</div>
            ) : (
              <>
                <div className="rounded-md p-3" style={card}>
                  <div className="text-sm font-bold mb-2">Labor guides &amp; wiring schematics — your paid subscriptions</div>
                  {GUIDE_SOURCES.filter((g) => settings.guideSubs && settings.guideSubs[g.key]).length === 0 && (
                    <div className="text-xs text-neutral-500">No subscriptions marked yet — the owner checks them in Admin.</div>
                  )}
                  {GUIDE_SOURCES.filter((g) => settings.guideSubs && settings.guideSubs[g.key]).map((g) => (
                    <div key={g.key} className="flex items-center gap-2 text-sm py-1.5 border-b border-neutral-300">
                      <span className="flex-1">{g.name}</span>
                      <button onClick={() => window.open(g.url, "_blank")} className="px-3 py-1 rounded text-xs font-semibold" style={{ background: C.green, color: "#fff" }}>Open</button>
                    </div>
                  ))}
                </div>
                <div className="rounded-md p-3 text-[12px] text-neutral-600" style={card}>
                  Coverage map (every class that's legally coverable): MOTOR + ProDemand = US/Canada cars &amp; light trucks · ALLDATA = OEM procedures &amp; wiring · TruckSeries = Class 4–8 diesel · HaynesPro + Autodata = UK/EU and broad overseas · lawn &amp; equipment = manufacturer flat-rate guides. These open YOUR licensed portals — no guide content lives in this app, which is exactly what keeps it copyright-clean and sellable.
                </div>
              </>
            )}
          </div>
        )}

        {/* ============ FIXES TAB — PEACEFULLY ACCURATE ============ */}
        {tab === "Inspection" && (
          <div className="space-y-4">
            <div className="rounded-md p-3" style={card}>
              <div className="flex items-center gap-2 mb-1"><ShieldCheck size={18} style={{ color: "#1B5E20" }} /><div className="text-base font-black" style={{ color: "#1B5E20" }}>VEHICLE INSPECTION</div></div>
              <div className="text-[12px] text-neutral-500 mb-2">Pre-purchase and condition inspections — photo-documented, tiered like a pro service, priced without a broker's markup in the middle.</div>
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3].map((t) => (
                  <button key={t} onClick={() => setInsp({ ...insp, tier: t })} className="rounded-lg p-2.5 text-center border-2" style={{ borderColor: insp.tier === t ? C.green : "#D8CCC0", background: insp.tier === t ? "rgba(46,125,50,0.12)" : "transparent" }}>
                    <div className="text-xs font-black">Tier {t}</div>
                    <div className="text-[11.5px] text-neutral-500">{t === 1 ? "Essential" : t === 2 ? "Standard" : "Comprehensive"}</div>
                    <div className="text-sm font-black mt-1" style={{ color: "#1B5E20" }}>${t === 1 ? settings.inspectionPricing?.tier1 : t === 2 ? settings.inspectionPricing?.tier2 : settings.inspectionPricing?.tier3}</div>
                  </button>
                ))}
              </div>
              <div className="text-[11.5px] text-neutral-500 mt-2">Tier 1 covers exterior, under-hood, and under-vehicle basics. Tier 2 adds interior, suspension/steering, and a test drive. Tier 3 adds a full diagnostic scan, battery load test, and structural notes — the closest match to a full pre-purchase inspection.</div>
            </div>
            <div className="rounded-md p-3 flex items-start gap-2" style={{ ...card, borderColor: "#B8860B" }}>
              <AlertTriangle size={16} style={{ color: "#B8860B", marginTop: 2, flexShrink: 0 }} />
              <div className="text-[12px] text-neutral-600">This report reflects the vehicle's condition at the time and place of inspection only — a visual and operational check without disassembly. It is not a guarantee against future failure and not a warranty.</div>
            </div>
            <div className="rounded-md p-3 flex items-start gap-2" style={card}>
              <ShieldCheck size={16} style={{ color: "#1B5E20", marginTop: 2, flexShrink: 0 }} />
              <div className="text-[12px] text-neutral-600">{BRAND.name} carries general and garage liability coverage for on-site inspection work. This report is a professional opinion, not an insurance product — it does not insure the vehicle being inspected.</div>
            </div>
            {INSPECTION_SECTIONS.filter((sec) => sec.tier <= insp.tier).map((sec) => (
              <div key={sec.name} className="rounded-md p-3" style={card}>
                <div className="text-sm font-black mb-2">{sec.name}</div>
                {sec.items.map((it) => {
                  const k = inspItemKey(sec.name, it);
                  const rec = insp.items[k] || {};
                  return (
                    <div key={k} className="py-1.5 border-b border-neutral-300 last:border-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs flex-1">{it}</span>
                        <div className="flex gap-1">
                          <button onClick={() => setInspItem(k, { status: "good" })} title="Good" className="p-1 rounded" style={{ background: rec.status === "good" ? C.green : "#222" }}><CheckCircle2 size={15} color="#fff" /></button>
                          <button onClick={() => setInspItem(k, { status: "attention" })} title="Needs attention" className="p-1 rounded" style={{ background: rec.status === "attention" ? "#B8860B" : "#222" }}><AlertTriangle size={15} color="#fff" /></button>
                          <button onClick={() => setInspItem(k, { status: "fail" })} title="Fail" className="p-1 rounded" style={{ background: rec.status === "fail" ? "#B3372B" : "#222" }}><X size={15} color="#fff" /></button>
                        </div>
                      </div>
                      {rec.status && <input className={input + " mt-1 text-xs"} placeholder="Note (optional)" value={rec.note || ""} onChange={(e) => setInspItem(k, { note: e.target.value })} />}
                    </div>
                  );
                })}
              </div>
            ))}
            <div className="rounded-md p-3" style={card}>
              <div className="text-sm font-black mb-1">Inspector notes</div>
              <textarea className={input + " w-full"} rows={3} placeholder="Overall summary, anything worth flagging to the buyer" value={insp.notes} onChange={(e) => setInsp({ ...insp, notes: e.target.value })} />
              <div className="grid grid-cols-2 gap-2 mt-3">
                <button onClick={() => setTimeout(() => window.print(), 150)} className="py-2.5 rounded font-bold flex items-center justify-center gap-2" style={{ background: C.maroon, color: "#fff" }}><Printer size={16} /> Print / Save PDF</button>
                <button onClick={emailInspReport} className="py-2.5 rounded font-bold flex items-center justify-center gap-2" style={{ background: C.green, color: "#fff" }}><Mail size={16} /> Email to customer</button>
              </div>
              {inspMsg && <div className="text-[12px] mt-2" style={{ color: "#1B5E20" }}>{inspMsg}</div>}
              <div className="text-[11.5px] text-neutral-500 mt-2">Uses the customer name/email/vehicle already on the Details tab. Photos: attach them the same way as a repair job, on the Photo Estimate tab's camera — they travel with this vehicle's record.</div>
            </div>
          </div>
        )}
        {tab === "Fixes & Times" && (
          <div className="space-y-4">
            <div className="rounded-md p-3" style={card}>
              <div className="text-sm font-bold mb-1">Peacefully Accurate — confirmed fixes from real jobs</div>
              <div className="text-[12px] text-neutral-500 mb-2">Your shop's own repair intelligence: symptom → cause → correction → real hours, customer information stripped automatically. At the cloud tier every subscribing shop's fixes join one searchable network — the database nobody can buy, only build. Community-generated: verify against the vehicle in front of you before relying on any entry.</div>
              <input className={input} placeholder="Search year/make/model or symptom… (e.g. Silverado no-start)" value={fixQ} onChange={(e) => setFixQ(e.target.value)} />
              {fixes.filter((f) => !fixQ.trim() || (f.ymm + " " + f.complaint + " " + f.cause + " " + f.correction).toLowerCase().includes(fixQ.toLowerCase())).map((f, i) => (
                <div key={i} className="py-2 border-b border-neutral-300 text-xs">
                  <div className="flex items-center gap-2"><b className="text-sm flex-1" style={{ color: "#1B5E20" }}>{f.ymm}{f.engine && " · " + f.engine}</b><span className="text-neutral-500">{f.ts} · {f.by}</span><button onClick={() => confirmFix(i)} className="px-3 py-2 rounded text-[11.5px] font-bold" style={{ background: "#F2ECE6", color: "#1B5E20" }} title="I did this fix and it worked">👍 {f.confirms || 1}</button></div>
                  {f.complaint && <div className="mt-1"><b className="text-neutral-600">Complaint:</b> {f.complaint}</div>}
                  {f.cause && <div><b className="text-neutral-600">Cause:</b> {f.cause}</div>}
                  <div><b className="text-neutral-600">Correction:</b> {f.correction}</div>
                  <div className="text-neutral-500 mt-0.5">{f.hours && "Real hours: " + f.hours}{f.parts && " · Parts: " + f.parts}</div>
                </div>
              ))}
              {fixes.length === 0 && <div className="text-xs text-neutral-500 mt-2">Empty today, priceless in a year — publish your first fix with the ✅ button under Diagnosis on the Details tab after any job.</div>}
            </div>
            {fixDraft && (
              <div className="rounded-md p-3" style={{ ...card, border: `1px solid ${C.green}` }}>
                <div className="text-sm font-bold mb-2">Publish confirmed fix — review before it enters the library</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input className={input} placeholder="Vehicle (Y/M/M)" value={fixDraft.ymm} onChange={(e) => setFixDraft({ ...fixDraft, ymm: e.target.value })} />
                  <input className={input} placeholder="Engine (opt)" value={fixDraft.engine} onChange={(e) => setFixDraft({ ...fixDraft, engine: e.target.value })} />
                  <input className={input} placeholder="Complaint / symptom" value={fixDraft.complaint} onChange={(e) => setFixDraft({ ...fixDraft, complaint: e.target.value })} />
                  <input className={input} placeholder="Root cause" value={fixDraft.cause} onChange={(e) => setFixDraft({ ...fixDraft, cause: e.target.value })} />
                </div>
                <textarea className={input + " w-full mt-2"} rows={2} placeholder="Correction (what fixed it)" value={fixDraft.correction} onChange={(e) => setFixDraft({ ...fixDraft, correction: e.target.value })} />
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <input className={input} placeholder="Real hours" inputMode="decimal" value={fixDraft.hours} onChange={(e) => setFixDraft({ ...fixDraft, hours: e.target.value })} />
                  <input className={input} placeholder="Parts used (names only)" value={fixDraft.parts} onChange={(e) => setFixDraft({ ...fixDraft, parts: e.target.value })} />
                </div>
                <div className="flex gap-2 mt-2">
                  <button onClick={publishFix} className="flex-1 py-2 rounded-lg text-sm font-bold" style={{ background: C.green, color: "#fff" }}>Publish to library</button>
                  <button onClick={() => setFixDraft(null)} className="px-4 py-2 rounded-lg text-sm border border-neutral-400">Discard</button>
                </div>
                <div className="text-[11.5px] text-neutral-500 mt-1">No customer name, phone, address, or VIN is included — fixes describe vehicles, never people.</div>
              </div>
            )}
            <div className="rounded-md p-3" style={card}>
              <div className="text-sm font-bold mb-1">Peaceful Times — your real-world labor guide</div>
              <div className="text-[12px] text-neutral-500 mb-2">How it builds itself, in the open: finish a job → tap "Log this job's times" on the PAID invoice → entries land here → the guide shows LOW · TYPICAL · HIGH from real wrenches, not book estimates. At the cloud tier every shop's times merge, and the guide gets smarter every day.</div>
              <div className="flex gap-2 flex-wrap mb-2">
                <input className={input + " flex-1 min-w-[140px]"} placeholder="Search jobs… (brakes, alternator)" value={timeQ} onChange={(e) => setTimeQ(e.target.value)} />
                {timesG.some((t) => t.by === "SAMPLE")
                  ? <button onClick={clearTimeSamples} className="px-3 rounded-lg text-xs font-semibold border border-neutral-400 shrink-0">Remove samples</button>
                  : <button onClick={loadTimeSamples} className="px-3 rounded-lg text-xs font-semibold border border-neutral-400 shrink-0" title="See the layout with clearly-marked sample rows">See layout (samples)</button>}
              </div>
              {(() => {
                const groups = {};
                timesG.filter((t) => !timeQ.trim() || (t.job + " " + t.veh).toLowerCase().includes(timeQ.toLowerCase())).forEach((t) => { const k = t.job.trim().toLowerCase(); (groups[k] = groups[k] || []).push(t); });
                const keys = Object.keys(groups);
                if (!keys.length) return <div className="text-xs text-neutral-500">No entries yet — log a finished job from the Invoice tab, add one below, or tap "See layout" to preview with sample rows.</div>;
                return (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead><tr className="text-left text-neutral-600 border-b border-neutral-300"><th className="py-1 pr-2">Job</th><th className="pr-2">Entries</th><th className="pr-2">Low</th><th className="pr-2">Typical</th><th className="pr-2">High</th><th>Vehicles</th></tr></thead>
                      <tbody>
                        {keys.map((k) => {
                          const g = groups[k]; const hs = g.map((t) => parseFloat(t.hours) || 0);
                          const lo = Math.min(...hs); const hi = Math.max(...hs); const av = hs.reduce((a2, b2) => a2 + b2, 0) / hs.length;
                          const sample = g.some((t) => t.by === "SAMPLE");
                          return (
                            <tr key={k} className="border-b border-neutral-300">
                              <td className="py-1.5 pr-2 font-semibold text-neutral-800">{g[0].job}{sample && <span className="ml-1 text-[12px] px-1 rounded" style={{ background: "#B8860B", color: "#fff" }}>SAMPLE</span>}</td>
                              <td className="pr-2">{g.length}</td>
                              <td className="pr-2">{lo.toFixed(1)}</td>
                              <td className="pr-2 font-bold" style={{ color: "#1B5E20" }}>{av.toFixed(1)}</td>
                              <td className="pr-2">{hi.toFixed(1)}</td>
                              <td className="text-neutral-500">{[...new Set(g.map((t) => t.veh).filter(Boolean))].slice(0, 3).join(", ")}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                <input className={input} placeholder="Job (e.g. Water pump)" value={timeForm.job} onChange={(e) => setTimeForm({ ...timeForm, job: e.target.value })} />
                <input className={input} placeholder="Vehicle" value={timeForm.veh} onChange={(e) => setTimeForm({ ...timeForm, veh: e.target.value })} />
                <input className={input} placeholder="Hours" inputMode="decimal" value={timeForm.hours} onChange={(e) => setTimeForm({ ...timeForm, hours: e.target.value })} />
                <button onClick={addTimeEntry} className="py-2 rounded-lg text-sm font-semibold" style={{ background: C.green, color: "#fff" }}>Add entry</button>
              </div>
              <div className="text-[11.5px] text-neutral-500 mt-1">Observed times are guidance from real jobs — conditions vary; quote with judgment. SAMPLE rows are layout placeholders only, never real data.</div>
            </div>
            <div className="rounded-md p-3" style={card}>
              <div className="text-sm font-bold mb-1">Free wiring &amp; repair info (legal sources)</div>
              <div className="text-[12px] text-neutral-500 mb-2">Genuinely free, each covering a slice — the OEM sites below stay the full-coverage source. Warning: sites offering "free" complete ALLDATA/Mitchell/OEM manual dumps are pirated; using them in a business risks everything. Never.</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[["Remy (BBB) wiring + TSBs", "https://www.remyautomotive.com/free-wiring-diagrams-technical-service-bulletins"], ["AutoZone repair guides", "https://www.autozone.com/diy/repair-guides/wiring-diagrams"], ["Chilton — free w/ library card", "https://www.slcl.org"], ["the12volt (accessory wiring)", "https://www.the12volt.com/installbay/vehiclewiring.asp"], ["NASTF — every OEM site", "https://wiki.nastf.org"], ["NHTSA recalls &amp; TSB refs", "https://www.nhtsa.gov/recalls"]].map(([n, u]) => (
                  <button key={n} onClick={() => window.open(u, "_blank")} className="py-2 rounded-lg text-xs font-semibold border border-neutral-400 text-neutral-800">{n}</button>
                ))}
              </div>
            </div>
            <div className="rounded-md p-3" style={card}>
              <div className="text-sm font-bold mb-1">Official OEM service information (the legal source)</div>
              <div className="text-[12px] text-neutral-500 mb-2">Factory wiring diagrams and manuals come from the automakers' own technician sites — federal service-information rules require them to sell independents access, most with short-term passes. Opens in a new tab; nothing is copied into this app.</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[["Toyota/Lexus TIS", "https://techinfo.toyota.com"], ["Honda/Acura", "https://techinfo.honda.com"], ["Ford/Lincoln", "https://www.motorcraftservice.com"], ["GM ACDelco TDS", "https://www.acdelcotds.com"], ["Mopar TechAuthority", "https://www.techauthority.com"], ["Nissan/Infiniti", "https://www.nissan-techinfo.com"], ["Hyundai", "https://hyundaitechinfo.com"], ["NASTF (every OEM site)", "https://wiki.nastf.org"]].map(([n, u]) => (
                  <button key={n} onClick={() => window.open(u, "_blank")} className="py-2 rounded-lg text-xs font-semibold border border-neutral-400 text-neutral-800">{n}</button>
                ))}
              </div>
            </div>
            <div className="rounded-md p-3" style={card}>
              <div className="text-sm font-bold mb-1">CARFAX reporting queue ({carfaxQ.length} waiting)</div>
              <div className="text-[12px] text-neutral-500 mb-2">Completed repairs queue here in CARFAX's standard shape: date · vehicle · VIN · odometer · services. They transmit automatically once the platform's CARFAX Service Network data agreement is in place — that's a partnership application, not a switch. Until then, this shop's own free Service Network account keeps repairs reporting, and the queue is export-ready either way.</div>
              {carfaxQ.slice(0, 6).map((q, i) => (
                <div key={i} className="text-xs py-1 border-b border-neutral-300">{q.ts} · {q.ymm} · {q.miles ? q.miles + " mi" : "odometer —"} · {q.services}</div>
              ))}
              {carfaxQ.length === 0 && <div className="text-xs text-neutral-500">Mark an invoice PAID, then tap "Queue for CARFAX" on it.</div>}
            </div>
            <div className="rounded-md p-3" style={card}>
              <div className="text-sm font-bold mb-1">Free tools worth connecting</div>
              <div className="text-[12px] text-neutral-500 mb-2">Real, genuinely free tools — nothing here is a paid trial dressed up as free.</div>
              <div className="text-xs space-y-2">
                <div><b style={{ color: "#1B5E20" }}>Google Business Profile</b> — free. This is what makes you show up on Google Maps and search. If you haven't claimed yours, this is the single highest-value free thing on this list.</div>
                <div><b style={{ color: "#1B5E20" }}>Google Analytics</b> — free. See how many people actually visit your website and what they click.</div>
                <div><b style={{ color: "#1B5E20" }}>Wave Accounting</b> — free bookkeeping and invoicing software, built for exactly this size of business.</div>
                <div><b style={{ color: "#1B5E20" }}>Mailchimp free tier</b> — up to 500 contacts, for sending a monthly email to past customers.</div>
                <div><b style={{ color: "#1B5E20" }}>Canva free tier</b> — for making a flyer or a social post without hiring a designer.</div>
                <div><b style={{ color: "#1B5E20" }}>NAPA AutoCare membership</b> — no cost to join for most independents, and it puts you on their national warranty network plus marketing support NAPA runs on your behalf.</div>
                <div><b style={{ color: "#1B5E20" }}>AAA Approved Auto Repair program</b> — application-based, no guaranteed monthly cost — gets your shop referred to AAA members directly, who already expect a 10% labor discount through AAA, but the referral volume is the real benefit.</div>
                <div><b style={{ color: "#1B5E20" }}>ASA (Automotive Service Association) membership</b> — trade group dues typically well under $20/mo for a shop your size — real advocacy plus group-buying leverage with some suppliers.</div>
              </div>
              <div className="text-[11.5px] text-neutral-500 mt-2">None of these connect automatically to this app — they're separate free accounts worth having, listed here so you don't have to go find them.</div>
            </div>
          </div>
        )}

        {/* ============ COMMUNITY TAB ============ */}
        {tab === "Community" && (
          <div className="space-y-4">
            <div className="rounded-md p-3" style={card}>
              <div className="text-sm font-bold mb-1">Crew feed</div>
              <div className="text-[12px] text-neutral-500 mb-2">Ideas, wins, weird fixes — post it for the crew. Photos and short video attach right to the post. The cross-shop network (every subscribed shop, one feed) switches on at the cloud tier.</div>
              <div className="flex gap-2">
                <input className={input} placeholder="Share something…" value={feedText} onChange={(e) => setFeedText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") postFeed(); }} />
                <button onClick={postFeed} className="px-4 rounded-lg font-semibold shrink-0" style={{ background: C.green, color: "#fff" }}>Post</button>
              </div>
              <input id="feedMediaInput" type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm" onChange={uploadFeedMedia} className="hidden" />
              <button onClick={() => document.getElementById("feedMediaInput").click()} disabled={feedMediaBusy} className="mt-2 text-xs px-3 py-1.5 rounded-lg border border-neutral-400">{feedMediaBusy ? "Uploading…" : feedMediaUrl ? "📎 Photo/video attached — tap to replace" : "📎 Attach a photo or short video"}</button>
              {feed.map((p, i) => (
                <div key={i} className="text-sm py-2 border-b border-neutral-300">
                  <div className="flex items-center gap-2">
                    <b className="flex-1" style={{ color: "#1B5E20" }}>{p.by} <span className="text-[11.5px] font-normal text-neutral-500">{p.ts}</span></b>
                    {currentTech && currentTech.admin && <button aria-label="Remove post" onClick={async () => { if (!window.confirm("Remove this post for everyone?")) return; const list = feed.filter((_, j) => j !== i); setFeed(list); await store.set("forum:posts", list); }} className="text-[11px] underline text-neutral-500 min-h-[32px] px-1">Remove</button>}
                  </div>
                  <div className="text-neutral-800">{p.text}</div>
                  {p.media && (p.media.match(/\.(mp4|mov|webm)$/i) ? <video src={p.media} controls className="mt-1 rounded-lg max-h-64 w-full" /> : <img src={p.media} className="mt-1 rounded-lg max-h-64" alt="crew feed attachment" />)}
                </div>
              ))}
              {feed.length === 0 && <div className="text-xs text-neutral-500 mt-2">Nothing yet — first post takes the top spot.</div>}
            </div>
            {currentTech && currentTech.admin && (
              <div className="rounded-md p-3" style={card}>
                <div className="text-sm font-bold mb-1">Customer members ({membersAll.length}) — toggle off to pause anyone breaking the guidelines</div>
                {membersAll.map((m, i) => (
                  <div key={i} className="rounded-lg p-3 mb-2" style={{ background: "#F7F3EF", border: m.ok === false ? "2px solid #B3261E" : "1px solid #E2DAD2" }}>
                    <div className="flex items-start gap-2">
                      <div className="flex-1">
                        <div className="text-sm font-bold" style={{ color: "#241F1F" }}>{m.name}
                          {m.ok === false && <span className="ml-2 text-[12px] px-1.5 py-0.5 rounded font-black" style={{ background: "#B3261E", color: "#fff" }}>PAUSED</span>}
                          {m.donor && <span className="ml-1 text-[12px] px-1.5 py-0.5 rounded font-black" style={{ background: "#B8860B", color: "#fff" }}>DONOR</span>}
                        </div>
                        <div className="text-[12px] mt-1" style={{ color: "#3A342F" }}>
                          <div>Signs in with: <b>{m.username || m.phone}</b></div>
                          {m.email && <div>Email: {m.email}</div>}
                          <div>Phone: {m.phone}</div>
                          <div style={{ color: "#6B625A" }}>Joined {m.ts} &middot; signed as "{m.signedName}"</div>
                        </div>
                        {(m.reported || []).length > 0 && (
                          <div className="mt-2 rounded p-2 text-[11.5px]" style={{ background: "#FFF0EE", border: "1px solid #B3261E", color: "#7a1f1f" }}>
                            <b>Reported {(m.reported || []).length}x:</b>
                            {(m.reported || []).map((r, k) => <div key={k}>{r.ts} &mdash; {r.why} (by {r.by})</div>)}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <button onClick={() => toggleMember(m.phone)} className="px-3 py-2 rounded-lg text-[12px] font-black" style={{ background: m.ok === false ? "#7a1f1f" : "#2E7D32", color: "#fff" }}>{m.ok === false ? "Paused \u2014 turn on" : "Active \u2014 pause"}</button>
                      <button onClick={() => openThread(m.phone)} className="px-3 py-2 rounded-lg text-[12px] font-bold border" style={{ borderColor: "#D8CCC0", color: "#1B5E20" }}>Messages</button>
                      <button onClick={() => toggleDonor(m.phone)} title="Donor access unlocks the Donor Room learning channel" className="px-3 py-2 rounded-lg text-[12px] font-bold border" style={{ borderColor: "#D8CCC0", color: "#8A6D00" }}>{m.donor ? "Remove donor" : "Make donor"}</button>
                      <button onClick={() => reportMember(m.phone)} className="px-3 py-2 rounded-lg text-[12px] font-bold border" style={{ borderColor: "#B8860B", color: "#8A6D00" }}>Report</button>
                      <button onClick={() => deleteMember(m.phone)} className="px-3 py-2 rounded-lg text-[12px] font-bold border" style={{ borderColor: "#B3261E", color: "#B3261E" }}>Delete</button>
                    </div>
                  </div>
                ))}
                {membersAll.length === 0 && <div className="text-xs text-neutral-500">No members yet — the community button on the login screen is where they join.</div>}
                {inboxSel && (
                  <div className="rounded-md p-2 mt-2" style={{ background: "#F7F3EF" }}>
                    <div className="text-xs font-bold mb-1">Thread with {inboxSel} <button onClick={() => setInboxSel("")} className="text-neutral-500 underline ml-2">close</button></div>
                    {inboxThread.slice(-8).map((c, i) => (
                      <div key={i} className="text-xs py-0.5"><b style={{ color: c.from === "shop" ? "#1B5E20" : "#3A342F" }}>{c.from === "shop" ? (c.by || "Shop") : "Member"}:</b> {c.text}</div>
                    ))}
                    <div className="flex gap-2 mt-1">
                      <input className={input} placeholder="Reply… (texts them too if they opted in)" value={inboxReply} onChange={(e) => setInboxReply(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") replyThread(); }} />
                      <button onClick={replyThread} className="px-3 rounded-lg text-xs font-bold shrink-0" style={{ background: C.green, color: "#fff" }}>Send</button>
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className="rounded-md p-3" style={card}>
              <div className="text-sm font-bold mb-1">Parts swap</div>
              <div className="text-[12px] text-neutral-500 mb-2">Sell it, find it, trade it. Deals settle person-to-person — post honestly, meet safely, use your own payment method.</div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <select className={input} value={swapForm.kind} onChange={(e) => setSwapForm({ ...swapForm, kind: e.target.value })}>{["SELL", "WANTED", "TRADE"].map((k) => <option key={k}>{k}</option>)}</select>
                <input className={input} placeholder="Part" value={swapForm.part} onChange={(e) => setSwapForm({ ...swapForm, part: e.target.value })} />
                <input className={input} placeholder="$ (opt)" inputMode="decimal" value={swapForm.price} onChange={(e) => setSwapForm({ ...swapForm, price: e.target.value })} />
                <input className={input} placeholder="Condition" value={swapForm.cond} onChange={(e) => setSwapForm({ ...swapForm, cond: e.target.value })} />
                <input className={input} placeholder="Contact" value={swapForm.contact} onChange={(e) => setSwapForm({ ...swapForm, contact: e.target.value })} />
              </div>
              <button onClick={postSwap} className="mt-2 w-full py-2 rounded-lg text-sm font-semibold" style={{ background: C.maroon, color: "#fff" }}>Post listing</button>
              {swap.map((l, i) => (
                <div key={i} className="flex items-center gap-2 text-xs py-1.5 border-b border-neutral-300">
                  <span className="flex-1"><b style={{ color: l.kind === "WANTED" ? "#f0b356" : "#1B5E20" }}>{l.kind}</b> · <b>{l.part}</b>{l.price && " · $" + l.price}{l.cond && " · " + l.cond} · {l.by}{l.contact && " · " + l.contact} <span className="text-neutral-600">{l.ts}</span></span>
                  {currentTech && (currentTech.admin || currentTech.name === l.by) && <button onClick={() => delSwap(i)} className="text-neutral-500 hover:text-red-400"><Trash2 size={13} /></button>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ============ ACADEMY TAB ============ */}
        {tab === "Academy" && (
          <div className="space-y-4">
            <div className="rounded-md p-3" style={card}>
              <div className="text-sm font-bold mb-1">Shop Academy — training that lives in the truck</div>
              <div className="text-[12px] text-neutral-500 mb-2">Work each module, tap it done — your completion saves with the date. The owner sees the whole crew's matrix below. Annual refresher: owner clears and the crew runs it again.</div>
              {ACADEMY.map((m, i) => {
                const done = currentTech && acadDone[currentTech.name + ":" + i];
                return (
                  <div key={i} className="py-2 border-b border-neutral-300">
                    <div className="flex items-center gap-2">
                      <b className="flex-1 text-sm">{i + 1}. {m[0]}</b>
                      <button onClick={() => markModule(i)} className="px-3 py-2.5 rounded-lg text-xs font-bold" style={{ background: done ? C.green : "#F2ECE6", color: done ? "#fff" : "#1B5E20" }}>{done ? "✓ " + done : "Mark complete"}</button>
                    </div>
                    <div className="text-xs text-neutral-600 mt-1">{m[1]}</div>
                  </div>
                );
              })}
            </div>
            <div className="rounded-md p-3" style={card}>
              <div className="text-sm font-bold mb-1">🎓 ASE certification study track</div>
              <div className="text-[12px] text-neutral-500 mb-2">In-house study outlines for every ASE cert this shop's work touches — what each one covers and why it matters to OUR jobs. Work the outline, study, test at an official center, then mark it here with the date. Not affiliated with ASE — official registration and test prep live at ase.com.</div>
              {ASE_TRACK.map((m, i) => {
                const done = currentTech && acadDone[currentTech.name + ":ase:" + i];
                return (
                  <div key={i} className="py-2 border-b border-neutral-300">
                    <div className="flex items-center gap-2">
                      <b className="flex-1 text-sm">{m[0]}</b>
                      <button onClick={() => markAseModule(i)} className="px-3 py-2.5 rounded-lg text-xs font-bold" style={{ background: done ? C.green : "#F2ECE6", color: done ? "#fff" : "#1B5E20" }}>{done ? "✓ " + done : "Mark studied"}</button>
                    </div>
                    <div className="text-xs text-neutral-600 mt-1">{m[1]}</div>
                    <div className="text-[11.5px] mt-1" style={{ color: "#7a5a12" }}>Experience required to test: {m[2]}</div>
                  </div>
                );
              })}
              <div className="text-[11.5px] text-neutral-500 mt-2">"Mark studied" tracks study completion in-house — it is not the certification itself. Passed certs and their 5-year expiration dates: owner records them on the roster notes so renewals never sneak up.</div>
            </div>
            {currentTech && currentTech.admin && (
              <div className="rounded-md p-3" style={card}>
                <div className="text-sm font-bold mb-2">Crew completion matrix (owner)</div>
                <div className="text-[11.5px] text-neutral-500 mb-1">Left block: shop modules 1–{ACADEMY.length}. Right block (🎓): ASE study track.</div>
                {techs.map((t, ti) => (
                  <div key={ti} className="flex items-center gap-1 text-xs py-1 border-b border-neutral-300 overflow-x-auto">
                    <span className="flex-1 min-w-[80px]">{t.name}</span>
                    {ACADEMY.map((_, mi) => (
                      <span key={mi} className="w-6 text-center" title={"Module " + (mi + 1)}>{acadDone[t.name + ":" + mi] ? "✅" : "▫️"}</span>
                    ))}
                    <span className="px-1">🎓</span>
                    {ASE_TRACK.map((m, mi) => (
                      <span key={"a" + mi} className="w-6 text-center" title={m[0]}>{acadDone[t.name + ":ase:" + mi] ? "✅" : "▫️"}</span>
                    ))}
                  </div>
                ))}
                <div className="text-[11.5px] text-neutral-500 mt-2">Print this screen for the training file; module sign-offs pair with the paper Training Sheet.</div>
              </div>
            )}
          </div>
        )}

        {/* ============ INTEGRATIONS TAB ============ */}
        {tab === "Integrations" && (
          <div className="space-y-4">
            <div className="rounded-md p-3" style={card}>
              <div className="text-base font-black mb-1" style={{ color: "#1B5E20" }}>YOUR VENDOR ACCOUNTS</div>
              <div className="text-[12px] mb-3" style={{ color: "#5A524B" }}>
                Save your login for each vendor once. Then anyone on your crew taps Open and lands on the right site with the vehicle and job already copied to the clipboard, ready to paste into their search.
                <br /><br /><b>Straight answer on why it works this way:</b> none of these companies publish an open connection that lets an outside app pull their priced results back in automatically. Anyone who tells you otherwise is guessing. What this does is real: it remembers who you are and gets you there in one tap with the job details in hand.
              </div>
              {VENDORS.map((v) => {
                const acct = (settings.vendorAccounts || {})[v.key] || {};
                return (
                  <div key={v.key} className="rounded-lg p-2.5 mb-2" style={{ background: "#F7F3EF", border: "1px solid #E2DAD2" }}>
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <div className="text-sm font-bold" style={{ color: "#241F1F" }}>{v.name}</div>
                        <div className="text-[11.5px]" style={{ color: "#6B625A" }}>{v.note}</div>
                      </div>
                      <button onClick={() => openVendor(v)} className="px-3 py-2 rounded-lg text-xs font-bold" style={{ background: C.green, color: "#fff" }}>Open</button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <input className={input} placeholder="username / login" value={acct.user || ""}
                        onChange={(e) => setSettings({ ...settings, vendorAccounts: { ...(settings.vendorAccounts || {}), [v.key]: { ...acct, user: e.target.value } } })} />
                      <input className={input} placeholder="account / customer #" value={acct.acct || ""}
                        onChange={(e) => setSettings({ ...settings, vendorAccounts: { ...(settings.vendorAccounts || {}), [v.key]: { ...acct, acct: e.target.value } } })} />
                    </div>
                  </div>
                );
              })}
              <button onClick={saveSettings} className="w-full mt-1 py-2.5 rounded text-sm font-bold" style={{ background: C.green, color: "#fff" }}>{setMsg || "Save vendor accounts"}</button>
              <div className="text-[11.5px] mt-2" style={{ color: "#8A8078" }}>Passwords are deliberately not stored here. Keep those in your phone or browser password manager, where they belong.</div>
            </div>
            <div className="rounded-md p-3" style={card}>
              <div className="text-sm font-bold mb-1">API credentials — PartsTech &amp; RepairLink</div>
              <div className="text-[12px] text-neutral-500 mb-2">Enter your credentials when your API access comes through. They save to the app's storage and are used only by your own backend route (app/api/parts). Once live, move the secret keys into your host's environment variables.</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input className={input} placeholder="PartsTech account / username" value={integr.ptAccount} onChange={(e) => setIntegr({ ...integr, ptAccount: e.target.value })} />
                <input className={input} placeholder="PartsTech API key" type="password" value={integr.ptKey} onChange={(e) => setIntegr({ ...integr, ptKey: e.target.value })} />
                <input className={input} placeholder="RepairLink username" value={integr.rlUser} onChange={(e) => setIntegr({ ...integr, rlUser: e.target.value })} />
                <input className={input} placeholder="RepairLink API key / password" type="password" value={integr.rlKey} onChange={(e) => setIntegr({ ...integr, rlKey: e.target.value })} />
              </div>
              <button onClick={saveIntegrations} className="mt-2 w-full py-2 rounded text-sm font-semibold" style={{ background: C.green, color: "#fff" }}>{integrMsg || "Save credentials"}</button>
              <div className="text-[11.5px] text-neutral-500 mt-2">Status: {integr.ptKey ? "PartsTech key saved ✓" : "PartsTech — not connected"} · {integr.rlKey ? "RepairLink key saved ✓" : "RepairLink — not connected"}. Live pricing switches on once each provider's API documentation lands in app/api/parts/route.js.</div>
            </div>
            <div className="rounded-md p-3" style={card}>
              <div className="text-sm font-bold mb-2">Vendor launchers — one tap from any device</div>
              {[
                ["PartsTech", "https://app.partstech.com", "aftermarket parts, multi-supplier — free for shops"],
                ["RepairLink", "https://repairlinkshop.com", "OEM dealer parts — free for shops"],
                ["CCC ONE", "https://www.cccis.com", "insurance/DRP estimating platform — subscription, quote-based"],
                ["Nexpart", "https://nexpart.com", "WHI aftermarket network — free for shops"],
                ["Identifix Direct-Hit", "https://www.identifix.com", "diagnostics database you already use"],
                ["360 Payments", "https://www.360payments.com", "auto-shop payment processing — text-to-pay, interchange-plus, quote-based"],
                ["Advanced Payment Services", "https://www.advancedpaymentservices.com", "St. Peters MO, veteran-owned — dual pricing/cash discount, terminals, invoicing"],
              ].map(([name, url, desc]) => (
                <div key={name} className="flex items-center gap-2 text-sm py-1.5 border-b border-neutral-300">
                  <span className="flex-1"><b>{name}</b> <span className="text-[12px] text-neutral-500">— {desc}</span></span>
                  <button onClick={() => window.open(url, "_blank")} className="px-3 py-1 rounded text-xs font-semibold" style={{ background: C.green, color: "#fff" }}>Open</button>
                </div>
              ))}
            </div>
            <div className="rounded-md p-3 text-[12px] text-neutral-600" style={card}>
              <b className="text-neutral-800">How an integration gets added (the pattern):</b> 1. You get API access + documentation from the vendor. 2. Their documented call drops into app/api/parts/route.js at the marked spot. 3. Your credentials move to the host's environment variables. 4. The per-line buttons switch from open-and-paste to live in-app pricing. Nothing else in the app changes. CCC ONE is the exception — it's a closed platform with no public API; you subscribe and run it alongside for DRP/insurance work.
            </div>
          </div>
        )}

        {/* ============ NOTIFICATIONS TAB ============ */}
        {tab === "Notifications" && (
          <div className="space-y-4">
            <div className="rounded-md p-3" style={card}>
              <div className="text-sm font-bold mb-1">Notifications</div>
              <div className="text-[12px] text-neutral-500 mb-2">Crashes show in red, shop activity shows in green — the badge on this tab up top counts both, red taking priority when there's an error waiting.</div>
              {errLog.length === 0 && bookings.filter((b) => b.status === "Requested").length === 0 && (
                <div className="text-sm text-neutral-500 py-2">Nothing new — you're caught up.</div>
              )}
              {errLog.map((e, i) => (
                <div key={"err" + i} className="rounded-lg p-2.5 mb-2 text-xs" style={{ background: "#3a1f1f", border: "1.5px solid #B3261E", color: "#ffb3a8" }}>
                  <b>⚠ Crash / error</b><div className="mt-0.5">{e}</div>
                </div>
              ))}
              {bookings.filter((b) => b.status === "Requested").map((b) => (
                <div key={b.key} className="rounded-lg p-2.5 mb-2 text-xs" style={{ background: "#173325", border: "1.5px solid #2E7D32", color: "#1B5E20" }}>
                  <b>🌐 New booking request</b><div className="mt-0.5">{b.name || "-"} · {b.vehicle || "-"} · {b.date} {b.time}</div>
                </div>
              ))}
              {errLog.length > 0 && <button onClick={() => setErrLog([])} className="w-full mt-1 py-2 rounded text-xs font-semibold border border-neutral-400">Clear error notifications</button>}
            </div>
          </div>
        )}

        {/* ============ DASHBOARD TAB ============ */}
        {tab === "Dashboard" && (
          <div className="space-y-4">
            <div className="flex gap-2 items-start rounded-md px-3 py-2 text-[13px]" style={{ background: "#3a2c07", border: "1px solid #6b520c" }}>
              <AlertTriangle size={16} className="mt-0.5 shrink-0" style={{ color: C.amber }} />
              <span className="text-amber-100">This demo dashboard reads from this browser's saved estimates only. On your real deployment, swap this for a Supabase table so every tech's estimates roll up together.</span>
            </div>
            <button onClick={exportContactsCsv} className="w-full mt-2 py-2.5 rounded font-bold flex items-center justify-center gap-2 border border-neutral-400"><Download size={16} /> Export customer contacts (CRM-compatible CSV)</button>
            <button onClick={exportCalendarIcs} className="w-full mt-2 py-2.5 rounded font-bold flex items-center justify-center gap-2 border border-neutral-400"><Download size={16} /> Export bookings to Outlook/calendar (.ics file)</button>
            <div className="text-[11.5px] text-neutral-500 mt-1">Downloads every scheduled booking as one file — open it and Outlook (or Google/Apple Calendar) offers to add them. This is a snapshot, not a live sync: run it again whenever you want your calendar caught up. A true auto-updating feed needs the shared Supabase database turned on first (Free_Cloudflare_Deploy_Guide) since bookings currently live only on this device.</div>
            <button onClick={backupAll} className="w-full py-2.5 rounded font-bold flex items-center justify-center gap-2 mt-2" style={{ background: C.green, color: "#fff" }}><Download size={16} /> Backup everything (one JSON file)</button>
            <input ref={restoreFileRef} type="file" accept="application/json" onChange={restoreAll} className="hidden" />
            <button onClick={() => restoreFileRef.current && restoreFileRef.current.click()} className="w-full mt-2 py-2.5 rounded font-bold flex items-center justify-center gap-2 border border-neutral-400">Restore from a Peaceful OS backup file</button>
            <input id="csvImportInput" type="file" accept=".csv,text/csv" onChange={importCsv} className="hidden" />
            <button onClick={() => document.getElementById("csvImportInput").click()} className="w-full mt-2 py-2.5 rounded font-bold flex items-center justify-center gap-2 border border-neutral-400">Import customers/bookings from a CSV (Shop Manager export or anywhere else)</button>
            <div className="text-[11.5px] text-neutral-500 mt-1">CSV import looks for columns named name, phone, vehicle, date, notes (any order, extra columns ignored) and adds each row as a booking.</div>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-md p-3 text-center" style={card}><div className="text-2xl font-black" style={{ color: "#1B5E20" }}>{dash.n}</div><div className="text-[11.5px] text-neutral-600 uppercase">Saved estimates</div></div>
              <div className="rounded-md p-3 text-center" style={card}><div className="text-2xl font-black" style={{ color: "#1B5E20" }}>{money(dash.avg)}</div><div className="text-[11.5px] text-neutral-600 uppercase">Avg repair order</div></div>
              <div className="rounded-md p-3 text-center" style={card}><div className="text-2xl font-black" style={{ color: "#1B5E20" }}>{dash.approvalRate}%</div><div className="text-[11.5px] text-neutral-600 uppercase">Approved+ rate</div></div>
            </div>
            <div className="rounded-md p-3" style={card}>
              <div className="text-sm font-bold mb-2">By status</div>
              {STATUSES.map((s) => (
                <div key={s} className="flex justify-between text-xs py-1 border-b border-neutral-300"><span>{s}</span><span>{dash.byStatus[s] || 0}</span></div>
              ))}
            </div>
            <div className="rounded-md p-3" style={card}>
              <div className="text-sm font-bold mb-2">Parts / labor mix</div>
              <div className="flex justify-between text-xs py-1"><span>Parts total</span><span>{money(dash.partsTotal)}</span></div>
              <div className="flex justify-between text-xs py-1"><span>Labor total</span><span>{money(dash.laborTotal)}</span></div>
            </div>
            <div className="rounded-md p-3" style={card}>
              <div className="text-base font-black mb-1" style={{ color: C.maroon === "#7A1F1F" && !settings.nightMode ? C.maroon : "#E8B4B4" }}>🧾 Invoices &amp; estimates — past and present</div>
              <div className="text-[12px] text-neutral-500 mb-2">Every ticket in the shop, one screen. Filter by status or folder; tap Open to pull one back up.</div>
              <input className={input + " w-full mb-2"} placeholder="Search invoice #, customer, or vehicle" value={dashSearch} onChange={(e) => setDashSearch(e.target.value)} />
              <div className="flex gap-1.5 flex-wrap mb-2">
                {["All", ...STATUSES].map((st) => (
                  <button key={st} onClick={() => setDashStatus(st)} className="px-2.5 py-1.5 rounded-full text-xs font-semibold min-h-[32px]"
                    style={{ background: dashStatus === st ? C.maroon : (settings.nightMode ? "#2A2420" : "#F2ECE6"), color: dashStatus === st ? "#fff" : (settings.nightMode ? "#C7BDB4" : "#5A524B") }}>{st}</button>
                ))}
              </div>
              <div className="text-sm font-bold mb-2 mt-3">Folders</div>
              <div className="flex gap-1.5 flex-wrap mb-2">
                {["All", ...FOLDERS].map((f) => (
                  <button key={f} onClick={() => setDashFilter(f)} className="px-2.5 py-1 rounded text-xs font-semibold"
                    style={{ background: dashFilter === f ? C.green : "#F2ECE6", color: dashFilter === f ? "#fff" : "#5A524B" }}>{f}</button>
                ))}
              </div>
              {savedEstimates.length === 0 && <div className="text-xs text-neutral-500">None saved yet — use Save from any tab.</div>}
              {savedEstimates.filter((e) => dashFilter === "All" || (e.folder || "New") === dashFilter)
                .filter((e) => dashStatus === "All" || (e.meta?.status || "Draft") === dashStatus)
                .filter((e) => { const q = dashSearch.trim().toLowerCase(); if (!q) return true; return [e.meta?.number, e.meta?.customer?.name, e.vehicle?.ymm].some((v) => String(v || "").toLowerCase().includes(q)); })
                .map((e, i) => (
                <div key={e.meta?.number || i} className="flex items-center gap-2 text-xs py-2 border-b border-neutral-300">
                  <div className="flex-1 min-w-0">
                    <div className="font-bold truncate">#{e.meta?.number} · {e.meta?.customer?.name || "—"}</div>
                    <div className="text-neutral-500 truncate">{e.vehicle?.ymm || "-"} · {e.savedAt ? e.savedAt.slice(0, 10) : ""}</div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full font-bold" style={{ background: (e.meta?.status === "Completed" ? "#EAF3EA" : e.meta?.status === "In Progress" ? "#FBF3E2" : e.meta?.status === "Approved" ? "#E6F0FA" : "#F2ECE6"), color: "#3d3833", fontSize: "10.5px" }}>{e.meta?.status || "Draft"}</span>
                  <b>{money(e.totals?.grand || 0)}</b>
                  <button onClick={() => { if (!window.confirm("Open invoice #" + e.meta?.number + "? Your current in-progress work is safe in the crash draft.")) return; if (e.rows) setRows(e.rows); if (e.meta) setMeta(e.meta); if (e.vehicle) setVehicle(e.vehicle); if (e.category) setCategory(e.category); setTab("Details"); }} className="px-2.5 py-1.5 rounded font-bold min-h-[36px]" style={{ background: C.green, color: "#fff", fontSize: "11px" }}>Open</button>
                  <select className={input + " w-28"} value={e.folder || "New"} onChange={async (ev) => {
                    const upd = { ...e, folder: ev.target.value };
                    await store.set(`estimates:${e.meta?.number}`, upd);
                    setSavedEstimates((list) => list.map((x) => x.meta?.number === e.meta?.number ? upd : x));
                  }}>
                    {FOLDERS.map((f) => <option key={f}>{f}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Sticky totals + actions */}
      <div className="fixed bottom-0 left-0 right-0 no-print" style={{ background: C.panel, borderTop: `2px solid ${C.maroon}`, paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="max-w-4xl lg:max-w-6xl mx-auto p-3">
          <button onClick={() => setShowAdj(!showAdj)} className="w-full text-left text-xs text-neutral-600 mb-1.5 py-2.5 min-h-[44px] flex items-center gap-1.5">
            <ChevronDown size={14} className={showAdj ? "rotate-180" : ""} /> Sublet · Supplies · Paint · Tax {showAdj ? "" : "— tap to adjust"}
          </button>
          {showAdj && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
            <label className="text-[12px] text-neutral-600">Sublet $<input className={input} inputMode="decimal" value={sublet} onChange={(e) => setSublet(e.target.value)} /></label>
            <label className="text-[12px] text-neutral-600">Supplies $<input className={input} inputMode="decimal" value={supplies} onChange={(e) => setSupplies(e.target.value)} /></label>
              {shopFeeSuggested > 0 && <button onClick={() => setSupplies(shopFeeSuggested.toFixed(2))} className="text-[11.5px] underline mt-1" style={{ color: "#1B5E20" }}>Apply shop fee (${shopFeeSuggested.toFixed(2)})</button>}
            <label className="text-[12px] text-neutral-600">Paint mat $<input className={input} inputMode="decimal" value={paintMat} onChange={(e) => setPaintMat(e.target.value)} /></label>
            <label className="text-[12px] text-neutral-600">Tax %<input className={input} inputMode="decimal" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} /></label>
          </div>
          )}
          <div className="flex items-center gap-4">
            <div className="text-xs text-neutral-600 leading-tight">Parts {money(totals.partsSub)} · Labor {money(totals.laborSub)} · Tax {money(totals.tax)}</div>
            <div className="ml-auto text-right"><div className="text-[11.5px] text-neutral-600 uppercase tracking-wide">Grand total</div><div className="text-2xl font-black" style={{ color: "#1B5E20" }}>{money(totals.grand)}</div></div>
          </div>
          <div className="flex gap-2 mt-2 flex-wrap">
            <button onClick={copyText} className="flex-1 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5 min-h-[44px]" style={{ background: C.maroon, color: "#fff" }}><Copy size={15} /> Copy</button>
            <button onClick={printView} className="py-2.5 px-3 rounded-lg text-sm border border-neutral-400 flex items-center gap-1.5 min-h-[44px]"><Printer size={15} /> Print / PDF</button>
            <button onClick={downloadCSV} className="py-2.5 px-3 rounded-lg text-sm border border-neutral-400 flex items-center gap-1.5 min-h-[44px]"><Download size={15} /> CSV</button>
            <button onClick={emailEstimate} className="py-2.5 px-3 rounded-lg text-sm border border-neutral-400 flex items-center gap-1.5 min-h-[44px]"><Mail size={15} /> Email</button>
            <button onClick={saveEstimate} className="py-2.5 px-3 rounded-lg text-sm border border-neutral-400 flex items-center gap-1.5 min-h-[44px]"><Save size={15} /> {saveMsg || "Save"}</button>
          </div>
        </div>
      </div>
      {textBox.open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3" style={{ background: "rgba(0,0,0,0.65)" }}>
          <div className="w-full sm:max-w-md rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-base font-black" style={{ color: "#1B5E20" }}>Send this text</div>
              <button aria-label="Close" onClick={() => setTextBox({ open: false, to: "", body: "" })} className="text-neutral-500"><X size={20} /></button>
            </div>
            <div className="text-[12px] text-neutral-500 mb-2">Opens in your own Messages app - sends from your own number, on your own plan. Nothing here goes through a paid service.</div>
            <label className="text-[12px] text-neutral-600 block mb-1">To</label>
            <input className={input + " w-full mb-2"} value={textBox.to} onChange={(e) => setTextBox({ ...textBox, to: e.target.value })} placeholder="Phone number" />
            <label className="text-[12px] text-neutral-600 block mb-1">Message</label>
            <textarea className={input + " w-full"} rows={5} value={textBox.body} onChange={(e) => setTextBox({ ...textBox, body: e.target.value })} />
            <div className="grid grid-cols-2 gap-2 mt-3">
              <button onClick={copyTextBoxMessage} className="py-2.5 rounded font-bold flex items-center justify-center gap-2" style={{ background: "#D8CCC0" }}><Copy size={16} /> Copy</button>
              <button onClick={openInMessages} className="py-2.5 rounded font-bold flex items-center justify-center gap-2" style={{ background: C.green, color: "#fff" }}><Mail size={16} /> Open in Messages</button>
            </div>
          </div>
        </div>
      )}
      {emailBox.open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3" style={{ background: "rgba(0,0,0,0.65)" }}>
          <div className="w-full sm:max-w-md rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-base font-black" style={{ color: "#1B5E20" }}>Ready to send 👍</div>
              <button aria-label="Close" onClick={() => setEmailBox({ ...emailBox, open: false })} className="text-neutral-500"><X size={20} /></button>
            </div>
            <div className="text-[12px] text-neutral-500 mb-2">Looks good — give it a quick check, then send it off in your own email app.</div>
            <label className="text-[12px] text-neutral-600 block mb-1">From</label>
            <select className={input + " w-full mb-2"} value={emailBox.from} onChange={(e) => setEmailBox({ ...emailBox, from: e.target.value })}>
              {Array.from(new Set([settings.defaultEmail, shopEmail(), BRAND.email].filter(Boolean))).map((addr, i) => <option key={i} value={addr}>{addr}</option>)}
            </select>
            <label className="text-[12px] text-neutral-600 block mb-1">To</label>
            <input className={input + " w-full mb-2"} value={emailBox.to} onChange={(e) => setEmailBox({ ...emailBox, to: e.target.value })} placeholder="Customer email" />
            <label className="text-[12px] text-neutral-600 block mb-1">Subject</label>
            <input className={input + " w-full mb-2"} value={emailBox.subject} onChange={(e) => setEmailBox({ ...emailBox, subject: e.target.value })} />
            <label className="text-[12px] text-neutral-600 block mb-1">Message</label>
            <textarea className={input + " w-full"} rows={6} value={emailBox.body} onChange={(e) => setEmailBox({ ...emailBox, body: e.target.value })} />
            <div className="text-[11.5px] text-neutral-500 mt-1">Opens in your email app with the From address noted in the subject line reminder above — most phone/desktop mail apps send from whichever account you're signed into, so pick that account when your mail app opens if you have more than one.</div>
            <button onClick={sendEmailBox} className="w-full mt-3 py-2.5 rounded font-bold flex items-center justify-center gap-2" style={{ background: C.green, color: "#fff" }}><Mail size={16} /> Open in Mail</button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
