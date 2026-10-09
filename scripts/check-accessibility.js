#!/usr/bin/env node
/**
 * Fails if a tappable element would be unusable with VoiceOver / TalkBack:
 *
 *  1. no accessibilityRole — the screen reader reads its text but never says
 *     it can be tapped;
 *  2. no accessible name — no accessibilityLabel and no <Text> inside, so it
 *     is announced as just "button" (icon-only buttons are the usual cause).
 *
 * This is a safety app: a blind user who cannot find "I'm OK" or SOS is the
 * failure everything else exists to prevent. Found 28 + 3 such elements on
 * 9 Oct 2026; this keeps the count at zero.
 *
 * Run: npm run check:a11y
 */
const fs = require('fs');
const path = require('path');

const ROOTS = ['app', 'src/components'];
const TAG = /<(TouchableOpacity|Pressable|TouchableHighlight)\b/g;

function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return files(p);
    return p.endsWith('.tsx') ? [p] : [];
  });
}

/** The opening tag, honouring braces so `onPress={() => …}` does not end it. */
function openingTag(src, start) {
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (c === '>' && depth === 0) return { text: src.slice(start, i + 1), end: i + 1 };
  }
  return { text: src.slice(start), end: src.length };
}

const problems = [];
for (const root of ROOTS) {
  for (const file of files(root)) {
    const src = fs.readFileSync(file, 'utf8');
    for (const m of src.matchAll(TAG)) {
      const { text, end } = openingTag(src, m.index);
      const line = src.slice(0, m.index).split('\n').length;
      const close = text.endsWith('/>') ? end : src.indexOf(`</${m[1]}>`, end);
      const body = close > end ? src.slice(end, close) : '';
      if (!text.includes('accessibilityRole')) problems.push(`${file}:${line}  no accessibilityRole`);
      // `{row}`-style children are composed elsewhere; require an explicit label then.
      const named = text.includes('accessibilityLabel') || /<Text\b/.test(body) || /\blabel=/.test(body);
      if (!named) problems.push(`${file}:${line}  no accessible name (add accessibilityLabel)`);
    }
  }
}

if (problems.length) {
  console.log('✗ Tappable elements a screen reader cannot use:');
  for (const p of problems) console.log(`    ${p}`);
  process.exit(1);
}
console.log('✓ Every tappable has a role and a name');
