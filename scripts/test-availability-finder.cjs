const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const jiti = require('jiti')(path.join(process.cwd(), 'scripts/test-availability-finder.cjs'));
const finder = jiti(path.join(process.cwd(), 'src/lib/availability-finder.ts'));
const { propertyOptionsPdf, propertyPdfFacts } = jiti(path.join(process.cwd(), 'src/lib/availability-options-pdf.ts'));
const { filterFinderResults, parseFinderFilters, activeFinderFilters } = jiti(path.join(process.cwd(), 'src/lib/availability-filters.ts'));
const { activePublicListing } = jiti(path.join(process.cwd(), 'src/lib/availability-listing.ts'));
const { PDFDocument, PDFName } = require('pdf-lib');
const { ownerRezGet } = jiti(path.join(process.cwd(), 'src/lib/ownerrez.server.ts'));
const { activeMapCount, mapPinColor } = jiti(path.join(process.cwd(), 'src/lib/geo.ts'));

const booking = (arrival, departure, extras = {}) => ({ arrival, departure, ...extras });
const stay = { checkIn: '2026-10-01', checkOut: '2026-12-31', location: 'Dallas, TX' };
const url = 'https://arealhomeaway.hosted.ownerrez.com/foxtail';
const property = (over = {}) => ({
  id: 'home-1', name: 'Foxtail', address: '123 Main St, Dallas, TX', lat: 32.7767, lng: -96.797,
  bedrooms: 3, bathrooms: 2, maxGuests: 6, propertyType: 'House', petFriendly: null, amenities: [], imageUrl: null, bookingUrl: url,
  distanceMiles: 4, status: 'available', strConflicts: [], nonMovableConflicts: [], ...over,
});

test('validates date order and date existence', () => {
  assert.equal(finder.validStay('2026-10-01', '2026-10-02'), true);
  assert.equal(finder.validStay('2026-02-30', '2026-03-02'), false);
  assert.equal(finder.validStay('2026-10-02', '2026-10-01'), false);
});
test('no conflict is Available', () => assert.equal(finder.classifyAvailability([], stay.checkIn, stay.checkOut).status, 'available'));
test('middle STR in a three-month stay remains Conditional', () => {
  const result = finder.classifyAvailability([booking('2026-11-05', '2026-11-09')], stay.checkIn, stay.checkOut);
  assert.equal(result.status, 'conditional');
  assert.deepEqual(result.strConflicts.map((conflict) => [conflict.arrival, conflict.departure]), [['2026-11-05', '2026-11-09']]);
});
test('all overlapping STR ranges are disclosed', () => {
  const result = finder.classifyAvailability([booking('2026-12-02', '2026-12-05'), booking('2026-10-09', '2026-10-12')], stay.checkIn, stay.checkOut);
  assert.equal(result.strConflicts.length, 2);
  assert.equal(result.strConflicts[0].arrival, '2026-10-09');
});
test('MTR and block are non-movable, including when an STR also overlaps', () => {
  for (const conflict of [booking('2026-11-01', '2026-12-10'), booking('2026-11-02', '2026-11-03', { is_block: true })])
    assert.equal(finder.classifyAvailability([booking('2026-10-05', '2026-10-07'), conflict], stay.checkIn, stay.checkOut).status, 'unavailable');
});
test('checkout is exclusive and cancelled bookings do not conflict', () => {
  assert.equal(finder.classifyAvailability([booking('2026-09-20', '2026-10-01'), booking('2026-10-02', '2026-10-03', { status: 'Cancelled' }), booking('2026-10-04', '2026-10-05', { status: 'Canceled' })], stay.checkIn, stay.checkOut).status, 'available');
});
test('20-mile population is shared by map/list and sorted by distance', () => {
  const nearby = finder.nearbyProperties([property({ id: 'outside', lat: 33.3 }), property({ id: 'near', lat: 32.78 }), property({ id: 'middle', lat: 32.9 })], { lat: 32.7767, lng: -96.797 });
  assert.deepEqual(nearby.map((row) => row.id), ['near', 'middle']);
  assert.deepEqual(finder.visibleResults(nearby.map((row) => ({ ...row, status: row.id === 'near' ? 'available' : 'unavailable' })), false).map((row) => row.id), ['near']);
});
test('bedroom, bathroom, capacity and combined filters fail closed on missing values', () => {
  const rows = [property(), property({ id: 'small', bedrooms: 1, bathrooms: 1, maxGuests: 2 }), property({ id: 'unknown', bedrooms: null, bathrooms: null, maxGuests: null })];
  for (const patch of [{ minBedrooms: 3 }, { minBathrooms: 2 }, { minGuests: 6 }, { minBedrooms: 3, minBathrooms: 2, minGuests: 6 }]) {
    const result = filterFinderResults(rows, { ...parseFinderFilters({}), ...patch });
    assert.deepEqual(result.map((row) => row.id), ['home-1']);
  }
});
test('pet-friendly required excludes unknown and false but no pets needed remains inclusive', () => {
  const rows = [property(), property({ id: 'yes', petFriendly: true }), property({ id: 'no', petFriendly: false })];
  assert.deepEqual(filterFinderResults(rows, { ...parseFinderFilters({}), pets: 'required' }).map((row) => row.id), ['yes']);
  assert.equal(filterFinderResults(rows, { ...parseFinderFilters({}), pets: 'none' }).length, 3);
});
test('radius, property type, classification, verified amenities and sort compose for map/list', () => {
  const rows = [property({ id: 'near', distanceMiles: 4, bedrooms: 2, amenities: ['Parking'] }),
    property({ id: 'far', distanceMiles: 18, propertyType: 'Condo', status: 'conditional', bedrooms: 5, amenities: ['Parking'] }),
    property({ id: 'outside', distanceMiles: 21, amenities: ['Parking'] })];
  const filters = { ...parseFinderFilters({ radius: '20', sort: 'bedrooms', amenities: 'Parking' }), propertyType: 'Condo', status: 'conditional' };
  const population = filterFinderResults(rows, filters);
  assert.deepEqual(population.map((row) => row.id), ['far']);
  assert.deepEqual(filterFinderResults(rows, { ...filters, radius: 10 }), []);
});
test('finder URL filters parse safely and active chips represent removable state', () => {
  const filters = parseFinderFilters({ minBedrooms: '3', minBathrooms: '2', minGuests: '6', pets: 'required', radius: '10', status: 'conditional', propertyType: 'House', amenities: 'Parking', sort: 'guests' });
  assert.equal(filters.minBedrooms, 3); assert.equal(filters.radius, 10); assert.equal(filters.sort, 'guests');
  assert.ok(activeFinderFilters(filters).some((chip) => chip.label === 'Pet-friendly required'));
  assert.equal(parseFinderFilters({ radius: '50', minBedrooms: '-1' }).radius, 20);
});
test('owner and vendor cannot access finder', () => {
  for (const role of ['owner', 'vendor']) assert.equal(finder.canUseAvailabilityFinder([role]), false);
  for (const role of ['admin', 'manager', 'tech']) assert.equal(finder.canUseAvailabilityFinder([role]), true);
});
test('OwnerRez reservation access is GET-only', async () => {
  const oldFetch = global.fetch;
  const oldUser = process.env.OWNERREZ_USERNAME;
  const oldToken = process.env.OWNERREZ_ACCESS_TOKEN;
  process.env.OWNERREZ_USERNAME = 'fixture@example.test';
  process.env.OWNERREZ_ACCESS_TOKEN = 'fixture';
  global.fetch = async (requested, options) => {
    assert.match(String(requested), /\/v2\/bookings\?/);
    assert.ok(!options.method || options.method === 'GET');
    return { ok: true, json: async () => ({ items: [] }) };
  };
  try { assert.deepEqual(await ownerRezGet('/bookings', { property_ids: '1' }), { items: [] }); }
  finally {
    global.fetch = oldFetch;
    if (oldUser === undefined) delete process.env.OWNERREZ_USERNAME; else process.env.OWNERREZ_USERNAME = oldUser;
    if (oldToken === undefined) delete process.env.OWNERREZ_ACCESS_TOKEN; else process.env.OWNERREZ_ACCESS_TOKEN = oldToken;
  }
});
test('existing Work Map urgency behavior remains intact', () => {
  const pin = { propertyId: 'home-1', name: 'Home', address: 'Dallas', lat: 32.7, lng: -96.8,
    openJobs: [{ id: 'ticket-1', ref: 1, title: 'Issue', priority: 'p1', status: 'open', dueAt: null, vendorName: null, vendorStatus: null }] };
  assert.equal(activeMapCount(pin), 1);
  assert.equal(mapPinColor(pin), '#b42318');
});
test('public listing validator rejects admin, preview, tokens and arbitrary hosts', () => {
  assert.equal(finder.verifiedPublicListingUrl(url), url);
  for (const bad of [null, '', 'http://arealhomeaway.hosted.ownerrez.com/foxtail', 'https://app.ownerrez.com/properties/12', 'https://preview--smart-stay-support.lovable.app/', 'https://arealhomeaway.hosted.ownerrez.com/foxtail?token=abc', 'https://arealhomeaway.hosted.ownerrez.com/admin/12', 'https://arealhomeaway.hosted.ownerrez.com/12345', 'https://other.hosted.ownerrez.com/foxtail'])
    assert.equal(finder.verifiedPublicListingUrl(bad), null);
});
test('public listing must be reachable HTML without an auth or external redirect', async () => {
  const good = async (target, options) => {
    assert.equal(target, url); assert.equal(options.method, 'GET');
    return { ok: true, url, headers: { get: () => 'text/html; charset=utf-8' } };
  };
  assert.equal(await activePublicListing(url, good), true);
  assert.equal(await activePublicListing(url, async () => ({ ok: true, url: 'https://app.ownerrez.com/login', headers: { get: () => 'text/html' } })), false);
  assert.equal(await activePublicListing(url, async () => ({ ok: false, url, headers: { get: () => 'text/html' } })), false);
});
test('conditional external copy contains no relocation or conflict dates', () => {
  const conditional = property({ status: 'conditional', strConflicts: [{ arrival: '2026-11-05', departure: '2026-11-09', kind: 'str' }] });
  const text = finder.emailSummary([conditional], stay.checkIn, stay.checkOut, stay.location);
  assert.match(text, /final confirmation/);
  assert.ok(!text.includes('relocation') && !text.includes('2026-11-05'));
  assert.match(text, /arealhomeaway\.hosted\.ownerrez\.com\/foxtail/);
});
test('PDF blocks missing, malformed and unavailable properties', async () => {
  for (const row of [property({ bookingUrl: null }), property({ bookingUrl: 'https://app.ownerrez.com/properties/12' }), property({ status: 'unavailable' })])
    await assert.rejects(propertyOptionsPdf([row], stay), /verified public listing/);
});
test('PDF renders when optional property counts or image are absent', async () => {
  const bytes = await propertyOptionsPdf([property({ bedrooms: null, bathrooms: null, maxGuests: null, imageUrl: null })], stay);
  assert.equal((await PDFDocument.load(bytes)).getPageCount(), 1);
});
test('PDF CTA, readable URL and image share the same public hyperlink', async () => {
  const image = fs.readFileSync(path.join(process.cwd(), 'public/favicon.png'));
  const originalFetch = global.fetch;
  global.fetch = async (requested) => ({ ok: true, headers: { get: () => 'image/png' }, arrayBuffer: async () => image.buffer.slice(image.byteOffset, image.byteOffset + image.byteLength) });
  try {
    const bytes = await propertyOptionsPdf([property({ status: 'conditional', imageUrl: 'https://example.com/photo.png', strConflicts: [{ arrival: '2026-11-05', departure: '2026-11-09', kind: 'str' }] })], stay);
    const pdf = await PDFDocument.load(bytes);
    const page = pdf.getPages()[0];
    const annots = page.node.Annots();
    assert.equal(annots.size(), 2);
    const destinations = [];
    for (let i = 0; i < annots.size(); i++) {
      const annotation = pdf.context.lookup(annots.get(i));
      const action = pdf.context.lookup(annotation.get(PDFName.of('A')));
      destinations.push(action.get(PDFName.of('URI')).decodeText());
    }
    assert.deepEqual(destinations, [url, url]);
    const text = Buffer.from(bytes).toString('latin1');
    assert.ok(!text.includes('2026-11-05'));
  } finally { global.fetch = originalFetch; }
});
test('PDF uses only the explicitly supplied properties and includes verified attributes', async () => {
  const selected = property({ petFriendly: true, amenities: ['Parking', 'Workspace'] });
  const facts = propertyPdfFacts(selected);
  assert.match(facts.capacity, /Bedrooms: 3.*Bathrooms: 2.*Guests: 6/);
  assert.equal(facts.pets, 'Pets: Pet-friendly');
  assert.match(facts.amenities, /Parking, Workspace/);
  assert.equal(propertyPdfFacts(property()).pets, 'Pets: Not specified');
  const pdf = await PDFDocument.load(await propertyOptionsPdf([selected], stay));
  assert.equal(pdf.getPageCount(), 1);
  assert.equal(pdf.getPages()[0].node.Annots().size(), 1);
});
