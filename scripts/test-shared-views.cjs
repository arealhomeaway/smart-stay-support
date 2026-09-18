const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const jiti = require('jiti')(path.join(process.cwd(), 'scripts/test-shared-views.cjs'));
const calendar = jiti(path.join(process.cwd(), 'src/lib/collection-calendar.ts'));
const navigation = jiti(path.join(process.cwd(), 'src/lib/nav-context.ts'));

test('collection calendar uses only real dates and moves between months', () => {
  assert.equal(calendar.calendarDays('2026-09').length, 42);
  assert.equal(calendar.shiftCalendarMonth('2026-12', 1), '2027-01');
  assert.equal(calendar.validCalendarMonth('2026-13'), new Date().toISOString().slice(0, 7));
});

test('navigation origin includes URL filters, view, selection and map position', () => {
  const href = '/availability-finder?checkIn=2026-10-01&radius=10&status=conditional&selected=home-1&mapZoom=12';
  const token = navigation.originToken(href);
  assert.equal(token, navigation.originToken(href));
  assert.notEqual(token, navigation.originToken('/availability-finder?checkIn=2026-10-01'));
});

test('shared controls appear only on collection pages with applicable options', () => {
  const read = (name) => fs.readFileSync(name, 'utf8');
  const operations = read('src/routes/_authenticated/team-queue.tsx');
  const onboarding = read('src/components/onboarding/DirectorHub.tsx');
  const owner = read('src/routes/_authenticated/owner.tsx');
  const properties = read('src/routes/_authenticated/properties.tsx');
  assert.match(operations, /<CollectionViewControls[^]*Work Map/);
  assert.match(onboarding, /Kanban by stage/);
  assert.match(onboarding, /<CollectionCalendar/);
  assert.match(owner, /Review deadlines/);
  assert.match(properties, /<CollectionViewControls label="Properties" view="list"/);
  assert.doesNotMatch(onboarding + owner, /Work Map|operations priority|vendor dispatch/);
  assert.doesNotMatch(read('src/routes/_authenticated/onboarding.$propertyId.tsx'), /CollectionViewControls/);
});
