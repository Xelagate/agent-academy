// demo/levels/bridge-sim.js — "Ask it right": which plank fits, how the helper answers each way of
// asking, when it calms a pushing child. Ids and numbers only; the words live in CONTENT.bridge.
const BRIDGE = (function () {
  // `placed` is on the gap when the item opens; `planks` wait on the near bank.
  const ITEMS = {
    five:  { gap: 5,  placed: [2], planks: [3, 4] },
    ten:   { gap: 10, placed: [],  planks: [6, 8, 4] },
    slip:  { gap: 10, placed: [5], planks: [3, 6, 2] },
    free:  { gap: 10, placed: [],  planks: [2, 7, 3, 8, 5] },
    short: { gap: 5,  placed: [],  planks: [4, 3, 1] },
  };
  const ORDER = ['five', 'ten', 'slip', 'free'];

  // A worked example always uses a different gap from the child's, so it never shows their answer.
  const SIBLING = {
    5:  { gap: 4, planks: [3, 1], line: 'exampleFour' },
    10: { gap: 8, planks: [5, 3], line: 'exampleEight' },
  };

  const FAST_MS = 2000; // a drop this soon after the previous one counts as rushed
  const FAST_RUN = 3;   // this many rushed drops in a row → "Let's look before we try"
  const STRATEGY_LINES = { dots: 'stratDots', spots: 'stratSpots', tried: 'stratTried' };

  // Every line id step() can emit; the content test checks each has words and a voice file.
  const LINES = ['tooBig', 'lookFirst', 'solved', 'slip', 'caught', 'countTogether', 'alwaysCheck', 'howDid',
    'together', 'slowDown', 'shortOne', 'nowYou', 'exampleFour', 'exampleEight', 'whatWith', 'hintCount',
    'hintMatch', 'hintPlank', 'tryFirst', 'grownUp', 'offerHelp', 'stratDots', 'stratSpots', 'stratTried'];

  const sum = (a) => a.reduce((x, y) => x + y, 0);
  const current = (s) => ITEMS[s.queue[s.at]];
  const filled = (s) => sum(current(s).placed) + sum(s.used.map((i) => current(s).planks[i]));

  // Per-item state, reset whenever a new item opens.
  function fresh(s) {
    return Object.assign(s, { used: [], hint: 0, acted: false, offered: false, pointing: false, streak: 0, lastT: null });
  }

  function start() {
    return fresh({ queue: [...ORDER], at: 0, tells: 0, jar: [], stars: 0, slipDone: false, phase: 'play', strategy: null });
  }

  // Every mended hole pays its star before the creature walks across.
  function mend(s, show) {
    s.stars += 1;
    show.push({ kind: 'star' }, { kind: 'cross' });
  }

  // Next item, or the "how did you do it" question after the last one.
  function advance(s, say) {
    s.at += 1;
    fresh(s);
    if (s.at === s.queue.length) {
      s.phase = 'strategy';
      say.push('howDid');
    }
  }

  function drop(s, e, say, show) {
    if (s.phase !== 'play' || s.pointing || s.used.includes(e.plank)) return;
    s.acted = true;
    s.streak = s.lastT !== null && e.t - s.lastT < FAST_MS ? s.streak + 1 : 1;
    s.lastT = e.t;
    if (s.streak >= FAST_RUN) {
      s.streak = 0;
      say.push('lookFirst');
      show.push({ kind: 'pause' });
    }
    const size = current(s).planks[e.plank];
    const room = current(s).gap - filled(s);
    if (size > room) {
      say.push('tooBig');
      show.push({ kind: 'bounce', plank: e.plank });
      return;
    }
    s.used.push(e.plank);
    if (size < room) return;
    if (s.queue[s.at] === 'slip' && !s.slipDone) {
      s.phase = 'slip';
      say.push('slip');
      show.push({ kind: 'slip' });
      return;
    }
    say.push('solved');
    mend(s, show);
    advance(s, say);
  }

  function ask(s, card, say, show) {
    if (s.phase !== 'play') return;
    s.streak = 0;
    s.pointing = false;
    if (card === 'tell') {
      s.tells += 1;
      const ex = SIBLING[current(s).gap];
      show.push({ kind: 'example', gap: ex.gap, planks: ex.planks });
      if (s.tells === 1) return void say.push('together', ex.line, 'nowYou');
      say.push('slowDown', ex.line);
      if (s.queue[s.at] === 'short') return void say.push('nowYou');
      // A second push gets a smaller item the child can finish alone, then back to theirs.
      s.queue.splice(s.at, 0, 'short');
      fresh(s);
      say.push('shortOne');
    } else if (card === 'help') {
      s.pointing = true;
      say.push('whatWith');
    } else if (card === 'which') {
      if (s.hint === 0) {
        s.hint = 1;
        s.acted = false;
        say.push('hintCount');
      } else if (!s.acted) {
        say.push('tryFirst');
      } else {
        s.hint = 2;
        s.acted = false;
        say.push('hintMatch');
      }
    } else if (card === 'why') {
      if (!s.jar.includes('waterWet')) s.jar.push('waterWet');
      say.push('grownUp');
      show.push({ kind: 'jar' });
    }
  }

  function step(prev, e) {
    const s = JSON.parse(JSON.stringify(prev));
    const say = [];
    const show = [];
    if (e.type === 'drop') drop(s, e, say, show);
    else if (e.type === 'ask') ask(s, e.card, say, show);
    else if (e.type === 'take' && s.phase === 'play' && s.used.includes(e.plank)) {
      s.used = s.used.filter((i) => i !== e.plank);
      s.acted = true;
      s.streak = 0;
    } else if (e.type === 'point' && s.pointing) {
      s.pointing = false;
      s.streak = 0;
      if (e.target === 'gap') {
        s.hint = Math.max(s.hint, 1);
        s.acted = false;
        say.push('hintCount');
      } else {
        say.push('hintPlank');
      }
    } else if (e.type === 'idle' && s.phase === 'play' && !s.offered) {
      s.offered = true;
      say.push('offerHelp');
    } else if (e.type === 'slip' && s.phase === 'slip') {
      s.slipDone = true;
      s.phase = 'play';
      say.push(e.answer === 'no' ? 'caught' : 'countTogether', 'alwaysCheck');
      mend(s, show);
      advance(s, say);
    } else if (e.type === 'strategy' && s.phase === 'strategy' && STRATEGY_LINES[e.id]) {
      s.phase = 'done';
      s.strategy = e.id;
      say.push(STRATEGY_LINES[e.id]);
    }
    return { state: s, say, show };
  }

  return { ITEMS, ORDER, SIBLING, LINES, start, step, current, filled };
})();

if (typeof module !== 'undefined') module.exports = BRIDGE;
