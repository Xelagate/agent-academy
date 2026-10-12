// demo/level.js — the village walk. The only behavioural axis is `memory`.
const LEVEL = (function () {
  const POINTS = {
    home:   { ua: 'двір Лесі',   at: 'у дворі Лесі',   hint: 'myron',  say: 'Мирон із сусіднього двору завжди все бачить' },
    myron:  { ua: 'двір Мирона', at: 'у дворі Мирона', hint: 'shop',   say: 'Побіг у бік крамниці' },
    shop:   { ua: 'крамниця',    at: 'у крамниці',     hint: 'garden', say: 'Продавчиня бачила смугастий хвіст у саду' },
    garden: { ua: 'сад',         at: 'у саду',         hint: 'myron',  say: 'Садівник каже: рвонув назад до Миронового двору' },
    school: { ua: 'дах школи',   at: 'на даху школи',  hint: 'pond',   say: 'Зі шкільного даху видно ставок — там щось сіре ворушиться' },
    pond:   { ua: 'ставок',      at: 'біля ставка',    hint: null,     say: 'Сірко тут! Спить під вербою' },
  };

  // Where the creature goes when memory rules the hint out. Fixed, so the walk is deterministic.
  const ORDER = ['myron', 'shop', 'garden', 'school', 'pond'];

  const START_HOUR = 8;
  const SUNSET_HOUR = 20;
  const HOURS_PER_MOVE = 2;
  const MAX_MOVES = (SUNSET_HOUR - START_HOUR) / HOURS_PER_MOVE;

  function walk({ memory }) {
    let at = 'home';
    const visited = [];
    const log = [];

    for (let move = 1; move <= MAX_MOVES; move++) {
      let target = POINTS[at].hint;
      let viaMemory = false;

      if (memory && visited.includes(target)) {
        target = ORDER.find((p) => !visited.includes(p)) || null;
        viaMemory = true;
      }
      if (!target) break;

      const repeat = visited.includes(target);
      visited.push(target);
      log.push({
        move,
        hour: START_HOUR + move * HOURS_PER_MOVE,
        from: at,
        to: target,
        repeat,
        viaMemory,
        say: POINTS[target].say,
      });

      at = target;
      if (at === 'pond') return { outcome: 'found', moves: move, log };
    }

    return { outcome: 'sunset', moves: log.length, log };
  }

  return { POINTS, ORDER, MAX_MOVES, walk };
})();

if (typeof module !== 'undefined') module.exports = LEVEL;
