const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const jiti = require('jiti')(path.join(process.cwd(), 'scripts/test-theme.cjs'));
const theme = jiti(path.join(process.cwd(), 'src/lib/theme.ts'));

test('theme selection persists across routes and a simulated reload', () => {
  const values = new Map();
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
  assert.equal(theme.readThemePreference(storage), 'system');
  theme.saveThemePreference(storage, 'dark');
  assert.equal(theme.readThemePreference(storage), 'dark');
  assert.equal(theme.themeIsDark(theme.readThemePreference(storage), false), true);
  theme.saveThemePreference(storage, 'system');
  assert.equal(theme.themeIsDark(theme.readThemePreference(storage), true), true);
  assert.equal(theme.themeIsDark(theme.readThemePreference(storage), false), false);
});

test('saved dark preference is applied before the app stylesheet paints', () => {
  let dark = false;
  const classes = { toggle: (name, value) => { assert.equal(name, 'dark'); dark = value; } };
  vm.runInNewContext(theme.THEME_BOOTSTRAP, {
    localStorage: { getItem: () => 'dark' }, matchMedia: () => ({ matches: false }),
    document: { documentElement: { classList: classes, style: {} } },
  });
  assert.equal(dark, true);
});

test('root provider and shell control cover Operations, Onboarding and Active Owner routes', () => {
  const root = fs.readFileSync('src/routes/__root.tsx', 'utf8');
  const shell = fs.readFileSync('src/components/AppShell.tsx', 'utf8');
  assert.match(root, /<ThemeProvider><DemoProvider>/);
  assert.match(root, /<script dangerouslySetInnerHTML=\{\{ __html: THEME_BOOTSTRAP \}\} \/>/);
  assert.match(shell, /<ThemeControl \/>/);
});

test('client-facing PDF uses fixed light brand colors independent of app theme', () => {
  const pdf = fs.readFileSync('src/lib/availability-options-pdf.ts', 'utf8');
  assert.match(pdf, /const navy = rgb\(/);
  assert.match(pdf, /const teal = rgb\(/);
  assert.doesNotMatch(pdf, /useTheme|document\.documentElement|localStorage/);
});
