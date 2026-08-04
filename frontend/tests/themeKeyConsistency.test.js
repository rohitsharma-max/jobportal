import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * index.html's inline anti-flash script (see index.html for why it must be
 * inline, blocking, and can't import anything) and src/api/themeStore.js
 * both hardcode the localStorage key, the data-theme attribute name, and the
 * 'light'/'dark' values. Nothing at build time checks they still agree — a
 * rename on one side silently breaks flash-prevention with no error, no
 * failing render, nothing. This test is that check.
 */

const htmlPath = fileURLToPath(new URL('../index.html', import.meta.url));
const themeStorePath = fileURLToPath(new URL('../src/api/themeStore.js', import.meta.url));

const html = readFileSync(htmlPath, 'utf8');
const themeStore = readFileSync(themeStorePath, 'utf8');

function extractInlineScript(source) {
  const match = source.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(match, 'index.html must contain an inline (non-module, non-src) <script> block');
  return match[1];
}

function must(source, regex, label) {
  const match = source.match(regex);
  assert.ok(match, `expected to find ${label}`);
  return match;
}

const inlineScript = extractInlineScript(html);

// --- storage key ---
const moduleKey = must(themeStore, /const THEME_KEY\s*=\s*'([^']+)'/, 'THEME_KEY in themeStore.js')[1];
const htmlKey = must(
  inlineScript,
  /localStorage\.getItem\('([^']+)'\)/,
  "localStorage.getItem('...') in index.html's inline script"
)[1];

test('the inline bootstrap script and themeStore.js read the same localStorage key', () => {
  assert.equal(
    htmlKey,
    moduleKey,
    `index.html reads '${htmlKey}' but themeStore.js's THEME_KEY is '${moduleKey}' — these must be identical or the inline script silently stops preventing the flash`
  );
});

// --- data-theme attribute name ---
const moduleAttr = must(
  themeStore,
  /setAttribute\('([^']+)'/,
  "setAttribute('...', ...) in themeStore.js"
)[1];
const htmlAttr = must(
  inlineScript,
  /setAttribute\('([^']+)'/,
  "setAttribute('...', ...) in index.html's inline script"
)[1];

test('the inline bootstrap script and themeStore.js set the same attribute', () => {
  assert.equal(
    htmlAttr,
    moduleAttr,
    `index.html sets '${htmlAttr}' but themeStore.js sets '${moduleAttr}' — the CSS cascade in index.css keys off a specific attribute name and only one of these would ever match it`
  );
});

// --- the two theme values themselves ---
const moduleLight = must(themeStore, /const LIGHT\s*=\s*'([^']+)'/, "LIGHT constant in themeStore.js")[1];
const moduleDark = must(themeStore, /const DARK\s*=\s*'([^']+)'/, "DARK constant in themeStore.js")[1];
const htmlValues = must(
  inlineScript,
  /theme === '([^']+)' \|\| theme === '([^']+)'/,
  "the theme === '...' || theme === '...' guard in index.html's inline script"
);

test("the inline bootstrap script and themeStore.js agree on the 'light'/'dark' values", () => {
  const moduleValues = new Set([moduleLight, moduleDark]);
  const htmlValueSet = new Set([htmlValues[1], htmlValues[2]]);
  assert.deepEqual(
    htmlValueSet,
    moduleValues,
    `index.html accepts ${[...htmlValueSet]} but themeStore.js's LIGHT/DARK are ${[...moduleValues]}`
  );
});
