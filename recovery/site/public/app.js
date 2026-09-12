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

const bookingForm = document.querySelector('#bookingForm');
const bookingResult = document.querySelector('#bookingResult');
const bookingFallback = document.querySelector('#bookingFallback');
const bookingHoldLink = document.querySelector('#bookingHoldLink');
const bookingReference = document.querySelector('#bookingReference');
const repairArea = document.querySelector('#repairArea');
const starterEstimate = document.querySelector('#starterEstimate');
const starterEstimateInput = document.querySelector('#starterEstimateInput');
const vinInput = bookingForm?.elements.vin;
const vinDecodeButton = document.querySelector('#decodeVinButton');
const vinDecodeStatus = document.querySelector('#vinDecodeStatus');
let bookingAvailability = { taken: [], hours: null };

const bookingServices = {
  Diagnostics: [
    ['Check-engine light or warning light', '$165-$295 diagnostic intake'],
    ['No-start, battery, starter, or charging', '$95-$295 starter range'],
    ['Electrical, drivability, or intermittent concern', '$295-$495 advanced diagnostic range'],
    ['Leak, noise, or vibration check', '$125-$245 inspection range'],
  ],
  'Mobile repair': [
    ['Brakes, pads, rotors, or brake noise', '$180-$320 labor per axle plus parts'],
    ['Battery, alternator, starter, or belt', '$95-$295 labor plus parts'],
    ['Suspension or steering repair', '$180-$450 labor plus parts'],
    ['Fluids, maintenance, or tune-up', '$95-$260 labor plus parts'],
  ],
  Inspection: [
    ['Pre-purchase vehicle inspection', '$149-$219'],
    ['Safety and road-readiness inspection', '$89-$149'],
    ['Diagnostic inspection with photos', '$165-$295'],
    ['Fleet unit inspection', '$125-$225 per unit'],
  ],
  'Diesel or commercial': [
    ['Diesel diagnostic', '$195/hr diagnostic intake'],
    ['Truck or commercial repair visit', '$195/hr plus parts'],
    ['Fleet downtime check', '$195/hr priority assessment'],
  ],
  'Fleet service': [
    ['Preventive maintenance visit', '$150/hr plus parts'],
    ['Multi-unit inspection', '$125-$225 per unit'],
    ['Emergency fleet response', '$195/hr priority response'],
  ],
  'Small engine': [
    ['Mower, generator, or small motor diagnostic', '$80-$165 intake'],
    ['Tune-up or maintenance', '$95-$225 plus parts'],
    ['No-start or fuel concern', '$95-$225 plus parts'],
  ],
  'Estimate or claim documentation': [
    ['Photo estimate documentation', '$89-$165'],
    ['Insurance or warranty claim support', '$125-$245'],
    ['Body, paint, or collision review', '$125-$245'],
  ],
  'Repair or shop consulting': [
    ['Repair plan review', '$125-$250'],
    ['Shop process or estimate review', '$125-$250'],
  ],
  'Warranty claim': [
    ['Warranty concern review', '$95-$195'],
    ['Documentation and diagnosis support', '$165-$295'],
  ],
};

function selectedStarterRange() {
  const service = bookingForm?.elements.service?.value || '';
  const choice = repairArea?.value || '';
  const match = (bookingServices[service] || []).find(([label]) => label === choice);
  return match ? `${choice}: ${match[1]}` : '';
}

function updateRepairChoices() {
  if (!bookingForm || !repairArea) return;
  const service = bookingForm.elements.service.value;
  const options = bookingServices[service] || [];
  repairArea.replaceChildren(new Option(options.length ? 'Choose one' : 'Choose service first', ''));
  for (const [label] of options) repairArea.append(new Option(label, label));
  updateStarterEstimate();
}

function updateStarterEstimate() {
  if (!starterEstimate) return;
  const range = selectedStarterRange();
  const partsPlan = bookingForm?.elements.parts_provider?.value || 'Choose a parts plan';
  if (starterEstimateInput) starterEstimateInput.value = range;
  starterEstimate.innerHTML = range
    ? `<b>Starter planning range</b><span>${range}</span><small>Parts: ${partsPlan}. Ranges use Peaceful Motors labor-guide starting points and the shop parts matrix where available. Final written estimates are confirmed after diagnosis, fitment, and live parts pricing.</small>`
    : '<b>Starter planning range</b><span>Choose a service and specific repair area to see the intake estimate.</span><small>Ranges are for booking and planning only. The final written estimate is sent after diagnosis, labor-guide review, and parts confirmation.</small>';
}

const bookingParams = new URLSearchParams(location.search);
const requestedService = bookingParams.get('service');
const requestedWindow = bookingParams.get('time');
if (bookingForm) {
  const safePrefills = {
    name: bookingParams.get('name'),
    phone: bookingParams.get('phone'),
    email: bookingParams.get('email'),
    model: bookingParams.get('vehicle'),
    date: bookingParams.get('date'),
    issue: bookingParams.get('issue'),
    pref: bookingParams.get('pref'),
  };
  for (const [field, value] of Object.entries(safePrefills)) {
    if (value && bookingForm.elements[field]) bookingForm.elements[field].value = String(value).slice(0, field === 'issue' ? 1000 : 120);
  }
}
if (bookingForm && requestedService) {
  const serviceSelect = bookingForm.elements.service;
  const serviceAliases = {
    diagnostics: 'Diagnostics',
    'mobile-repair': 'Mobile repair',
    inspection: 'Inspection',
    diesel: 'Diesel or commercial',
    fleet: 'Fleet service',
    'small-engine': 'Small engine',
    consulting: 'Repair or shop consulting',
  };
  const wanted = serviceAliases[requestedService] || requestedService;
  if (serviceSelect && [...serviceSelect.options].some((option) => option.value === wanted)) serviceSelect.value = wanted;
}
bookingForm?.elements.service?.addEventListener('change', updateRepairChoices);
repairArea?.addEventListener('change', updateStarterEstimate);
bookingForm?.elements.parts_provider?.addEventListener('change', updateStarterEstimate);
updateRepairChoices();

function cleanVin(value) {
  return String(value || '').toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, '').slice(0, 17);
}

async function decodeBookingVin() {
  if (!bookingForm || !vinInput || !vinDecodeStatus) return;
  const vin = cleanVin(vinInput.value);
  vinInput.value = vin;
  if (vin.length !== 17) {
    vinDecodeStatus.textContent = 'Enter a 17-character VIN to decode the vehicle.';
    vinDecodeStatus.classList.add('error');
    return;
  }
  vinDecodeStatus.classList.remove('error');
  vinDecodeStatus.textContent = 'Decoding VIN...';
  if (vinDecodeButton) vinDecodeButton.disabled = true;
  try {
    const response = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(vin)}?format=json`);
    if (!response.ok) throw new Error('VIN lookup is temporarily unavailable.');
    const result = await response.json();
    const decoded = result?.Results?.[0] || {};
    const errorCode = String(decoded.ErrorCode || '');
    const hasHardError = errorCode && !['0', '1', '6', '7', '14'].includes(errorCode);
    if (hasHardError) throw new Error(decoded.ErrorText || 'That VIN did not decode cleanly.');
    if (decoded.ModelYear && bookingForm.elements.year) bookingForm.elements.year.value = decoded.ModelYear;
    if (decoded.Make && bookingForm.elements.make) bookingForm.elements.make.value = decoded.Make;
    if (decoded.Model && bookingForm.elements.model) bookingForm.elements.model.value = decoded.Model;
    const vehicle = [decoded.ModelYear, decoded.Make, decoded.Model].filter(Boolean).join(' ');
    vinDecodeStatus.textContent = vehicle ? `VIN decoded: ${vehicle}. Please confirm trim, engine, and mileage.` : 'VIN decoded. Please confirm the vehicle details before booking.';
  } catch (error) {
    vinDecodeStatus.classList.add('error');
    vinDecodeStatus.textContent = `${error.message} You can still type year, make, and model manually.`;
  } finally {
    if (vinDecodeButton) vinDecodeButton.disabled = false;
  }
}

vinDecodeButton?.addEventListener('click', decodeBookingVin);
vinInput?.addEventListener('blur', () => {
  if (cleanVin(vinInput.value).length === 17) decodeBookingVin();
});

function localIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function phaseForDate(dateString) {
  const phases = bookingAvailability.hours?.phases || [];
  return phases.find((phase) => dateString >= phase.from && (!phase.until || dateString <= phase.until));
}

function updateBookingWindows() {
  if (!bookingForm) return;
  const dateInput = bookingForm.elements.date;
  const timeSelect = bookingForm.elements.time;
  const selectedDate = dateInput.value;
  timeSelect.replaceChildren();
  if (!selectedDate) {
    timeSelect.append(new Option('Choose a date first', ''));
    timeSelect.disabled = true;
    return;
  }
  const dayNumber = new Date(`${selectedDate}T12:00:00`).getDay();
  const phase = phaseForDate(selectedDate);
  const windows = phase?.days?.[String(dayNumber)] || [];
  const taken = new Set((bookingAvailability.taken || []).filter((row) => row.booking_date === selectedDate).map((row) => row.booking_window));
  const available = windows.filter((windowName) => !taken.has(windowName));
  if (!available.length) {
    timeSelect.append(new Option('No online windows available', ''));
    timeSelect.disabled = true;
    bookingResult.textContent = 'No online window is open for that date. Choose another date or call 314-919-7456.';
    bookingResult.classList.add('error');
    return;
  }
  timeSelect.append(new Option('Choose a window', ''));
  for (const windowName of available) timeSelect.append(new Option(windowName, windowName));
  if (requestedWindow && available.includes(requestedWindow)) timeSelect.value = requestedWindow;
  timeSelect.disabled = false;
  bookingResult.textContent = '';
  bookingResult.classList.remove('error');
}

async function loadBookingAvailability() {
  if (!bookingForm) return;
  const dateInput = bookingForm.elements.date;
  const now = new Date();
  const max = new Date(now.getTime() + 200 * 86400000);
  dateInput.min = localIsoDate(now);
  dateInput.max = localIsoDate(max);
  dateInput.addEventListener('change', updateBookingWindows);
  try {
    const response = await fetch('/api/book', { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('Availability is temporarily unavailable.');
    bookingAvailability = await response.json();
    updateBookingWindows();
  } catch (error) {
    bookingResult.textContent = `${error.message} Call or text 314-919-7456.`;
    bookingResult.classList.add('error');
  }
}
loadBookingAvailability();

function bookingReferenceFrom(result) {
  const candidates = [
    result?.payment_reference,
    result?.booking?.payment_reference,
    result?.short_ref,
    result?.booking?.short_ref,
    result?.booking_short_ref,
    result?.booking_id,
    result?.booking?.id,
    result?.id,
  ];
  return String(candidates.find(Boolean) || '').trim();
}

function bookingText(data) {
  return `Hello Peaceful Motors. Service request from ${data.name}. Phone: ${data.phone}. Email: ${data.email || 'not provided'}. Vehicle/equipment: ${data.vehicle || 'not provided'}. Service: ${data.service || 'not provided'}. Specific request: ${data.repair_area || 'not provided'}. Parts: ${data.parts_provider || 'not provided'}. Starter range shown: ${data.starter_estimate || 'not selected'}. Preferred date/time: ${data.date || 'first available'} ${data.time || 'flexible'}. Concern/location: ${data.issue}`;
}

bookingForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const submit = bookingForm.querySelector('button[type="submit"]');
  const data = Object.fromEntries(new FormData(bookingForm).entries());
  if (!data.vehicle) {
    const vehicleParts = [data.year, data.make, data.model].filter(Boolean);
    data.vehicle = vehicleParts.join(' ').trim();
    if (data.vin) data.vehicle += `${data.vehicle ? ' · ' : ''}VIN ${String(data.vin).toUpperCase()}`;
    if (data.mileage) data.vehicle += `${data.vehicle ? ' · ' : ''}${data.mileage} miles`;
  }
  if (data.service || data.address || data.zip) {
    const context = [
      data.service ? `Service: ${data.service}` : '',
      data.repair_area ? `Specific request: ${data.repair_area}` : '',
      data.parts_provider ? `Parts plan: ${data.parts_provider}` : '',
      data.starter_estimate ? `Starter range shown: ${data.starter_estimate}` : '',
      data.address ? `Location: ${data.address}` : '',
      data.zip ? `ZIP: ${data.zip}` : '',
    ].filter(Boolean).join('. ');
    data.issue = `${context}${context && data.issue ? '. ' : ''}${data.issue || ''}`;
  }
  data.terms = data.terms ? 'accepted' : 'declined';
  bookingResult.classList.remove('error');
  bookingResult.textContent = 'Saving your booking securely...';
  if (bookingReference) {
    bookingReference.hidden = true;
    bookingReference.replaceChildren();
  }
  if (bookingHoldLink) bookingHoldLink.hidden = true;
  bookingFallback.hidden = true;
  submit.disabled = true;
  try {
    const response = await fetch('/api/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Online booking is temporarily unavailable.');
    const reference = bookingReferenceFrom(result);
    if (!reference) throw new Error('Booking saved, but no booking reference came back. Please text Peaceful Motors before paying the hold.');
    bookingResult.textContent = 'Booking saved. Use this reference when paying the Stripe hold.';
    if (bookingReference) {
      bookingReference.hidden = false;
      const label = document.createElement('b');
      label.textContent = 'Booking reference';
      const code = document.createElement('span');
      code.textContent = reference;
      const note = document.createElement('small');
      note.textContent = 'Enter this exact reference in Stripe so the hold reconciles to this booking.';
      bookingReference.replaceChildren(label, code, note);
    }
    if (bookingHoldLink) bookingHoldLink.hidden = false;
    submit.textContent = 'Booking saved';
  } catch (error) {
    bookingResult.classList.add('error');
    bookingResult.textContent = `${error.message} Nothing was lost—use the text button below.`;
    bookingFallback.href = `sms:+13149197456?&body=${encodeURIComponent(bookingText(data))}`;
    bookingFallback.hidden = false;
  } finally {
    submit.disabled = false;
  }
});
