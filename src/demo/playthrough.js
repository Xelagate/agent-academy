// Headless end-to-end run of the built page. Usage: NODE_PATH=$(npm root -g) node demo/playthrough.js
const { chromium } = require('playwright');
const path = require('path');

const PAGE = process.env.PAGE || 'file://' + path.join(__dirname, 'lost-cat-level-en.html');
const VIEWPORTS = [{ width: 390, height: 844 }, { width: 1280, height: 800 }];

function check(ok, message) {
  if (!ok) throw new Error(message);
}

// The Seeker build (app/) puts a parent gate in front of the game; a judge's way past it.
async function skipGate(page) {
  const skip = page.getByRole('button', { name: 'Just look around' });
  if (await skip.count()) await skip.click();
}

async function openPage(browser, viewport, initScript) {
  const context = await browser.newContext({ viewport });
  if (initScript) await context.addInitScript(initScript);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(PAGE);
  await skipGate(page);
  return { context, page, errors };
}

async function assertNoOverflow(page, where) {
  const wide = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  check(!wide, 'horizontal scroll on ' + where);
}

// Reward → takeaway → course map: the takeaway's back button only appears after a correct answer.
async function backToCourse(page) {
  await page.getByRole('button', { name: 'What did you learn?' }).click();
  await page.locator('#scene-takeaway').waitFor({ state: 'visible' });
  await assertNoOverflow(page, 'takeaway');
  const back = page.getByRole('button', { name: 'Back to the course map' });
  check(await back.isHidden(), 'back button visible before an answer');
  await page.locator('#scene-takeaway .card').first().click();
  check(await back.isHidden(), 'back button visible after a wrong answer');
  await page.locator('#scene-takeaway .card').nth(1).click();
  await back.click();
  await page.locator('#scene-course').waitFor({ state: 'visible' });
  await assertNoOverflow(page, 'course map');
}

const tile = (page, n) => page.locator('#scene-course .course-tile').nth(n - 1);

async function defaultLoadout(browser) {
  const seed = () => localStorage.setItem('agent-creatures-progress', JSON.stringify({ lostCat: 'done' }));
  const { context, page, errors } = await openPage(browser, VIEWPORTS[0], seed);
  check(await tile(page, 1).getAttribute('aria-disabled') !== 'true', 'old progress blocks Bridge');
  check(await page.locator('#scene-course .home-helper').count() === 1, 'old progress lost the helper at home');
  check(errors.length === 0, 'page errors: ' + errors.join(' | '));
  await context.close();
}

// The caption shows each line as it plays; a missing voice file only costs the sound.
async function voiceCheck(browser) {
  const { context, page, errors } = await openPage(browser, VIEWPORTS[0]);
  await page.evaluate(() => voice.play([{ id: 'hello', text: 'Hi there.' }, { id: 'no-such-line', text: 'Still going.' }]));
  check(await page.locator('#voice-caption').isVisible(), 'caption bar hidden while speaking');
  check((await page.locator('.voice-caption__text').textContent()) === 'Hi there.', 'first caption wrong');
  await page.waitForFunction(() => document.querySelector('.voice-caption__text').textContent === 'Still going.', null, { timeout: 10000 });
  await page.evaluate(() => showScene('course'));
  check(await page.locator('#voice-caption').isHidden(), 'caption bar left on the course map');
  check(errors.length === 0, 'page errors: ' + errors.join(' | '));
  await context.close();
}

// A play() that never settles and never ends (seen in headless Chromium after quick taps; on a tablet
// the OS can do the same) must not freeze the lines behind it.
async function voiceStall(browser) {
  const stall = () => { HTMLMediaElement.prototype.play = () => new Promise(() => {}); };
  const { context, page, errors } = await openPage(browser, VIEWPORTS[0], stall);
  await page.evaluate(() => voice.play([{ id: 'hello', text: 'Hi there.' }, { id: 'hello', text: 'Still going.' }]));
  await page.waitForFunction(() => document.querySelector('.voice-caption__text').textContent === 'Still going.', null, { timeout: 10000 });
  check(errors.length === 0, 'page errors: ' + errors.join(' | '));
  await context.close();
}

const said = (page) => page.locator('#scene-bridge-river').getAttribute('data-said');
const caption = (page) => page.locator('.voice-caption__text').textContent();
const onItem = (page, key) => page.locator(`.bridge-gap[data-item="${key}"]`).waitFor();
const dropPlank = (page, n) => page.getByRole('button', { name: `Plank with ${n} dots`, exact: true }).click();
// The caption bar is fixed over the bottom of the screen: every plank on our bank must be mostly above it.
async function planksClear(page, where) {
  const hidden = await page.evaluate(() => {
    const bar = document.getElementById('voice-caption');
    const floor = bar.hidden ? innerHeight : Math.min(innerHeight, bar.getBoundingClientRect().top);
    return [...document.querySelectorAll('#scene-bridge-river .bridge-plank')].filter((p) => {
      const r = p.getBoundingClientRect();
      return Math.max(0, Math.min(r.bottom, floor) - Math.max(r.top, 0)) / r.height <= 0.5;
    }).map((p) => p.dataset.plank);
  });
  check(hidden.length === 0, `planks ${hidden} under the caption bar on ${where}`);
}
async function askCard(page, card) {
  await page.getByRole('button', { name: 'Ask the helper' }).click();
  await page.getByRole('button', { name: card, exact: true }).click();
}

// The party story: the creature's bubble first, then the helper's, then ✓ to the river.
async function throughStory(page) {
  const bubble = page.locator('#scene-bridge-story .bridge-bubble[data-line="storyCreature"]');
  await bubble.waitFor({ state: 'visible' });
  check((await bubble.textContent()) === 'The bridge is broken! I want to come to the party.', 'creature bubble wrong');
  await page.locator('#bridge-story-go').waitFor({ state: 'visible', timeout: 20000 });
  check(await bubble.isHidden(), 'creature bubble still up while the helper speaks');
  await assertNoOverflow(page, 'bridge story');
  await page.locator('#bridge-story-go').click();
}

// Bridge from hello to the reward: rushing, every ask card, the calm-down, the slip and a strategy.
async function playBridge(page, creature = 'Hush') {
  await page.getByRole('button', { name: 'Say hi' }).click();
  check((await caption(page)).startsWith('Hi!'), 'helper did not introduce itself');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: creature, exact: true }).click();
  await page.getByRole('button', { name: 'That one' }).click();
  await throughStory(page);
  await onItem(page, 'five');
  await assertNoOverflow(page, 'bridge river');
  check(await page.locator('.bridge-bank--far .creature-figure[data-pose="worried"]').count() === 1, 'creature not in its worried pose');

  for (let i = 0; i < 3; i++) await dropPlank(page, 4);
  check((await said(page)).startsWith('lookFirst'), 'rushing was not calmed');
  await page.waitForTimeout(1100); // the pause lifts
  await dropPlank(page, 3);
  await page.locator('.bridge-stage.is-crossing').waitFor();
  await dropPlank(page, 4); // a tap while crossing must not land on the next item's plank #1 (the 8)
  await onItem(page, 'ten');
  check(await page.locator('.bridge-gap .bridge-seg:not(.bridge-seg--fixed)').count() === 0, 'a tap during the crossing reached the next item');
  check(await page.locator('.bridge-stars i.is-won').count() === 1, 'no star for the first fix');

  await askCard(page, 'Which plank fits the hole?');
  check(await said(page) === 'hintCount', 'first hint wrong');
  await askCard(page, 'Which plank fits the hole?');
  check(await said(page) === 'tryFirst', 'hint climbed without an action');
  await dropPlank(page, 8);
  check(await page.locator('.bridge-gap .bridge-spot').count() === 2, 'too-small plank should leave 2 empty spots');
  check(await page.locator('.bridge-gap .bridge-seg:not(.bridge-seg--fixed)').count() === 1, 'one tap dropped more than one plank');
  await askCard(page, 'Which plank fits the hole?');
  check(await said(page) === 'hintMatch', 'second hint wrong');
  await page.getByRole('button', { name: 'Take back the plank with 8 dots' }).click();
  await askCard(page, 'Help!');
  check(await said(page) === 'whatWith', 'Help! did not ask what with');
  await page.getByRole('button', { name: 'The gap' }).click();
  check(await said(page) === 'hintCount', 'pointing at the gap gave no hint');
  await askCard(page, 'Why is water wet?');
  check(await said(page) === 'grownUp', 'off-topic question not sent to a grown-up');
  await askCard(page, 'Just tell me!');
  check((await said(page)).startsWith('together'), 'first push not met with "together"');
  check(await page.locator('#bridge-example').isVisible(), 'no worked example');
  await page.waitForTimeout(4500);
  check(await page.locator('#bridge-example').isVisible(), 'worked example vanished before the child moved');
  await page.locator('#bridge-example').click(); // a tap on the example clears it off the planks
  check(await page.locator('#bridge-example').isHidden(), 'tapping the worked example did not close it');
  await askCard(page, 'Just tell me!');
  check((await said(page)).startsWith('slowDown'), 'second push not calmed');
  await onItem(page, 'short');
  check(await page.locator('.bridge-stars i').count() === 5, 'the short item got no star slot');
  await dropPlank(page, 4);
  await dropPlank(page, 1);
  await onItem(page, 'ten');
  check(await page.locator('.bridge-stars i.is-won').count() === 2, 'the short fix lit no star');
  await dropPlank(page, 6);
  await dropPlank(page, 4);
  await onItem(page, 'slip');
  await dropPlank(page, 3);
  await dropPlank(page, 2);
  await page.getByRole('button', { name: 'Not right' }).click();
  check(await said(page) === 'caught alwaysCheck', 'slip not caught');
  await onItem(page, 'free');
  await dropPlank(page, 2);
  await dropPlank(page, 8);
  await page.locator('#scene-bridge-strategy').waitFor({ state: 'visible' });
  // The short item added a fifth slot, and each of the five fixes lit its own star.
  check(await page.locator('.bridge-stars i').count() === 5, 'no fifth slot for the short item');
  check(await page.locator('.bridge-stars i.is-won').count() === 5, 'star row not full after the last fix');
  await page.getByRole('button', { name: 'I looked at the empty spots.', exact: true }).click();
  check((await caption(page)) === 'You looked at the empty spots first.', 'strategy not named back');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.locator('#scene-bridge-reward').waitFor({ state: 'visible' });
  check(await page.locator('#scene-bridge-reward .creature-figure[data-outfit="satchel"]').isVisible(), 'no satchel on the bridge reward');
  await assertNoOverflow(page, 'bridge reward');
}

async function bridgeRun(browser, viewport) {
  const { context, page, errors } = await openPage(browser, viewport);
  await page.evaluate(() => startBridge());
  await playBridge(page);
  await backToCourse(page);
  check(errors.length === 0, 'page errors: ' + errors.join(' | '));
  await context.close();
}

// Each item as a child meets it, from the top of the page: a tap never scrolls the page the way a
// Playwright click does, so the river itself has to keep the planks clear of the caption bar.
async function bridgeRiverFits(browser, viewport) {
  const { context, page, errors } = await openPage(browser, viewport);
  await page.evaluate(() => startBridge());
  await page.getByRole('button', { name: 'Say hi' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Hush', exact: true }).click();
  await page.getByRole('button', { name: 'That one' }).click();
  await throughStory(page);
  await onItem(page, 'five');
  await planksClear(page, 'five at ' + viewport.width + 'px');
  for (const key of ['ten', 'slip', 'free', 'short']) {
    await page.evaluate((key) => {
      if (!bridge.queue.includes(key)) bridge.queue.splice(bridge.at, 0, key);
      bridge.at = bridge.queue.indexOf(key);
      window.scrollTo(0, 0);
      bridgeEvent({ type: 'take', plank: -1 }); // a move that changes nothing, so the river redraws
    }, key);
    await planksClear(page, key + ' at ' + viewport.width + 'px');
    await assertNoOverflow(page, 'bridge river ' + key);
  }
  check(errors.length === 0, 'page errors: ' + errors.join(' | '));
  await context.close();
}

// Leaving for the map while the creature is still crossing must not pull the child back into the level.
async function bridgeLeaveMidCrossing(browser, viewport) {
  const { context, page, errors } = await openPage(browser, viewport);
  await page.evaluate(() => startBridge());
  await page.getByRole('button', { name: 'Say hi' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Hush', exact: true }).click();
  await page.getByRole('button', { name: 'That one' }).click();
  await throughStory(page);
  await onItem(page, 'five');
  await dropPlank(page, 3);
  await page.locator('.bridge-stage.is-crossing').waitFor();
  await page.getByRole('button', { name: 'Map' }).click();
  await page.waitForTimeout(2000);
  check(await page.locator('#scene-course').isVisible(), 'the crossing pulled the child back from the map');
  check(await page.locator('#scene-bridge-river').isHidden(), 'river showing over the map');
  check(errors.length === 0, 'page errors: ' + errors.join(' | '));
  await context.close();
}

// Leaving for the map while the story still speaks must not pull the child back. Jay has no pose
// pictures yet, so this also covers the plain-picture fallback.
async function bridgeLeaveMidStory(browser, viewport) {
  const { context, page, errors } = await openPage(browser, viewport);
  await page.evaluate(() => startBridge());
  await page.getByRole('button', { name: 'Say hi' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Jay', exact: true }).click();
  await page.getByRole('button', { name: 'That one' }).click();
  await page.locator('#scene-bridge-story .creature-figure[data-creature="blue"]').waitFor();
  await page.getByRole('button', { name: 'Map' }).click();
  await page.waitForTimeout(6000);
  check(await page.locator('#scene-course').isVisible(), 'the story pulled the child back from the map');
  check(await page.locator('#scene-bridge-story').isHidden(), 'story showing over the map');
  check(errors.length === 0, 'page errors: ' + errors.join(' | '));
  await context.close();
}

// A child who finished the bridge skips the pick but still hears the story, with their own creature.
async function bridgeReplayStory(browser) {
  const seed = () => localStorage.setItem('agent-creatures-progress', JSON.stringify({ bridge: 'done', loadout: { creature: 'green', skills: [] } }));
  const { context, page, errors } = await openPage(browser, VIEWPORTS[0], seed);
  await page.evaluate(() => startBridge());
  await page.getByRole('button', { name: 'Say hi' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.locator('#scene-bridge-story .creature-figure[data-creature="green"]').waitFor();
  await throughStory(page);
  await onItem(page, 'five');
  check(await page.locator('.bridge-bank--far .creature-figure[data-outfit="satchel"]:not([data-pose])').count() === 1, 'worn satchel swapped for a pose');
  check(errors.length === 0, 'page errors: ' + errors.join(' | '));
  await context.close();
}

// 🔊 on the first story line replays the story; ✓ must still come once the helper's line starts.
async function bridgeStoryReplayButton(browser) {
  const { context, page, errors } = await openPage(browser, VIEWPORTS[0]);
  await page.evaluate(() => startBridge());
  await page.getByRole('button', { name: 'Say hi' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Hush', exact: true }).click();
  await page.getByRole('button', { name: 'That one' }).click();
  await page.locator('#scene-bridge-story .bridge-bubble[data-line="storyCreature"]').waitFor({ state: 'visible' });
  await page.locator('.voice-caption__replay').click();
  await page.locator('#bridge-story-go').waitFor({ state: 'visible', timeout: 20000 });
  check(errors.length === 0, 'page errors: ' + errors.join(' | '));
  await context.close();
}

// A creature whose pose pictures are missing keeps its own picture and still crosses.
async function bridgeMissingPose(browser) {
  const { context, page, errors } = await openPage(browser, VIEWPORTS[0]);
  await page.evaluate(() => { delete WORLD.poses.green; startBridge(); });
  await page.getByRole('button', { name: 'Say hi' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Hush', exact: true }).click();
  await page.getByRole('button', { name: 'That one' }).click();
  await throughStory(page);
  await onItem(page, 'five');
  const src = await page.locator('.bridge-bank--far .creature-figure__body').getAttribute('src');
  check(src === await page.evaluate(() => WORLD.creatures.green), 'missing pose did not fall back to the creature picture');
  await dropPlank(page, 3);
  await onItem(page, 'ten');
  check(errors.length === 0, 'page errors: ' + errors.join(' | '));
  await context.close();
}

async function fullRun(browser, viewport) {
  const { context, page, errors } = await openPage(browser, viewport);
  await page.locator('#scene-course').waitFor({ state: 'visible' });
  await assertNoOverflow(page, 'course map');
  check(await page.locator('#scene-course .course-tile').count() === 3, 'the map is not three places');
  for (const n of [2, 3]) check(await tile(page, n).getAttribute('aria-disabled') === 'true', `place ${n} is open before it is built`);
  check(await page.locator('#scene-course .home-helper').count() === 1, 'no helper at home before a creature is picked');
  await page.locator('#scene-course .today button').click();
  await playBridge(page, 'Hush');
  await backToCourse(page);
  check((await tile(page, 1).getAttribute('class')).includes('course-tile--done'), 'Bridge not marked done');
  check(await page.locator('#scene-course .creature-figure[data-creature="green"]').count() === 1, 'picked creature not at home');
  await page.locator('.home-jar').click();
  check((await caption(page)).startsWith('Ask a grown-up'), 'the jar does not speak');
  await page.locator('#voice-caption').waitFor({ state: 'hidden', timeout: 30000 });

  // reloadKeepsProgress, then the returning greeting (no pick the second time)
  await page.reload();
  await skipGate(page); // looking around does not remember a parent, so the gate is back
  check((await tile(page, 1).getAttribute('class')).includes('course-tile--done'), 'done lost on reload');
  check(await page.locator('#scene-course .creature-figure[data-creature="green"]').count() === 1, 'creature lost on reload');
  await tile(page, 1).click();
  await page.getByRole('button', { name: 'Say hi' }).click();
  check((await caption(page)) === 'Hush’s bridge is still standing!', 'no returning greeting');
  await page.getByRole('button', { name: 'Next' }).click();
  await throughStory(page);
  await onItem(page, 'five');
  await page.getByRole('button', { name: 'Map', exact: true }).click();

  check(errors.length === 0, 'page errors: ' + errors.join(' | '));
  await context.close();
}

async function storageBlocked(browser) {
  const block = () => {
    for (const m of ['getItem', 'setItem']) {
      Storage.prototype[m] = () => { throw new Error('blocked'); };
    }
  };
  const { context, page, errors } = await openPage(browser, VIEWPORTS[0], block);
  await tile(page, 1).click();
  await playBridge(page);
  await backToCourse(page);
  check((await tile(page, 1).getAttribute('class')).includes('course-tile--done'), 'no session progress without storage');
  check(errors.length === 0, 'page errors with storage blocked: ' + errors.join(' | '));
  await context.close();
}

// A child mashing 👋 on a phone: Next still shows on time, and a double tap never zooms the page.
async function bridgeHelloMash(browser) {
  const { context, page, errors } = await openPage(browser, { width: 390, height: 844 });
  await page.evaluate(() => startBridge());
  const hi = page.getByRole('button', { name: 'Say hi' });
  await hi.click();
  for (let i = 0; i < 4; i++) { await page.waitForTimeout(1000); await hi.click(); }
  await page.getByRole('button', { name: 'Next' }).waitFor({ state: 'visible', timeout: 1500 });
  check(await hi.evaluate((b) => getComputedStyle(b).touchAction) === 'manipulation', 'buttons still allow double-tap zoom');
  check(errors.length === 0, 'page errors: ' + errors.join(' | '));
  await context.close();
}

(async () => {
  const browser = await chromium.launch();
  try {
    await voiceCheck(browser);
    await voiceStall(browser);
    console.log('PASS voice');
    for (const viewport of VIEWPORTS) {
      await bridgeRun(browser, viewport);
      await bridgeRiverFits(browser, viewport);
      await bridgeLeaveMidCrossing(browser, viewport);
      await bridgeLeaveMidStory(browser, viewport);
      await fullRun(browser, viewport);
      console.log('PASS ' + viewport.width + 'x' + viewport.height);
    }
    await storageBlocked(browser);
    console.log('PASS storage blocked');
    await defaultLoadout(browser);
    console.log('PASS default loadout');
    await bridgeReplayStory(browser);
    console.log('PASS replay story');
    await bridgeStoryReplayButton(browser);
    console.log('PASS story replay button');
    await bridgeMissingPose(browser);
    console.log('PASS missing pose');
    await bridgeHelloMash(browser);
    console.log('PASS hello mash');
    console.log('PLAYTHROUGH PASS');
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error('PLAYTHROUGH FAIL:', e.message); process.exit(1); });
