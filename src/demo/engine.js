// demo/engine.js — what every level shares: scenes, the course map, progress, keyboard.
  const state = { creature: null };

  const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

  // Each creature has one fixed name; escaped for consistency with markup that used to hold a typed one.
  function creatureName(creature) {
    return escapeHtml(CONTENT.creatures[creature].name);
  }

  // The helper's voice: one element, and a new line cuts the old one off. Every line is also a caption,
  // so a missing file or a blocked play() only costs the sound, never the game.
  const voice = (function () {
    const audio = typeof Audio === 'function' ? new Audio() : null;
    const bar = () => document.getElementById('voice-caption');
    let last = [];
    let lastOnLine = null; // replay re-runs what the lines drive on screen, like the story's ✓
    let run = 0;

    function stop() {
      run += 1;
      if (audio) { audio.onended = audio.onerror = null; audio.pause(); }
      bar().hidden = true;
    }

    function play(lines, onLine) {
      stop();
      if (!lines.length) return;
      last = lines;
      lastOnLine = onLine;
      const mine = run;
      bar().hidden = false;
      const next = (i) => {
        if (mine !== run) return;
        // The course map has no room for the bar once the last line is done; inside levels it stays.
        if (i >= lines.length) {
          if (!document.getElementById('scene-course').hidden) bar().hidden = true;
          return;
        }
        const { id, text } = lines[i];
        bar().querySelector('.voice-caption__text').textContent = text;
        if (onLine) onLine(i);
        const src = typeof VOICE !== 'undefined' && VOICE[id];
        // onerror and a rejected play() can both fire for one bad file; move on only once.
        let moved = false;
        const move = (wait) => { if (!moved) { moved = true; setTimeout(() => next(i + 1), wait); } };
        const later = () => move(500 + text.length * 60);
        if (!audio || !src) return later();
        audio.onended = () => move(0);
        audio.onerror = later;
        audio.src = src;
        audio.play().catch(later);
        // A play() can also hang without ending or failing; if the clip never got going, move on anyway.
        const guard = () => {
          if (moved || mine !== run) return;
          if (!audio.paused && audio.currentTime > 0) setTimeout(guard, 1000);
          else move(0);
        };
        setTimeout(guard, 1000 + text.length * 60);
      };
      next(0);
    }

    return { play, stop, replay: () => play(last, lastOnLine) };
  })();
  document.querySelector('.voice-caption__replay').setAttribute('aria-label', CONTENT.ui.replay);

  // Share one bitmap between scene backdrops and run maps, including offline.
  document.documentElement.style.setProperty('--village-art', `url("${WORLD.map.src}")`);
  document.documentElement.style.setProperty('--phone-art', `url("${WORLD.phoneMap.src}")`);
  document.title = CONTENT.pageTitle;

  // Decorative game pieces: no controls, scoring, or simulation state lives here.
  function gameIcon(name) {
    const paths = {
      star: '<path d="m12 2 3 6.5 7 .9-5.2 5 1.3 7.1L12 18l-6.1 3.5 1.3-7.1L2 9.4l7-.9Z"/>',
      lock: '<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/>',
      character: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2Z"/>',
      skills: '<path d="m14 3-3 7H5l5 4-2 7 11-13h-6l3-5Z"/>',
      memory: '<rect x="5" y="7" width="14" height="15" rx="4"/><path d="M9 7V4h6v3M8 14h8v5H8Zm-3-3H3v7h2m14-7h2v7h-2"/>',
      rules: '<path d="m12 2 9 4v7c0 5-9 9-9 9s-9-4-9-9V6Zm-4 9 3 3 5-6"/>',
      compass: '<circle cx="12" cy="12" r="10"/><path d="m16 6-2 8-8 4 4-8Z"/>',
      map: '<path d="m9 4-6 2v14l6-2 6 2 6-2V4l-6 2Z"/><path d="M9 4v14m6-12v14"/>',
    };
    return `<svg class="game-icon game-icon--${name}" viewBox="0 0 24 24" aria-hidden="true">${paths[name]}</svg>`;
  }

  function rewardStars() {
    return `<div class="reward-stars" aria-hidden="true">${gameIcon('star').repeat(3)}</div>`;
  }

  // Every level walks the same five steps: the HUD names the place and shows how far along it is.
  const STEPS = 5;
  const STAGE_OF = { takeaway: 4,
    'bridge-hello': 0, 'bridge-pick': 1, 'bridge-story': 1, 'bridge-river': 2, 'bridge-strategy': 3, 'bridge-reward': 4 };
  let hudPlace = 'bridge'; // the takeaway is shared, so it keeps the place of the scene before it

  function renderLevelHud(id) {
    const stage = STAGE_OF[id];
    const hud = document.getElementById('level-hud');
    hud.hidden = stage === undefined;
    if (hud.hidden) return;
    if (CONTENT.course.tiles[id.split('-')[0]]) hudPlace = id.split('-')[0];
    const title = CONTENT.course.tiles[hudPlace].title;
    hud.innerHTML = `
      <button class="hud-home" onclick="leaveLevel()">${gameIcon('map')}<span>${CONTENT.ui.backToMap}</span></button>
      <div class="level-steps" role="img" aria-label="${CONTENT.ui.stepOf(title, stage + 1, STEPS)}">
        <span class="level-steps__label" aria-hidden="true">${title}</span>
        <span class="level-steps__pips" aria-hidden="true">${Array.from({ length: STEPS }, (_, i) =>
          `<i class="${i < stage ? 'is-done' : i === stage ? 'is-current' : ''}"></i>`).join('')}</span>
      </div>`;
  }

  // A level can be left at any stage; nothing is saved until its reward, so leaving drops the attempt.
  function leaveLevel() {
    const progress = loadProgress();
    if (progress.bridge !== 'done') state.creature = null;
    renderCourseMap();
    showScene('course');
  }

  function showScene(id) {
    let shown;
    document.querySelectorAll('.scene').forEach((scene) => {
      scene.hidden = scene.id !== 'scene-' + id;
      if (!scene.hidden) shown = scene;
    });
    renderLevelHud(id);
    if (!/^(bridge-|takeaway$)/.test(id)) voice.stop();
    window.scrollTo(0, 0);
    // Move focus into the new scene so keyboard and screen-reader users start at its heading.
    const heading = shown && shown.querySelector('h1, h2');
    if (heading) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
  }

  // The choices are styled divs, not buttons, so the level would be unplayable from a keyboard.
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    // Native buttons already produce a click for Enter/Space.
    if (event.target.closest('button')) return;
    const card = event.target.closest('[role="button"]');
    if (!card) return;
    event.preventDefault();
    card.click();
  });

  // Progress survives a reload when storage works. When storage throws, memoryProgress
  // still holds this session's unlocks.
  const PROGRESS_KEY = 'agent-creatures-progress';
  let memoryProgress = {};

  function loadProgress() {
    try {
      return Object.assign({}, memoryProgress, JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}'));
    } catch {
      return Object.assign({}, memoryProgress);
    }
  }

  function saveProgress(patch) {
    memoryProgress = Object.assign(loadProgress(), patch);
    try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(memoryProgress)); } catch {}
  }

  const DEFAULT_LOADOUT = { creature: 'blue', skills: ['ask', 'look', 'smell'] };

  // Each finished topic adds one part the creature keeps: Asking → satchel.
  const PARTS = [
    { id: 'satchel', level: 'bridge' },
  ];

  function earnedParts() {
    const progress = loadProgress();
    return PARTS.filter((p) => progress[p.level] === 'done').map((p) => p.id);
  }

  function creatureFigure(creature, parts, newPart) {
    const worn = PARTS.filter((p) => parts.includes(p.id)).pop();
    const src = worn ? WORLD.outfits[creature][worn.id] : WORLD.creatures[creature];
    return `<span class="creature-figure" data-creature="${creature}" data-outfit="${worn ? worn.id : ''}">
      <img class="creature-figure__body${newPart ? ' creature-figure__body--new' : ''}" src="${src}" alt="">
    </span>`;
  }

  // One place per kind of maths, in path order. Only the bridge is built; the others wait behind a lock.
  const COURSE = [
    { id: 'bridge', start: 'startBridge()' },
    { id: 'shop' },
    { id: 'garden' },
  ];

  // Flags stand on the drawn path, as percentages of the full-bleed world stage.
  // On narrow screens the same nodes stand on the tall phone village instead (WORLD.phoneMap).
  function renderCourseMap() {
    const progress = loadProgress();
    // A loadout can be missing even after level 1 is done (e.g. progress saved before the loadout
    // field existed) — fall back to the same default level 2 uses, not the helper.
    const creature = state.creature || (progress.loadout && progress.loadout.creature) || (progress.bridge === 'done' ? DEFAULT_LOADOUT.creature : null);
    const isOpen = (t) => t.start && (!t.needs || progress[t.needs] === 'done');
    const today = COURSE.find((t) => isOpen(t) && progress[t.id] !== 'done');
    const tile = (t) => CONTENT.course.tiles[t.id];
    document.getElementById('scene-course').innerHTML = `
      <div class="course-hud">
        <h2 class="course__title">${gameIcon('compass')}${CONTENT.course.title}</h2>
      </div>
      <div class="home-hero">
      <div class="home-companion">
      <div class="home-creature">
        ${creature ? creatureFigure(creature, earnedParts()) : `<img class="home-helper" src="${WORLD.cast.helper}" alt="" width="320" height="320">`}
      </div>
      <p class="home-caption">${creature ? creatureName(creature) : CONTENT.course.helperHello}</p>
      ${progress.jar && progress.jar.length ? `<button class="home-jar" onclick="playJar()" aria-label="${CONTENT.course.jarLabel(progress.jar.length)}">🫙<span>${progress.jar.length}</span></button>` : ''}
      </div>
      ${today ? `<div class="today">
          <p class="today__label">${CONTENT.course.todayLabel}</p>
          <h2>${tile(today).need}</h2>
          <button onclick="${today.start}">${CONTENT.course.helpWith(tile(today).title)}</button>
        </div>` : `<div class="today"><p class="today__label">${CONTENT.course.allDoneLabel}</p><h2>${CONTENT.course.allDoneBody}</h2></div>`}
      </div>
      <div class="course">
        ${COURSE.map((t) => {
          const open = isOpen(t);
          const done = progress[t.id] === 'done';
          const [x, y] = WORLD.courseFlags[t.id];
          const [px, py] = WORLD.phoneMap.flags[t.id];
          return `<div class="course-tile${open ? '' : ' course-tile--locked'}${done ? ' course-tile--done' : ''}"
              style="--x:${x}%; --y:${y}%; --px:${px}%; --py:${py}%" ${open ? `role="button" tabindex="0" onclick="${t.start}"` : 'aria-disabled="true"'}>
            <span class="course-tile__n"><svg class="game-icon" viewBox="0 0 24 24" aria-hidden="true">${WORLD.places[t.id].icon}</svg></span>
            <div class="course-tile__plaque">
            <h2>${tile(t).title}</h2>
            <p>${tile(t).topic}</p>
            <span class="course-tile__status">${open ? (done ? CONTENT.course.done : CONTENT.course.play) : `${gameIcon('lock')}<span class="sr-only">${CONTENT.course.locked}</span>`}</span>
            </div>
            ${done ? `<span class="course-tile__star">${gameIcon('star')}</span>` : ''}
          </div>`;
        }).join('')}
      </div>
    `;
  }

  // The jar reads its questions out, so a child who can't read can still take them to a grown-up.
  function playJar() {
    const say = CONTENT.bridge.say;
    voice.play([{ id: 'jarAsk', text: say.jarAsk }, ...(loadProgress().jar || []).map((j) => ({ id: j.line, text: j.text }))]);
  }

  // Takeaway scene — shared by every level: names the lesson and bridges it to real AI.
  // `takeawaySolved` gates the "Back to the course map" button; unlimited retries on a miss.
  let takeawayAnswer = null;
  let takeawaySolved = false;

  function renderTakeaway(levelKey) {
    const t = CONTENT[levelKey].takeaway;
    const answer = takeawayAnswer === null ? null : t.answers[takeawayAnswer];
    document.getElementById('scene-takeaway').innerHTML = `
      <h1 class="ribbon">${t.heading}</h1>
      <div class="story-copy">
        <p>${t.lesson}</p>
        <p>${t.bridge}</p>
        <p>${t.question}</p>
      </div>
      <div class="card-row">
        ${t.answers.map((a, i) => `<div class="card${i === takeawayAnswer ? ' selected' : ''}" role="button" tabindex="0" onclick="answerTakeaway('${levelKey}', ${i})">${a.text}</div>`).join('')}
      </div>
      <div id="takeaway-feedback" role="region" aria-labelledby="takeaway-reply" tabindex="-1" ${answer ? '' : 'hidden'}>
        <p id="takeaway-reply"${answer && !answer.correct ? ' class="postmortem-reply--miss"' : ''}>${answer ? answer.reply : ''}</p>
      </div>
      ${takeawaySolved ? `<button onclick="renderCourseMap(); showScene('course')">${t.back}</button>` : ''}
    `;
  }

  function answerTakeaway(levelKey, i) {
    takeawayAnswer = i;
    if (CONTENT[levelKey].takeaway.answers[i].correct) takeawaySolved = true;
    renderTakeaway(levelKey);
    const t = CONTENT[levelKey].takeaway;
    if (t.voice) voice.play([{ id: t.voice.replies[i], text: t.answers[i].reply }]);
    const feedback = document.getElementById('takeaway-feedback');
    feedback.focus({ preventScroll: true });
    // Once solved, bring the back button into view too — on a phone it sits below the fold.
    (document.querySelector('#scene-takeaway > button') || feedback).scrollIntoView({ block: 'nearest' });
  }

  // Entry point from a reward scene's cta — always starts fresh, so a replay never shows a stale answer.
  function startTakeaway(levelKey) {
    takeawayAnswer = null;
    takeawaySolved = false;
    renderTakeaway(levelKey);
    showScene('takeaway');
    const t = CONTENT[levelKey].takeaway;
    if (t.voice) voice.play(t.voice.intro.map((id) => ({ id, text: CONTENT[levelKey].say[id] })));
  }
