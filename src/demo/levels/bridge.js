// demo/levels/bridge.js — "Ask it right": the helper, the river and the ask cards. The rules live in
// bridge-sim.js, every word in CONTENT.bridge, and every spoken line also shows as a caption.
  const IDLE_MS = 8000;
  const CROSS_MS = 2300;
  const HELLO_MS = 4800; // both hello lines, or their captions when a voice file is missing
  let bridge = null;
  let bridgeBusy = false; // the creature is crossing: taps wait for the next item
  let idleTimer = null;
  let crossTimer = null;
  let helloTimer = null;
  let bridgePicked = null;
  let hop = { anims: [], timers: [] }; // the crossing's hop, stopped when the crossing ends or the scene is left
  const BT = () => CONTENT.bridge;

  // A line is one string, or one per creature when it says the creature's name.
  function bridgeLine(id) {
    const text = BT().say[id];
    return typeof text === 'string' ? { id, text } : { id: id + '.' + state.creature, text: text[state.creature] };
  }
  function bridgeSay(ids) {
    voice.play(ids.map(bridgeLine));
  }

  // Entry from the course map. A child who finished it before keeps their creature and skips the pick.
  function startBridge() {
    const progress = loadProgress();
    const back = progress.bridge === 'done' && progress.loadout ? progress.loadout.creature : null;
    clearTimeout(crossTimer);
    clearTimeout(idleTimer);
    clearTimeout(helloTimer);
    helloTimer = null;
    stopHop();
    bridgeBusy = false;
    Object.assign(state, { creature: back, skills: [] });
    bridgePicked = null;
    bridge = BRIDGE.start();
    renderBridgeHello(Boolean(back));
    showScene('bridge-hello');
  }

  function renderBridgeHello(back) {
    document.getElementById('scene-bridge-hello').innerHTML = `
      <div class="bridge-helper"><img src="${WORLD.cast.helper}" alt="${BT().ui.helperAlt}" width="200" height="200"></div>
      <button class="bridge-big" onclick="bridgeHello(${back})" aria-label="${BT().ui.hi}">👋</button>
      <button class="bridge-big" id="bridge-hello-next" onclick="bridgeAfterHello(${back})" aria-label="${BT().ui.next}" hidden>➜</button>`;
  }

  // The first line plays only after this tap, so no browser blocks the sound.
  // Next waits until the helper has said a grown-up can see, so a quick tap cannot cut that line off.
  // Only the first tap starts that wait: a child mashing 👋 replays the hello but never pushes Next back.
  function bridgeHello(back) {
    bridgeSay([...(back ? ['bridgeStill'] : []), 'hello', 'grownUpSees']);
    if (helloTimer) return;
    helloTimer = setTimeout(() => { document.getElementById('bridge-hello-next').hidden = false; }, back ? HELLO_MS + 2000 : HELLO_MS);
  }

  function bridgeAfterHello(back) {
    if (back) return bridgeToStory();
    renderBridgePick();
    showScene('bridge-pick');
    bridgeSay(['pickFriend']);
  }

  function renderBridgePick() {
    document.getElementById('scene-bridge-pick').innerHTML = `
      <div class="creature-cards">
        ${Object.keys(WORLD.creatures).map((c) => `
          <div class="creature-card${c === bridgePicked ? ' selected' : ''}" role="button" tabindex="0" aria-label="${CONTENT.creatures[c].name}" onclick="bridgePick('${c}')">
            <img src="${WORLD.creatures[c]}" alt="${CONTENT.creatures[c].alt}" width="100" height="187">
            <h2>${CONTENT.creatures[c].name}</h2>
          </div>`).join('')}
      </div>
      ${bridgePicked ? `<button class="bridge-big" onclick="bridgeToStory()" aria-label="${BT().ui.confirm}">✓</button>` : ''}`;
  }

  function bridgePick(c) {
    bridgePicked = c;
    state.creature = c;
    renderBridgePick();
    bridgeSay(['name']);
  }

  // The creature in a pose. A worn outfit (or a missing pose) keeps the creature's own picture.
  function bridgeFigure(pose) {
    const parts = earnedParts();
    const src = WORLD.poses && WORLD.poses[state.creature] && WORLD.poses[state.creature][pose];
    if (!src || PARTS.some((p) => parts.includes(p.id))) return creatureFigure(state.creature, parts);
    return `<span class="creature-figure" data-creature="${state.creature}" data-pose="${pose}"><img class="creature-figure__body" src="${src}" alt=""></span>`;
  }

  function bridgeBubble(side, id) {
    return `<p class="bridge-bubble bridge-bubble--${side}" data-line="${id}" hidden>${bridgeLine(id).text}</p>`;
  }

  // Two lines, one bubble each: the creature asks from the far bank, the helper answers from ours.
  function renderBridgeStory() {
    document.getElementById('scene-bridge-story').innerHTML = `
      <div class="bridge-stage bridge-stage--story">
        <div class="bridge-speaker bridge-speaker--right">${bridgeFigure('worried')}${bridgeBubble('right', 'storyCreature')}</div>
        <div class="bridge-speaker bridge-speaker--left"><img src="${WORLD.cast.helper}" alt="" width="120" height="120">${bridgeBubble('left', 'storyHelper')}</div>
      </div>
      <button class="bridge-big" id="bridge-story-go" onclick="bridgeToRiver()" aria-label="${BT().ui.confirm}" hidden>✓</button>`;
  }

  // Each bubble opens as its line starts. Leaving for the map stops the voice, so no line lands late;
  // the hidden check covers any other way out.
  function bridgeToStory() {
    renderBridgeStory();
    showScene('bridge-story');
    bridgePlaceFigures();
    const ids = ['storyCreature', 'storyHelper'];
    voice.play(ids.map(bridgeLine), (i) => {
      const scene = document.getElementById('scene-bridge-story');
      if (scene.hidden) return;
      scene.querySelectorAll('.bridge-bubble').forEach((b) => { b.hidden = b.dataset.line !== ids[i]; });
      scene.querySelectorAll('.bridge-speaker').forEach((s) => s.classList.toggle('is-speaking', !s.querySelector('.bridge-bubble').hidden));
      if (i === ids.length - 1) document.getElementById('bridge-story-go').hidden = false;
    });
  }

  function bridgeToRiver() {
    renderBridgeRiver();
    showScene('bridge-river');
    bridgePlaceFigures();
    bridgeSay(['fillGap']);
    bridgeKeepPlanksInView();
    armIdle();
  }

  // The caption bar is fixed over the bottom of the screen. When the river is still too tall for what is
  // left above it, scroll just enough that the planks on our bank sit clear of the bar.
  function bridgeKeepPlanksInView() {
    const bank = document.querySelector('#scene-bridge-river .bridge-bank--near').getBoundingClientRect();
    const bar = document.getElementById('voice-caption');
    const floor = (bar.hidden ? innerHeight : bar.getBoundingClientRect().top) - 8;
    if (bank.bottom > floor) window.scrollBy(0, bank.bottom - floor);
  }

  // Spots on the painted river (a fraction of the 1440×960 backdrop): the far end of the bridge where the
  // creature waits, the bridge's foot on our bank, and where it meets the helper, who waits right of the
  // path so the cake on the left stays in view.
  const RIVER = { far: [0.5, 0.37], foot: [0.5, 0.8], meet: [0.54, 0.88], host: [0.68, 0.9] };
  const NEAR_SCALE = 1.8; // the creature grows as it walks down the bridge towards us

  // Where a spot of the backdrop lands on the stage. The backdrop covers the stage at --bg-x across.
  function riverPoint(stage, [fx, fy]) {
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    const k = Math.max(w / 1440, h / 960);
    const bx = parseFloat(getComputedStyle(stage).getPropertyValue('--bg-x')) / 100;
    return { x: (w - 1440 * k) * bx + fx * 1440 * k, y: (h - 960 * k) / 2 + fy * 960 * k, k };
  }

  // Feet on the painted planks, sized to the bridge; called whenever the story or the river is drawn or resized.
  function bridgePlaceFigures() {
    const story = document.querySelector('#scene-bridge-story .bridge-stage');
    if (story && story.clientWidth) {
      const p = riverPoint(story, RIVER.far);
      story.style.setProperty('--far-x', `${p.x}px`);
      story.style.setProperty('--far-y', `${p.y}px`);
    }
    const stage = document.querySelector('#scene-bridge-river .bridge-stage');
    if (!stage || !stage.clientWidth) return;
    [['.bridge-bank--far', RIVER.far, 180], ['.bridge-host', RIVER.host, 260]].forEach(([sel, spot, size]) => {
      const p = riverPoint(stage, spot);
      Object.assign(stage.querySelector(sel).style, { left: `${p.x}px`, top: `${p.y}px`, width: `${Math.round(size * p.k)}px` });
    });
  }
  addEventListener('resize', bridgePlaceFigures);

  // Dots in rows of five, like a ten-frame, with the numeral under them so nobody has to count.
  function dots(n) {
    return `<span class="bridge-dots" style="grid-template-columns: repeat(${Math.min(n, 5)}, var(--dot))">${'<i></i>'.repeat(n)}</span><b class="bridge-num">${n}</b>`;
  }

  // The gap as a sum: "? = 8" at first, then "3 + ? = 8", then "3 + 5 = 8".
  function bridgeSum(item) {
    const parts = [...item.placed, ...bridge.used.map((i) => item.planks[i])];
    if (BRIDGE.filled(bridge) < item.gap) parts.push('?');
    return `<p class="bridge-sum" aria-hidden="true">${parts.join(' + ')} = ${item.gap}</p>`;
  }

  function bridgeCard({ line, icon }, onPick, picked = false) {
    return `<div class="bridge-card${picked ? ' is-picked' : ''}">
      <button class="bridge-card__pick" onclick="${onPick}" aria-label="${BT().say[line]}"><span aria-hidden="true">${icon}</span>${BT().say[line]}</button>
      <button class="bridge-card__hear" onclick="bridgeSay(['${line}'])" aria-label="${BT().ui.hear}">🔊</button>
    </div>`;
  }

  function renderBridgeRiver() {
    const item = BRIDGE.current(bridge);
    const empty = item.gap - BRIDGE.filled(bridge);
    const point = bridge.pointing ? ' is-pointable' : '';
    const slots = bridge.queue.length; // one star per item, the short one included when it is added
    const won = Math.min(bridge.stars, slots);
    document.getElementById('scene-bridge-river').innerHTML = `
      <div class="bridge-stars" aria-hidden="true">${Array.from({ length: slots }, (_, i) => `<i class="${i < won ? 'is-won' : ''}">★</i>`).join('')}</div>
      <div class="bridge-stage">
        <div class="bridge-bank bridge-bank--far">${bridgeFigure('worried')}</div>
        <img class="bridge-host" src="${WORLD.cast.helper}" alt="">
        <div class="bridge-gap${point}" data-item="${bridge.queue[bridge.at]}" role="button" tabindex="0" aria-label="${BT().ui.gap}" onclick="bridgeTapGap()">
          ${item.placed.map((n) => `<span class="bridge-seg bridge-seg--fixed">${dots(n)}</span>`).join('')}
          ${bridge.used.map((i) => `<button class="bridge-seg" onclick="event.stopPropagation(); bridgeEvent({ type: 'take', plank: ${i} })" aria-label="${BT().ui.takeBack(item.planks[i])}">${dots(item.planks[i])}</button>`).join('')}
          ${'<span class="bridge-spot"></span>'.repeat(empty)}
        </div>
        ${bridgeSum(item)}
        <div class="bridge-bank bridge-bank--near">
          ${item.planks.map((n, i) => (bridge.used.includes(i) ? '' : `<button class="bridge-plank${point}" data-plank="${i}" aria-label="${BT().ui.plank(n)}">${dots(n)}</button>`)).join('')}
        </div>
      </div>
      <button class="bridge-ask" onclick="bridgeOpenCards()" aria-label="${BT().ui.ask}">🙋</button>
      <div class="bridge-panel bridge-cards" id="bridge-cards" hidden></div>
      <div class="bridge-panel bridge-slip" id="bridge-slip" ${bridge.phase === 'slip' ? '' : 'hidden'}>
        <button onclick="bridgeEvent({ type: 'slip', answer: 'no' })" aria-label="${BT().ui.slipNo}">✋</button>
        <button onclick="bridgeEvent({ type: 'slip', answer: 'yes' })" aria-label="${BT().ui.slipYes}">👍</button>
      </div>
      <div class="bridge-panel bridge-example" id="bridge-example" onclick="this.hidden = true" hidden></div>`;
    bridgePlaceFigures();
  }

  function bridgeEvent(e) {
    if (bridgeBusy) return;
    const r = BRIDGE.step(bridge, e);
    bridge = r.state;
    document.getElementById('scene-bridge-river').dataset.said = r.say.join(' ');
    if (r.say.length) bridgeSay(r.say);
    if (r.show.some((fx) => fx.kind === 'cross')) return bridgeCross(e);
    renderBridgeRiver();
    r.show.forEach(bridgeShow);
    bridgeKeepPlanksInView();
    armIdle();
  }

  // The star a crossing earns is drawn by bridgeCross, since the river does not re-render first.
  function bridgeShow(fx) {
    const river = document.getElementById('scene-bridge-river');
    if (fx.kind === 'bounce') river.querySelector(`.bridge-plank[data-plank="${fx.plank}"]`).classList.add('is-bounce');
    if (fx.kind === 'pause') {
      river.classList.add('is-paused');
      setTimeout(() => river.classList.remove('is-paused'), 1000);
    }
    if (fx.kind === 'jar') saveJar();
    if (fx.kind === 'example') {
      const box = document.getElementById('bridge-example');
      box.innerHTML = `<div class="bridge-example__row"><img src="${WORLD.cast.helper}" alt="" width="64" height="64"><div class="bridge-gap bridge-gap--example">${fx.planks.map((n) => `<span class="bridge-seg">${dots(n)}</span>`).join('')}</div></div>`;
      box.hidden = false; // stays until the child taps it away or their next move re-renders the river
    }
  }

  // The rules have already moved on; the old picture stays up while the creature walks across.
  function bridgeCross(e) {
    bridgeBusy = true;
    clearTimeout(idleTimer);
    document.getElementById('bridge-slip').hidden = true;
    // The plank that closed the gap is part of the bridge now, not still waiting on the bank.
    if (e.type === 'drop') document.querySelector(`#scene-bridge-river .bridge-plank[data-plank="${e.plank}"]`).classList.add('is-placed');
    document.querySelector('#scene-bridge-river .bridge-stage').classList.add('is-crossing');
    if (bridge.stars <= bridge.queue.length) {
      document.querySelectorAll('#scene-bridge-river .bridge-stars i')[bridge.stars - 1].classList.add('is-won', 'is-new');
    }
    bridgeHop();
    crossTimer = setTimeout(() => {
      stopHop();
      bridgeBusy = false;
      if (document.getElementById('scene-bridge-river').hidden) return; // the child left for the map
      if (bridge.phase === 'strategy') {
        renderBridgeStrategy();
        return showScene('bridge-strategy');
      }
      renderBridgeRiver();
      bridgeKeepPlanksInView();
      armIdle();
    }, CROSS_MS);
  }

  function stopHop() {
    hop.anims.forEach((a) => a.cancel());
    hop.timers.forEach(clearTimeout);
    hop = { anims: [], timers: [] };
  }

  // Alex's hop (docs/superpowers/briefs/2026-09-30-hedgehog-hop-preview.html) turned into a walk: crouch,
  // hop down the now-whole bridge towards us, growing with each hop, to the helper waiting by the party,
  // land with a squash, two small joy hops — all inside CROSS_MS. The figure carries the path, the
  // picture inside it the squash. Pose frames swap in only for a creature drawn in poses.
  function bridgeHop() {
    const river = document.getElementById('scene-bridge-river');
    const stage = river.querySelector('.bridge-stage');
    const fig = river.querySelector('.bridge-bank--far .creature-figure');
    const img = fig.querySelector('.creature-figure__body');
    const poses = fig.dataset.pose && WORLD.poses[state.creature];
    const frame = (p) => { if (poses && poses[p]) img.src = poses[p]; };
    const [a, foot, meet] = [RIVER.far, RIVER.foot, RIVER.meet].map((spot) => riverPoint(stage, spot));
    const to = (p, s, lift = 0) => ({ transform: `translate(${p.x - a.x}px, ${p.y - a.y - lift}px) scale(${s})` });
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      frame('happy');
      fig.style.transform = to(meet, NEAR_SCALE).transform;
      return;
    }

    const ease = 'cubic-bezier(0.23, 1, 0.32, 1)';
    const path = (frames, duration, easing = ease) => hop.anims.push(fig.animate(frames, { duration, easing, fill: 'forwards' }));
    const squash = (frames, duration) => hop.anims.push(img.animate(frames, { duration, easing: ease, fill: 'forwards' }));
    const at = (ms, fn) => hop.timers.push(setTimeout(() => (river.hidden ? stopHop() : fn()), ms));
    // Four hops down the bridge, one more over to the helper; each lands, then lifts halfway to the next.
    const mix = (p, q, t) => ({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });
    const stops = [a, mix(a, foot, 0.25), mix(a, foot, 0.5), mix(a, foot, 0.75), foot, meet];
    const scale = (i) => 1 + (NEAR_SCALE - 1) * (i / (stops.length - 1));
    const walk = stops.flatMap((p, i) => {
      const land = { ...to(p, scale(i)), offset: i / (stops.length - 1) };
      if (i === stops.length - 1) return [land];
      const mid = mix(p, stops[i + 1], 0.5);
      return [land, { ...to(mid, (scale(i) + scale(i + 1)) / 2, 18 * scale(i)), offset: (i + 0.5) / (stops.length - 1) }];
    });
    const end = (lift) => to(meet, NEAR_SCALE, lift);

    frame('crouch');
    squash([{ transform: 'scale(1, 1)' }, { transform: 'scale(1.08, 0.9)' }], 240);
    at(240, () => {
      frame('jump');
      squash([{ transform: 'scale(1.08, 0.9)' }, { transform: 'scale(1, 1)' }], 200);
      path(walk, 1200, 'linear');
    });
    at(1440, () => {
      frame('happy');
      squash([{ transform: 'scale(1.14, 0.84)' }, { transform: 'scale(0.96, 1.05)', offset: 0.55 }, { transform: 'scale(1, 1)' }], 320);
    });
    at(1760, () => path([end(0), { ...end(22), offset: 0.25 }, { ...end(0), offset: 0.5 }, { ...end(12), offset: 0.75 }, end(0)], 420, 'ease-in-out'));
  }

  function saveJar() {
    const saved = loadProgress().jar || [];
    const add = bridge.jar.filter((id) => !saved.some((j) => j.id === id)).map((id) => ({ id, ...BT().jar[id] }));
    if (add.length) saveProgress({ jar: [...saved, ...add] });
  }

  function bridgeTapPlank(i) {
    bridgeEvent(bridge.pointing ? { type: 'point', target: i } : { type: 'drop', plank: i, t: Date.now() });
  }

  function bridgeTapGap() {
    if (bridge.pointing) bridgeEvent({ type: 'point', target: 'gap' });
  }

  const shuffled = (a) => a.map((x) => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map((p) => p[1]);

  function bridgeOpenCards() {
    if (bridgeBusy || bridge.phase !== 'play') return;
    const box = document.getElementById('bridge-cards');
    document.getElementById('bridge-example').hidden = true;
    box.innerHTML = shuffled(BT().cards).map((c) => bridgeCard(c, `bridgeAsk('${c.id}')`)).join('');
    box.hidden = false;
    bridgeSay(['askHow']);
    armIdle();
  }

  function bridgeAsk(card) {
    document.getElementById('bridge-cards').hidden = true;
    bridgeEvent({ type: 'ask', card });
  }

  function armIdle() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      const river = document.getElementById('scene-bridge-river');
      const cards = document.getElementById('bridge-cards');
      if (!river.hidden && cards && cards.hidden) bridgeEvent({ type: 'idle' });
    }, IDLE_MS);
  }

  // A plank goes onto the gap by a tap or by dragging it there. Pointer events carry both; a keyboard
  // Enter arrives as a click with detail 0, so the two paths never fire for the same tap.
  let bridgeDrag = null;
  document.addEventListener('pointerdown', (e) => {
    const plank = e.target.closest('#scene-bridge-river .bridge-plank');
    if (!plank || bridgeBusy) return;
    bridgeDrag = { plank, x: e.clientX, y: e.clientY };
    plank.setPointerCapture(e.pointerId);
  });
  document.addEventListener('pointermove', (e) => {
    if (bridgeDrag) bridgeDrag.plank.style.translate = `${e.clientX - bridgeDrag.x}px ${e.clientY - bridgeDrag.y}px`;
  });
  document.addEventListener('pointercancel', () => {
    if (bridgeDrag) bridgeDrag.plank.style.translate = '';
    bridgeDrag = null;
  });
  document.addEventListener('pointerup', (e) => {
    if (!bridgeDrag) return;
    const { plank, x, y } = bridgeDrag;
    bridgeDrag = null;
    plank.style.translate = '';
    const gap = document.querySelector('#scene-bridge-river .bridge-gap').getBoundingClientRect();
    const onGap = e.clientX >= gap.left && e.clientX <= gap.right && e.clientY >= gap.top && e.clientY <= gap.bottom;
    if (Math.hypot(e.clientX - x, e.clientY - y) < 12 || onGap) bridgeTapPlank(Number(plank.dataset.plank));
  });
  document.addEventListener('click', (e) => {
    const plank = e.target.closest('#scene-bridge-river .bridge-plank');
    if (plank && e.detail === 0) bridgeTapPlank(Number(plank.dataset.plank));
  });

  function renderBridgeStrategy() {
    document.getElementById('scene-bridge-strategy').innerHTML = `
      <div class="bridge-helper bridge-helper--small"><img src="${WORLD.cast.helper}" alt="" width="120" height="120"></div>
      <div class="bridge-choices">
        ${BT().strategies.map((s) => bridgeCard(s, `bridgeStrategy('${s.id}')`, s.id === bridge.strategy)).join('')}
      </div>
      ${bridge.phase === 'done' ? `<button class="bridge-big" onclick="renderBridgeReward(); showScene('bridge-reward')" aria-label="${BT().ui.next}">➜</button>` : ''}`;
  }

  function bridgeStrategy(id) {
    const r = BRIDGE.step(bridge, { type: 'strategy', id });
    bridge = r.state;
    renderBridgeStrategy();
    if (r.say.length) bridgeSay(r.say);
  }

  function renderBridgeReward() {
    const saved = loadProgress();
    saveProgress({ bridge: 'done', loadout: { creature: state.creature, skills: saved.loadout ? [...saved.loadout.skills] : [...DEFAULT_LOADOUT.skills] } });
    document.getElementById('scene-bridge-reward').innerHTML = `
      <div class="reward-celebration">
        <h1>${BT().reward.heading}</h1>
        ${rewardStars()}
        <div class="reward-companion">
          <div class="creature-portrait">${creatureFigure(state.creature, earnedParts(), 'satchel')}</div>
        </div>
      </div>
      <button onclick="startTakeaway('bridge')">${BT().takeaway.cta}</button>`;
    bridgeSay(['reward']);
  }
