import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const compile = path => ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
const navigationSource = compile('../components/radar/evidence-navigation.ts');
const motionSource = compile('../lib/motion-preference.ts');

// Run both actual modules against a small DOM boundary; no browser, storage or transport.
function harness() {
  const elements = new Map(), frames = [], focused = [], scrolled = [], events = [];
  const document = { documentElement: { dataset: { motion: 'normal', systemMotion: 'normal' } }, activeElement: null, getElementById: id => elements.get(id) ?? null };
  const window = { scrollY: 0, scrollTo: options => scrolled.push({ kind: 'window', options }), dispatchEvent() {} };
  const motion = { exports: {} }, navigation = { exports: {} };
  new Function('module', 'exports', 'document', 'window', motionSource)(motion, motion.exports, document, window);
  new Function('require', 'module', 'exports', 'document', 'window', 'CustomEvent', 'requestAnimationFrame', navigationSource)(
    name => { assert.ok(name.endsWith('/motion-preference')); return motion.exports; }, navigation, navigation.exports, document, window,
    class { constructor(type, options) { this.type = type; Object.assign(this, options); } }, callback => { frames.push(callback); return frames.length; });
  let onReveal;
  function element(id, { tagName = 'SECTION', parentElement = null, hidden = false } = {}) {
    const node = { id, tagName, parentElement, hidden, open: false, isConnected: true,
      closest(selector) { assert.equal(selector, '[hidden]'); for (let parent = this; parent; parent = parent.parentElement) if (parent.hidden) return parent; return null; },
      dispatchEvent(event) { events.push({ target: this, type: event.type, bubbles: event.bubbles }); onReveal?.(this, event); return true; },
      focus(options) { document.activeElement = this; focused.push({ target: this, options }); },
      scrollIntoView(options) { scrolled.push({ kind: 'element', target: this, options }); },
    };
    if (id) elements.set(id, node);
    return node;
  }
  return { ...navigation.exports, motion: motion.exports, document, window, elements, element, focused, scrolled, events,
    onReveal(callback) { onReveal = callback; }, get frameCount() { return frames.length; },
    flush() { const pending = frames.splice(0); for (const callback of pending) callback(); },
  };
}

test('evidence navigation opens every ancestor and reveals the history section before one layout frame', () => {
  const h = harness(), outer = h.element('history', { tagName: 'DETAILS' }), section = h.element('saved', { parentElement: outer, hidden: true });
  const middle = h.element('comparison', { tagName: 'DETAILS', parentElement: section }), list = h.element('evidence', { tagName: 'DETAILS', parentElement: middle });
  const target = h.element(h.evidenceId('panel-a', 'short.direction'), { parentElement: list }), trigger = h.element('citation', { tagName: 'BUTTON' });
  h.onReveal(node => { assert.equal(node, target); section.hidden = false; });
  h.visitEvidence('panel-a', 'short.direction', trigger);
  assert.deepEqual([outer.open, middle.open, list.open], [true, true, true]); assert.equal(section.hidden, false);
  assert.deepEqual(h.events, [{ target, type: 'radar-history-reveal', bubbles: true }]);
  assert.equal(h.frameCount, 1); assert.equal(h.focused.length, 0); assert.equal(h.scrolled.length, 0);
  h.flush(); assert.equal(h.frameCount, 0); assert.equal(h.document.activeElement, target);
  assert.deepEqual(h.focused, [{ target, options: { preventScroll: true } }]);
  assert.deepEqual(h.scrolled, [{ kind: 'element', target, options: { block: 'start', behavior: 'smooth' } }]);
});

test('evidence navigation uses the resolved application motion preference including normal override', () => {
  for (const [preference, systemMotion, expected] of [['reduced', 'normal', 'instant'], ['normal', 'reduced', 'smooth'], ['system', 'reduced', 'instant'], ['system', 'normal', 'smooth']]) {
    const h = harness(); h.document.documentElement.dataset.systemMotion = systemMotion; h.motion.applyMotionPreference(preference);
    const target = h.element(h.evidenceId('motion-panel', 'quote')), trigger = h.element('citation', { tagName: 'BUTTON' });
    h.visitEvidence('motion-panel', 'quote', trigger); assert.equal(h.frameCount, 1); h.flush();
    assert.equal(h.scrolled[0].target, target); assert.equal(h.scrolled[0].options.behavior, expected, `${preference}/${systemMotion}`);
    h.returnToCitation('motion-panel', 'quote'); assert.equal(h.frameCount, 1); h.flush();
    assert.equal(h.scrolled[1].options.behavior, expected);
  }
});

test('return to citation restores the exact trigger and original scroll position after opening its ancestors', () => {
  const h = harness(), container = h.element('citation-list', { tagName: 'DETAILS' }), trigger = h.element('exact-citation', { tagName: 'BUTTON', parentElement: container });
  const target = h.element(h.evidenceId('panel-a', 'short.volatility'));
  h.window.scrollY = 437; h.visitEvidence('panel-a', 'short.volatility', trigger); h.flush();
  assert.equal(h.document.activeElement, target); h.window.scrollY = 990;
  h.returnToCitation('panel-a', 'short.volatility'); assert.equal(container.open, true); assert.equal(h.frameCount, 1); assert.equal(h.document.activeElement, target);
  h.flush(); assert.equal(h.document.activeElement, trigger); assert.deepEqual(h.focused.at(-1).options, { preventScroll: true });
  assert.deepEqual(h.scrolled.at(-1), { kind: 'window', options: { top: 437, behavior: 'smooth' } });
});

test('detached or hidden citation falls back only to its own result heading and never another panel', () => {
  for (const reason of ['detached', 'hidden']) {
    const h = harness(), list = h.element('references'), trigger = h.element('citation', { tagName: 'BUTTON', parentElement: list }), target = h.element(h.evidenceId('panel-a', 'quote'));
    const heading = h.element('panel-a-heading', { tagName: 'STRONG' }), other = h.element('panel-b-heading', { tagName: 'STRONG' });
    h.element(h.evidenceId('panel-b', 'quote')); h.visitEvidence('panel-a', 'quote', trigger); h.flush();
    if (reason === 'detached') trigger.isConnected = false; else list.hidden = true;
    h.returnToCitation('panel-a', 'quote'); assert.equal(h.frameCount, 1); h.flush();
    assert.equal(h.document.activeElement, heading, reason); assert.equal(h.scrolled.at(-1).target, heading); assert.ok(h.focused.every(item => item.target !== other));
    h.elements.delete('panel-a-heading'); h.returnToCitation('panel-a', 'quote'); assert.equal(h.frameCount, 0);
    assert.deepEqual(h.focused.map(item => item.target), [target, heading]);
  }
});

test('a hidden or detached target cancels its scheduled focus without redirecting to a replacement', () => {
  for (const reason of ['hidden', 'detached', 'replaced', 'reused-node']) {
    const h = harness(), section = h.element('saved'), targetId = h.evidenceId('panel-a', 'short.direction');
    const target = h.element(targetId, { parentElement: section }), trigger = h.element('citation', { tagName: 'BUTTON' });
    h.visitEvidence('panel-a', 'short.direction', trigger); assert.equal(h.frameCount, 1);
    if (reason === 'hidden') section.hidden = true;
    else if (reason === 'reused-node') { target.id = h.evidenceId('panel-b', 'short.direction'); h.elements.delete(targetId); h.elements.set(target.id, target); }
    else { target.isConnected = false; h.elements.delete(targetId); if (reason === 'replaced') h.element(targetId, { parentElement: section }); }
    h.flush(); assert.equal(h.focused.length, 0, reason); assert.equal(h.scrolled.length, 0, reason); assert.equal(h.frameCount, 0);
  }
});

test('a detached return trigger cancels an already scheduled return and missing scoped targets do nothing', () => {
  const h = harness(), trigger = h.element('citation', { tagName: 'BUTTON' }), target = h.element(h.evidenceId('panel-a', 'quote'));
  h.visitEvidence('panel-a', 'quote', trigger); h.flush(); h.returnToCitation('panel-a', 'quote'); trigger.isConnected = false;
  h.flush(); assert.deepEqual(h.focused.map(item => item.target), [target]); assert.equal(h.scrolled.length, 1);
  h.element('panel-b-heading'); h.element(h.evidenceId('panel-b', 'quote'));
  h.visitEvidence('missing', 'quote', trigger); h.returnToCitation('missing', 'quote');
  assert.equal(h.frameCount, 0); assert.deepEqual(h.focused.map(item => item.target), [target]);
});

test('evidence labels stay readable while unknown IDs and scope encoding remain exact', () => {
  const h = harness();
  assert.equal(h.evidenceLabel('short.direction'), '短窗方向结构'); assert.equal(h.evidenceLabel('short.volatility'), '短窗 RMS 波动');
  assert.equal(h.evidenceLabel('unknown:fact/1'), 'unknown:fact/1'); assert.equal(h.evidenceId('result-a', 'unknown:fact/1'), 'result-a-evidence-unknown%3Afact%2F1');
});
