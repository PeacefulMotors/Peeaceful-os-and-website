const THEME_KEY = 'peaceful-theme';
const ORDER = ['system', 'light', 'dark'];
const ICON = { system: '◐', light: '☀', dark: '☾' };

function effectiveTheme(choice) {
  return choice === 'system'
    ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : choice;
}

function applyTheme(choice) {
  const safe = ORDER.includes(choice) ? choice : 'system';
  document.documentElement.dataset.theme = effectiveTheme(safe);
  document.documentElement.dataset.themeChoice = safe;
  const button = document.querySelector('#themeToggle');
  if (button) {
    const icon = button.querySelector('span');
    if (icon) icon.textContent = ICON[safe];
    else button.textContent = ICON[safe];
    button.setAttribute('aria-label', `Theme: ${safe}. Activate to change.`);
    button.title = `Theme: ${safe}`;
  }
}

const savedTheme = localStorage.getItem(THEME_KEY) || 'system';
applyTheme(savedTheme);
document.querySelector('#themeToggle')?.addEventListener('click', () => {
  const current = document.documentElement.dataset.themeChoice || 'system';
  const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length];
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
});
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if ((localStorage.getItem(THEME_KEY) || 'system') === 'system') applyTheme('system');
});
document.querySelector('#year')?.replaceChildren(String(new Date().getFullYear()));

const dockItems = [
  ['Services', '/services'],
  ['Prices', '/prices'],
  ['Explore', '/explore'],
  ['Policies', '/policies'],
  ['Book', '/book'],
];
const mobileDock = document.createElement('nav');
mobileDock.className = 'mobile-dock';
mobileDock.setAttribute('aria-label', 'Mobile primary navigation');
for (const [label, href] of dockItems) {
  const link = document.createElement('a');
  link.href = href;
  link.textContent = label;
  if ((location.pathname === '/' && href === '/') || location.pathname === href || (href === '/policies' && ['/terms', '/privacy', '/warranty', '/limits-and-liability'].includes(location.pathname))) link.setAttribute('aria-current', 'page');
  mobileDock.appendChild(link);
}
document.body.appendChild(mobileDock);

// ---------------------------------------------------------------------------
// Booking page (/book). Runs only when the booking form exists.
// Backend contract (POST /api/book) is unchanged: the same field names are
// sent, and `service` is a plain string. Dash cam kits keep their exact kit
// strings; everything else is "Category: Specific service".
// ---------------------------------------------------------------------------
const BOOK_PHONE_NOTE = 'Call or text 314-919-7456.';
const BOOKING_CATALOG = [
  { key: 'diagnostics', label: 'Diagnostics', items: [
    ['Check-engine light or warning light', '$165-$295 diagnostic intake'],
    ['No-start, battery, starter, or charging', '$95-$295 starter range'],
    ['Electrical, drivability, or intermittent concern', '$295-$495 advanced diagnostic range'],
    ['Leak, noise, or vibration check', '$125-$245 inspection range'],
  ] },
  { key: 'mobile-repair', label: 'Mobile Mechanical Repair', items: [
    ['Brakes, pads, rotors, or brake noise', '$180-$320 labor per axle plus parts'],
    ['Battery, alternator, starter, or belt', '$95-$295 labor plus parts'],
    ['Suspension or steering repair', '$180-$450 labor plus parts'],
    ['Fluids, maintenance, or tune-up', '$95-$260 labor plus parts'],
    ['Cooling system repair', 'Quoted after diagnosis; standard labor $150/hr plus parts'],
  ] },
  { key: 'inspection', label: 'Inspections', items: [
    ['Essential inspection', '$89'],
    ['Standard inspection', '$149'],
    ['Comprehensive inspection', '$219'],
    ['Pre-purchase vehicle inspection', '$149-$219 (Standard or Comprehensive)'],
  ] },
  { key: 'dashcam', label: 'Dash Cam / Vehicle Technology', kit: true, items: [
    ['Dash Cam Kit — Daily Driver Front ($335)', '$335 installed kit'],
    ['Dash Cam Kit — Value Front + Rear ($515)', '$515 installed kit'],
    ['Dash Cam Kit — Front + Rear Shield ($615)', '$615 installed kit'],
    ['Dash Cam Kit — Rideshare 3-Channel ($805)', '$805 installed kit'],
    ['Dash Cam Kit — Flagship 3-Channel ($845)', '$845 installed kit'],
    ['Dash Cam Install — Bring Your Own Front ($129)', '$129 install only'],
    ['Dash Cam Install — Bring Your Own Front + Rear ($199)', '$199 install only'],
    ['Dash Cam Install — Bring Your Own 3-Channel ($249)', '$249 install only'],
    ['Dash cam install', 'Help me choose; install-only from $129'],
  ] },
  { key: 'diesel', label: 'Diesel / Commercial', items: [
    ['Diesel diagnostic', '$195/hr diagnostic intake'],
    ['Truck or commercial repair visit', '$195/hr plus parts'],
    ['Fleet downtime check', '$195/hr priority assessment'],
    ['Fleet preventive maintenance visit', '$150/hr plus parts'],
    ['Multi-unit fleet inspection', '$125-$225 per unit'],
    ['Emergency fleet response', '$195/hr priority response'],
  ] },
  { key: 'records', label: 'Estimates / Documentation', items: [
    ['Photo estimate documentation', '$89-$165'],
    ['Insurance or warranty claim support', '$125-$245'],
    ['Repair plan review', '$125-$250'],
    ['Shop process or estimate review', '$125-$250'],
  ] },
  { key: 'small-engine', label: 'Small Engine', items: [
    ['Mower, generator, or small motor diagnostic', '$80-$165 intake'],
    ['Tune-up or maintenance', '$95-$225 plus parts'],
    ['No-start or fuel concern', '$95-$225 plus parts'],
  ] },
  { key: 'warranty', label: 'Warranty / Follow-up', items: [
    ['Warranty concern review', '$95-$195'],
    ['Documentation and diagnosis support', '$165-$295'],
    ['Follow-up on a previous Peaceful Motors repair', 'Reviewed under the Peaceful Motors warranty terms'],
  ] },
  { key: 'other', label: 'Other', items: [
    ['Not sure what I need', 'Starts with Diagnostics Level 1, $165 (up to 1 hour)'],
  ] },
];
const BOOKING_ALIASES = { diagnostics: 'diagnostics', 'mobile-repair': 'mobile-repair', repair: 'mobile-repair', inspection: 'inspection', inspections: 'inspection', diesel: 'diesel', fleet: 'diesel', 'small-engine': 'small-engine', records: 'records', consulting: 'records', dashcam: 'dashcam', 'dash-cam': 'dashcam', dashkit: 'dashcam', warranty: 'warranty', other: 'other', 'not-sure': 'other' };
const BOOKING_LAST_KEY = 'peaceful-last-booking';

const bookingForm = document.querySelector('#bookingForm');

function bookCategory(key) {
  return BOOKING_CATALOG.find((group) => group.key === key) || null;
}

function bookDisplayLabel(label) {
  if (label === 'Dash cam install') return 'Dash cam install (help me choose)';
  return label.replace('Dash Cam Kit — ', 'Kit: ').replace('Dash Cam Install — Bring Your Own ', 'Install only: Bring Your Own ');
}

function bookServiceString(group, item) {
  if (!group || !item) return '';
  if (group.kit) return item;
  if (group.key === 'other') return 'Diagnostics: Not sure what I need';
  return `${group.label}: ${item}`;
}

function formatBookDay(iso) {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(`${iso}T00:00:00Z`));
}

function bookingReferenceFrom(result) {
  const candidates = [
    result?.payment_reference,
    result?.booking?.payment_reference,
    result?.short_ref,
    result?.booking?.short_ref,
    result?.booking_short_ref,
  ];
  return String(candidates.find(Boolean) || '').trim().toUpperCase();
}

if (bookingForm) {
  const categorySelect = document.querySelector('#bookCategory');
  const specificSelect = document.querySelector('#repairArea');
  const serviceValue = document.querySelector('#bookServiceValue');
  const partsSelect = document.querySelector('#bookParts');
  const estimateValue = document.querySelector('#starterEstimateValue');
  const estimateInput = document.querySelector('#starterEstimateInput');
  const daySelect = document.querySelector('#bookDay');
  const windowSelect = document.querySelector('#bookWindow');
  const availStatus = document.querySelector('#bookAvailStatus');
  const submitButton = document.querySelector('#bookSubmit');
  const result = document.querySelector('#bookingResult');
  const fallback = document.querySelector('#bookingFallback');
  const success = document.querySelector('#bookingSuccess');
  const refValue = document.querySelector('#bookingRefValue');
  const successMeta = document.querySelector('#bookingSuccessMeta');
  const copyButton = document.querySelector('#copyRefButton');
  const copyStatus = document.querySelector('#copyRefStatus');
  const params = new URLSearchParams(location.search);
  let openSlots = new Map();
  let availabilityVerified = false;

  for (const group of BOOKING_CATALOG) categorySelect.append(new Option(group.label, group.key));

  function updateEstimate() {
    const group = bookCategory(categorySelect.value);
    const item = specificSelect.value;
    const match = group?.items.find(([label]) => label === item);
    const range = match ? `${bookDisplayLabel(item)}: ${match[1]}` : '';
    estimateInput.value = range;
    estimateValue.textContent = range || 'Choose a service to see the starter range.';
    serviceValue.value = bookServiceString(group, match ? item : '');
  }

  function updateSpecific() {
    const group = bookCategory(categorySelect.value);
    specificSelect.replaceChildren(new Option(group ? 'Choose a service' : 'Choose a category first', ''));
    if (group) {
      for (const [label] of group.items) specificSelect.append(new Option(bookDisplayLabel(label), label));
      if (group.items.length === 1) specificSelect.value = group.items[0][0];
    }
    specificSelect.disabled = !group;
    updateEstimate();
  }

  categorySelect.addEventListener('change', updateSpecific);
  specificSelect.addEventListener('change', updateEstimate);
  partsSelect?.addEventListener('change', updateEstimate);

  const requested = String(params.get('service') || '').trim();
  if (requested) {
    const directGroup = BOOKING_CATALOG.find((group) => group.items.some(([label]) => label === requested));
    const key = BOOKING_ALIASES[requested.toLowerCase()] || directGroup?.key || '';
    if (bookCategory(key)) {
      categorySelect.value = key;
      updateSpecific();
      if (directGroup) { specificSelect.value = requested; updateEstimate(); }
    }
  }
  const prefills = { first_name: params.get('first_name'), last_name: params.get('last_name'), phone: params.get('phone'), email: params.get('email'), model: params.get('vehicle'), issue: params.get('issue'), pref: params.get('pref') };
  for (const [field, value] of Object.entries(prefills)) {
    if (value && bookingForm.elements[field]) bookingForm.elements[field].value = String(value).slice(0, field === 'issue' ? 1000 : 120);
  }
  if (!categorySelect.value) updateSpecific();

  function setAvailMessage(text, isError) {
    availStatus.textContent = text;
    availStatus.classList.toggle('book-error', Boolean(isError));
  }

  function failClosed() {
    availabilityVerified = false;
    openSlots = new Map();
    daySelect.replaceChildren(new Option('Availability cannot be verified', ''));
    windowSelect.replaceChildren(new Option('Availability cannot be verified', ''));
    daySelect.disabled = true;
    windowSelect.disabled = true;
    submitButton.disabled = true;
    setAvailMessage(`Availability cannot currently be verified. ${BOOK_PHONE_NOTE}`, true);
  }

  function updateWindows() {
    const windows = openSlots.get(daySelect.value) || [];
    windowSelect.replaceChildren(new Option(daySelect.value ? 'Choose a window' : 'Choose a day first', ''));
    for (const name of windows) windowSelect.append(new Option(name, name));
    windowSelect.disabled = !windows.length;
    const wanted = params.get('time');
    if (wanted && windows.includes(wanted)) windowSelect.value = wanted;
  }
  daySelect.addEventListener('change', updateWindows);

  async function loadAvailability() {
    try {
      const response = await fetch('/api/book', { headers: { Accept: 'application/json' }, cache: 'no-store' });
      if (!response.ok) throw new Error('unavailable');
      const data = await response.json();
      if (!Array.isArray(data?.slots)) throw new Error('unavailable');
      // The server's 90-day limit is checked at noon UTC of the booking date.
      const limitMs = Date.now() + 90 * 86400000;
      const byDay = new Map();
      for (const slot of data.slots) {
        if (slot?.available !== true || !/^\d{4}-\d{2}-\d{2}$/.test(String(slot.date)) || typeof slot.window !== 'string') continue;
        if (new Date(`${slot.date}T12:00:00Z`).getTime() > limitMs) continue;
        if (!byDay.has(slot.date)) byDay.set(slot.date, []);
        byDay.get(slot.date).push(slot.window);
      }
      openSlots = byDay;
      availabilityVerified = true;
      const days = [...byDay.keys()].sort();
      daySelect.replaceChildren(new Option(days.length ? 'Choose a day' : 'No open days right now', ''));
      for (const day of days) daySelect.append(new Option(formatBookDay(day), day));
      daySelect.disabled = !days.length;
      submitButton.disabled = !days.length;
      const wantedDay = params.get('date');
      if (wantedDay && byDay.has(wantedDay)) daySelect.value = wantedDay;
      updateWindows();
      setAvailMessage(days.length ? 'Only open days and windows are listed. Times are Central.' : `No online windows are open right now. ${BOOK_PHONE_NOTE}`, !days.length);
    } catch {
      failClosed();
    }
  }
  loadAvailability();

  function showFieldError(message, field) {
    result.textContent = message;
    result.classList.add('book-error');
    field?.focus();
  }

  function bookingText(data) {
    return `Hello Peaceful Motors. Service request from ${data.name}. Phone: ${data.phone}. Email: ${data.email || 'not provided'}. Vehicle/equipment: ${data.vehicle || 'not provided'}. Service: ${data.service || 'not provided'}. Preferred date/time: ${data.date || 'first available'} ${data.time || 'flexible'}. Concern: ${String(data.issue || '').slice(0, 300)}`;
  }

  function showSuccess(reference, booking) {
    refValue.textContent = reference;
    const date = booking?.booking_date;
    const window = booking?.booking_window;
    if (date && window) {
      successMeta.textContent = `Requested: ${formatBookDay(date)}, ${window} (Central)`;
      successMeta.hidden = false;
    }
    try { localStorage.setItem(BOOKING_LAST_KEY, JSON.stringify({ ref: reference, date: date || '', window: window || '', at: Date.now() })); } catch {}
    bookingForm.hidden = true;
    success.hidden = false;
    success.focus();
    success.scrollIntoView({ block: 'start' });
  }

  copyButton.addEventListener('click', async () => {
    const reference = refValue.textContent.trim();
    let copied = false;
    try {
      if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(reference); copied = true; }
    } catch {}
    if (!copied) {
      const range = document.createRange();
      range.selectNodeContents(refValue);
      const selection = getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      try { copied = document.execCommand('copy'); } catch {}
    }
    copyStatus.textContent = copied ? 'Reference copied.' : 'Reference selected. Copy it from your device menu.';
  });

  bookingForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    result.classList.remove('book-error');
    fallback.hidden = true;
    if (!availabilityVerified) { failClosed(); return; }
    updateEstimate();
    const els = bookingForm.elements;
    if (!categorySelect.value) return showFieldError('Choose a service category.', categorySelect);
    if (!serviceValue.value) return showFieldError('Choose the specific service.', specificSelect);
    if (!els.make.value.trim()) return showFieldError('Enter the vehicle make.', els.make);
    if (!els.model.value.trim()) return showFieldError('Enter the model or equipment.', els.model);
    if (!els.issue.value.trim()) return showFieldError('Describe the concern.', els.issue);
    if (!daySelect.value) return showFieldError('Choose an open day.', daySelect);
    if (!windowSelect.value) return showFieldError('Choose an arrival window.', windowSelect);
    if (!els.first_name.value.trim()) return showFieldError('Enter your first name.', els.first_name);
    if (!els.last_name.value.trim()) return showFieldError('Enter your last name.', els.last_name);
    if (!els.phone.value.trim()) return showFieldError('Enter your mobile phone.', els.phone);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(els.email.value.trim())) return showFieldError('Enter a valid email.', els.email);
    if (!els.zip.value.trim()) return showFieldError('Enter the service ZIP.', els.zip);
    const vinRaw = els.vin.value.trim();
    const vinClean = vinRaw.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, '');
    if (vinRaw && vinClean.length !== 17 && categorySelect.value !== 'small-engine') return showFieldError('A VIN must be 17 characters. Leave it blank if you do not have it.', els.vin);
    if (!els.booking_hold_ack.checked) return showFieldError('Confirm the $50 booking hold.', els.booking_hold_ack);
    if (!els.terms.checked) return showFieldError('Agree to the Terms and Privacy Policy.', els.terms);

    const data = Object.fromEntries(new FormData(bookingForm).entries());
    delete data.service_category;
    data.vehicle = [data.year, data.make, data.model].map((v) => String(v || '').trim()).filter(Boolean).join(' ');
    if (data.mileage) data.vehicle += ` · ${data.mileage} miles`;
    const context = [
      data.address ? `Location: ${data.address}` : '',
      data.zip ? `ZIP: ${data.zip}` : '',
    ].filter(Boolean).join('. ');
    data.issue = `${context}${context ? '. ' : ''}${data.issue || ''}`;
    data.terms = data.terms ? 'accepted' : 'declined';
    data.first_name = String(data.first_name || '').trim();
    data.last_name = String(data.last_name || '').trim();
    data.name = `${data.first_name} ${data.last_name}`.trim();
    data.booking_hold_ack = data.booking_hold_ack ? 'true' : 'false';
    result.textContent = 'Saving your booking securely...';
    submitButton.disabled = true;
    try {
      const response = await fetch('/api/book', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      const body = await response.json().catch(() => ({}));
      if (response.status === 409) {
        loadAvailability();
        throw new Error(body.message || 'That window was just taken. Please choose another time.');
      }
      if (!response.ok) throw new Error(body.message || body.error || 'Online booking is temporarily unavailable.');
      const reference = bookingReferenceFrom(body);
      if (!reference) throw new Error('Booking saved, but no booking reference came back. Please text Peaceful Motors before paying the hold.');
      result.textContent = '';
      showSuccess(reference, body.booking || { booking_date: data.date, booking_window: data.time });
    } catch (error) {
      result.classList.add('book-error');
      result.textContent = `${error.message} Nothing was lost. You can also text us.`;
      fallback.href = `sms:+13149197456?&body=${encodeURIComponent(bookingText(data))}`;
      fallback.hidden = false;
    } finally {
      submitButton.disabled = !availabilityVerified;
    }
  });
}

// ---------------------------------------------------------------------------
// Booking hold return page (/booking/confirmed). URL parameters and saved
// local data are display hints only; payment state always comes from the
// server lookup (/api/booking-status), which reads what the signed Stripe
// webhook recorded.
// ---------------------------------------------------------------------------
const bookingConfirm = document.querySelector('#bookingConfirm');
if (bookingConfirm) {
  const state = document.querySelector('#confirmState');
  const detail = document.querySelector('#confirmDetail');
  const facts = document.querySelector('#confirmFacts');
  const refOut = document.querySelector('#confirmRef');
  const amountRow = document.querySelector('#confirmAmountRow');
  const amountOut = document.querySelector('#confirmAmount');
  const whenRow = document.querySelector('#confirmWhenRow');
  const whenOut = document.querySelector('#confirmWhen');
  const lookup = document.querySelector('#confirmLookup');
  const refInput = document.querySelector('#confirmRefInput');
  const card = document.querySelector('#confirmCard');
  const params = new URLSearchParams(location.search);
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(BOOKING_LAST_KEY) || 'null'); } catch {}
  const refHint = String(params.get('ref') || saved?.ref || '').trim().toUpperCase();
  const sessionHint = String(params.get('session_id') || '').trim();
  let attempts = 0;
  let timer = null;

  function setState(kind, title, text) {
    card.dataset.state = kind;
    state.textContent = title;
    detail.textContent = text;
  }

  function showFacts(data) {
    facts.hidden = false;
    refOut.textContent = data.ref || '';
    if (data.hold_verified && typeof data.amount === 'number') {
      amountOut.textContent = `$${data.amount.toFixed(2)} received`;
      amountRow.hidden = false;
    } else amountRow.hidden = true;
    if (data.booking_date && data.booking_window) {
      whenOut.textContent = `${formatBookDay(data.booking_date)}, ${data.booking_window} (Central)`;
      whenRow.hidden = false;
    } else whenRow.hidden = true;
  }

  async function check(query) {
    clearTimeout(timer);
    attempts += 1;
    try {
      const response = await fetch(`/api/booking-status?${query}`, { headers: { Accept: 'application/json' }, cache: 'no-store' });
      const data = await response.json().catch(() => null);
      if (response.status === 400) { setState('error', 'Check the reference', 'That does not look like a booking reference. It is 8 letters and numbers.'); lookup.hidden = false; return; }
      if (!response.ok || !data?.ok) throw new Error('unavailable');
      if (!data.found) {
        setState('missing', 'Booking not found', 'We could not find a booking with that reference. Check the number, or call or text 314-919-7456.');
        facts.hidden = true;
        lookup.hidden = false;
        return;
      }
      showFacts(data);
      if (data.cancelled) { setState('missing', 'Booking cancelled', 'This booking is marked cancelled. Call or text 314-919-7456 with questions.'); return; }
      if (data.hold_verified) {
        setState('verified', 'Payment verified', 'Stripe confirmed your $50 booking hold and it is recorded on your booking. Thank you. Peaceful Motors will confirm the visit details.');
        lookup.hidden = true;
        return;
      }
      if (attempts < 8) {
        setState('pending', 'Waiting for Stripe confirmation', 'Stripe can take a minute to notify us. This page checks again automatically.');
        timer = setTimeout(() => check(query), 5000);
      } else {
        setState('pending', 'Payment not confirmed yet', 'We have not received the Stripe confirmation yet. If you paid, keep your Stripe receipt and call or text 314-919-7456. You can also check again later.');
        lookup.hidden = false;
      }
    } catch {
      setState('error', 'Payment status cannot be verified right now', 'Please try again in a few minutes. If you paid, your Stripe receipt is your record. Call or text 314-919-7456.');
      lookup.hidden = false;
    }
  }

  lookup.addEventListener('submit', (event) => {
    event.preventDefault();
    const ref = refInput.value.trim().toUpperCase();
    attempts = 0;
    if (!/^[0-9A-F]{8}$/.test(ref)) { setState('error', 'Check the reference', 'A booking reference is 8 letters and numbers, for example 06B8A86B.'); return; }
    setState('checking', 'Checking your booking...', 'Looking up the payment status.');
    check(`ref=${encodeURIComponent(ref)}`);
  });

  if (/^[0-9A-F]{8}$/.test(refHint)) { refInput.value = refHint; check(`ref=${encodeURIComponent(refHint)}`); }
  else if (/^cs_(live|test)_[A-Za-z0-9]{10,200}$/.test(sessionHint)) check(`session_id=${encodeURIComponent(sessionHint)}`);
  else {
    setState('missing', 'Enter your booking reference', 'Enter the 8-character reference from your booking to see the hold status.');
    lookup.hidden = false;
  }
}
