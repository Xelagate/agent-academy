const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const BRIDGE = require('./bridge-sim.js');
const CONTENT = require('../content.en.js');

test('the Bridge takeaway has exactly one correct answer and no empty copy', () => {
  const t = CONTENT.bridge.takeaway;
  assert.ok(t.lesson && t.bridge && t.question, 'missing lesson/bridge/question');
  assert.strictEqual(t.answers.filter((a) => a.correct).length, 1, 'must have exactly one correct answer');
  for (const a of t.answers) assert.ok(a.text && a.reply, 'answer missing text or reply');
});

// Flattens say into [id, text] pairs; per-creature lines become "<id>.<creature>".
function bridgeLines() {
  return Object.entries(CONTENT.bridge.say).flatMap(([id, v]) =>
    typeof v === 'string' ? [[id, v]] : Object.entries(v).map(([c, t]) => [id + '.' + c, t]));
}

test('every Bridge line is one short idea: 12 words or fewer', () => {
  for (const [id, text] of bridgeLines()) {
    assert.ok(text.trim(), `${id} is empty`);
    assert.ok(text.split(/\s+/).length <= 12, `${id} has more than 12 words: ${text}`);
  }
});

test('every line the level can say exists in the copy', () => {
  const say = CONTENT.bridge.say;
  const used = [...BRIDGE.LINES, 'hello', 'grownUpSees', 'pickFriend', 'name', 'fillGap', 'bridgeStill', 'askHow', 'storyHelper', 'storyCreature',
    'reward', 'jarAsk', ...CONTENT.bridge.cards.map((c) => c.line), ...CONTENT.bridge.strategies.map((s) => s.line),
    ...CONTENT.bridge.takeaway.voice.intro, ...CONTENT.bridge.takeaway.voice.replies];
  for (const id of used) assert.ok(say[id], `no CONTENT.bridge.say.${id}`);
  for (const id of ['name', 'fillGap', 'bridgeStill', 'reward', 'storyCreature']) {
    for (const c of Object.keys(CONTENT.creatures)) assert.ok(say[id][c], `${id} has no ${c} version`);
  }
});

test('hint lines never carry a number, so a hint can never be the answer', () => {
  const numbers = /\d|\b(one|two|three|four|five|six|seven|eight|nine|ten)\b/i;
  for (const id of ['hintCount', 'hintMatch', 'hintPlank', 'tryFirst', 'whatWith', 'offerHelp']) {
    assert.ok(!numbers.test(CONTENT.bridge.say[id]), `${id} names a number`);
  }
});

// A child who cannot read picks a card by its picture, so the picture must match the question.
test('the plank and water cards show a plank and water, not ice', () => {
  const icon = (id) => CONTENT.bridge.cards.find((c) => c.id === id).icon;
  assert.equal(icon('which'), '🪵');
  assert.equal(icon('why'), '💧');
});

test('the voiced takeaway says exactly what its captions show', () => {
  const t = CONTENT.bridge.takeaway;
  const say = CONTENT.bridge.say;
  assert.equal(t.lesson, say[t.voice.intro[0]]);
  assert.equal(t.question, say[t.voice.intro[1]]);
  t.answers.forEach((a, i) => assert.equal(a.reply, say[t.voice.replies[i]]));
});

test('every Bridge line has a voice file', () => {
  const VOICE = require('../voice/manifest.js');
  for (const [id] of bridgeLines()) {
    assert.ok(VOICE[id], `no voice for ${id}`);
    assert.ok(fs.existsSync(path.join(__dirname, '..', VOICE[id])), `missing file ${VOICE[id]}`);
  }
});
