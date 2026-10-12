const test = require('node:test');
const assert = require('node:assert');
const LEVEL = require('./level.js');

test('without memory the creature loops and runs out of daylight', () => {
  const run = LEVEL.walk({ memory: false });
  assert.equal(run.outcome, 'sunset');
  assert.equal(run.moves, 6);
  assert.equal(run.log.filter((s) => s.repeat).length, 3);
  assert.deepEqual(run.log.map((s) => s.to), ['myron', 'shop', 'garden', 'myron', 'shop', 'garden']);
  assert.equal(run.log.at(-1).hour, 20);
});

test('without memory the creature never reaches the school or the pond', () => {
  const seen = LEVEL.walk({ memory: false }).log.map((s) => s.to);
  assert.ok(!seen.includes('school'));
  assert.ok(!seen.includes('pond'));
});

test('with memory it skips the visited point and finds the cat on move 5', () => {
  const run = LEVEL.walk({ memory: true });
  assert.equal(run.outcome, 'found');
  assert.equal(run.moves, 5);
  assert.equal(run.log.filter((s) => s.repeat).length, 0);
  assert.deepEqual(run.log.map((s) => s.to), ['myron', 'shop', 'garden', 'school', 'pond']);
  const fork = run.log.find((s) => s.move === 4);
  assert.equal(fork.viaMemory, true);
});

test('each run starts a fresh day', () => {
  const first = LEVEL.walk({ memory: true });
  const second = LEVEL.walk({ memory: true });
  assert.deepEqual(first, second);
});
