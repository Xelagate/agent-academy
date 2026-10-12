const test = require('node:test');
const assert = require('node:assert');
const BRIDGE = require('./bridge-sim.js');

// Drops are spaced 5 s apart unless a test rushes on purpose, so the rushing rule stays out of the way.
let clock = 0;
const drop = (plank, gap = 5000) => ({ type: 'drop', plank, t: (clock += gap) });
const ask = (card) => ({ type: 'ask', card });

function at(key) {
  const s = BRIDGE.start();
  s.at = s.queue.indexOf(key);
  return s;
}

// Feed events in order; returns the last result plus every line said along the way.
function run(events, s = BRIDGE.start()) {
  let r = { state: s, say: [], show: [] };
  const said = [];
  for (const e of events) {
    r = BRIDGE.step(r.state, e);
    said.push(...r.say);
  }
  return { ...r, said };
}

const itemKey = (s) => s.queue[s.at];

test('every item can be solved with its own planks', () => {
  for (const [key, item] of Object.entries(BRIDGE.ITEMS)) {
    const need = item.gap - item.placed.reduce((a, b) => a + b, 0);
    const reachable = (i, left) => left === 0 || (i < item.planks.length && (reachable(i + 1, left - item.planks[i]) || reachable(i + 1, left)));
    assert.ok(reachable(0, need), `${key} cannot be solved`);
  }
});

test('a plank that fills the gap exactly solves the item and the creature crosses', () => {
  const r = run([drop(0)]); // five: 2 placed + 3
  assert.deepEqual(r.say, ['solved']);
  assert.deepEqual(r.show, [{ kind: 'star' }, { kind: 'cross' }]);
  assert.equal(itemKey(r.state), 'ten');
  assert.deepEqual(r.state.used, []);
});

test('too big drifts back; too small stays and leaves empty spots', () => {
  const big = run([drop(1)]); // five: 4 > 3 left
  assert.deepEqual(big.say, ['tooBig']);
  assert.deepEqual(big.show, [{ kind: 'bounce', plank: 1 }]);
  assert.deepEqual(big.state.used, []);

  const small = run([drop(0)], at('ten')); // 6 of 10
  assert.deepEqual(small.say, []);
  assert.deepEqual(small.state.used, [0]);
  assert.equal(BRIDGE.filled(small.state), 6);
});

test('take puts a plank back on the bank', () => {
  const r = run([drop(1), { type: 'take', plank: 1 }], at('ten'));
  assert.deepEqual(r.state.used, []);
});

test('the helper slips once on 3 + 2; catching it or counting both end with "always check"', () => {
  const slip = run([drop(0), drop(2)], at('slip'));
  assert.deepEqual(slip.say, ['slip']);
  assert.equal(slip.state.phase, 'slip');

  const caught = run([{ type: 'slip', answer: 'no' }], slip.state);
  assert.deepEqual(caught.say, ['caught', 'alwaysCheck']);
  assert.deepEqual(caught.show, [{ kind: 'star' }, { kind: 'cross' }]);
  assert.equal(itemKey(caught.state), 'free');

  const counted = run([{ type: 'slip', answer: 'yes' }], slip.state);
  assert.deepEqual(counted.say, ['countTogether', 'alwaysCheck']);
});

test('after the last item the helper asks how, then names the chosen strategy', () => {
  const done = run([drop(0), drop(3)], at('free')); // 2 + 8
  assert.equal(done.state.phase, 'strategy');
  assert.deepEqual(done.say, ['solved', 'howDid']);
  const r = run([{ type: 'strategy', id: 'spots' }], done.state);
  assert.deepEqual(r.say, ['stratSpots']);
  assert.equal(r.state.phase, 'done');
  assert.equal(r.state.strategy, 'spots');
  assert.deepEqual(run([drop(0)], r.state).say, [], 'drops after the end are ignored');
});

test('the hint ladder climbs only after the child acts, and has no answer rung', () => {
  const r = run([ask('which'), ask('which'), drop(0), ask('which'), ask('which'), drop(2), ask('which')], at('ten'));
  assert.deepEqual(r.said, ['hintCount', 'tryFirst', 'hintMatch', 'tryFirst', 'solved', 'hintCount']);
});

test('"Help!" asks what with; the child points and gets a hint about that thing', () => {
  const asked = run([ask('help')], at('ten'));
  assert.deepEqual(asked.say, ['whatWith']);
  assert.equal(asked.state.pointing, true);
  assert.deepEqual(run([drop(0)], asked.state).state.used, [], 'drops wait while pointing');
  assert.deepEqual(run([{ type: 'point', target: 'gap' }], asked.state).say, ['hintCount']);
  const plank = run([{ type: 'point', target: 1 }], asked.state);
  assert.deepEqual(plank.say, ['hintPlank']);
  assert.equal(plank.state.pointing, false);
});

test('an off-topic question goes to the jar once', () => {
  const r = run([ask('why'), ask('why')], at('ten'));
  assert.deepEqual(r.said, ['grownUp', 'grownUp']);
  assert.deepEqual(r.state.jar, ['waterWet']);
  assert.deepEqual(r.show, [{ kind: 'jar' }]);
});

test('"Just tell me" gets a worked example on a different gap; the second time a short item', () => {
  const once = run([ask('tell')], at('ten'));
  assert.deepEqual(once.say, ['together', 'exampleEight', 'nowYou']);
  assert.deepEqual(once.show, [{ kind: 'example', gap: 8, planks: [5, 3] }]);

  const twice = run([ask('tell')], once.state);
  assert.deepEqual(twice.say, ['slowDown', 'exampleEight', 'shortOne']);
  assert.equal(itemKey(twice.state), 'short');

  const back = run([drop(0), drop(2)], twice.state); // short: 4 + 1
  assert.equal(itemKey(back.state), 'ten', 'the child returns to the item they asked about');
});

test('a worked example never shows the gap the child is on', () => {
  for (const item of Object.values(BRIDGE.ITEMS)) {
    assert.notEqual(BRIDGE.SIBLING[item.gap].gap, item.gap);
  }
});

test('three rushed drops in a row → "look before we try"; slow drops or an ask in between do not', () => {
  const rushed = run([drop(1, 400), drop(1, 400), drop(1, 400)]);
  assert.deepEqual(rushed.say, ['lookFirst', 'tooBig']);
  assert.ok(rushed.show.some((fx) => fx.kind === 'pause'));

  assert.ok(!run([drop(1), drop(1), drop(1)]).said.includes('lookFirst'));
  assert.ok(!run([drop(1, 400), drop(1, 400), ask('which'), drop(1, 400)]).said.includes('lookFirst'));
});

test('idle offers help once per item', () => {
  const r = run([{ type: 'idle' }, { type: 'idle' }]);
  assert.deepEqual(r.said, ['offerHelp']);
});

test('step never mutates the state it was given', () => {
  const s = at('ten');
  const copy = JSON.stringify(s);
  BRIDGE.step(s, drop(0));
  BRIDGE.step(s, ask('why'));
  assert.equal(JSON.stringify(s), copy);
});

test('every line said is listed in LINES', () => {
  const said = [
    ...run([drop(1, 400), drop(1, 400), drop(1, 400), drop(0), { type: 'idle' }, ask('help'), { type: 'point', target: 0 },
      ask('help'), { type: 'point', target: 'gap' }, ask('which'), ask('which'), drop(0), ask('which'), ask('why'),
      ask('tell'), ask('tell'), drop(0), drop(2), drop(0), drop(2)]).said,
    ...run([drop(0), drop(2), { type: 'slip', answer: 'no' }], at('slip')).said,
    ...run([drop(0), drop(2), { type: 'slip', answer: 'yes' }, drop(0), drop(3), { type: 'strategy', id: 'dots' }], at('slip')).said,
    ...run([ask('tell')], at('five')).said,
  ];
  for (const id of said) assert.ok(BRIDGE.LINES.includes(id), `${id} missing from LINES`);
});

test('filling a hole awards a star and then the creature crosses', () => {
  const r = run([drop(0)]); // five: 2 placed + 3
  assert.equal(r.state.stars, 1);
  assert.deepEqual(r.show, [{ kind: 'star' }, { kind: 'cross' }]);
});

test('a too-big plank or a partial fill awards nothing', () => {
  assert.equal(run([drop(1)]).state.stars, 0); // 4 into room 3: too big
  assert.equal(run([drop(2)], at('ten')).state.stars, 0); // 4 of 10
});

test('the slip item pays its star when the child answers the slip', () => {
  const r = run([drop(0), drop(2), { type: 'slip', answer: 'no' }], at('slip'));
  assert.equal(r.state.stars, 1);
  assert.deepEqual(r.show, [{ kind: 'star' }, { kind: 'cross' }]);
});

test('the short item after a second push also earns a star', () => {
  const r = run([ask('tell'), ask('tell'), drop(0), drop(2)], at('ten')); // short: 4 + 1
  assert.equal(itemKey(r.state), 'ten');
  assert.equal(r.state.stars, 1);
});

test('with the short item added, every one of the five fixes earns its own star', () => {
  const r = run([ask('tell'), ask('tell'), drop(0), drop(2), drop(0), drop(0), drop(2),
    drop(0), drop(2), { type: 'slip', answer: 'no' }, drop(0), drop(3)]); // short, five, ten, slip, free
  assert.equal(r.state.queue.length, 5);
  assert.equal(r.state.phase, 'strategy');
  assert.equal(r.state.stars, r.state.queue.length);
});
