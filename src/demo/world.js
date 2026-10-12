// demo/world.js — the skin's art and geography. A reskin swaps this file (and the copy), not the engine.
  const WORLD = {
    // The village with the river bridge, the shop and the garden on one drawn path.
    map: {
      src: 'assets/map-wide.webp',
    },

    // x/y below belong to the old assets/map.webp (archived build levels); live code uses only the icons.
    // Measured off map.src itself by overlaying a 10% grid, not guessed. The prompt in
    // docs/product/2026-09-11-demo-art-prompts.md asked for slightly different spots and the render
    // drifted from them, so these follow the file. Regenerate the map and they must be re-measured.
    // Icons are the landmark drawings on the signposts over each place.
    places: {
      // The map has no bridge of its own: this is where the bridge flag stands, by the pond.
      bridge:   { x: 10, y: 28, icon: '<path d="M2 8h20M5 8v9M19 8v9M5 17q7-9 14 0M3 21q2-1.5 4.5 0t4.5 0 4.5 0 4.5 0"/>' },
      home:     { x: 16, y: 72, icon: '<path d="M3 11 12 4l9 7M5 10v10h14V10M10 20v-6h4v6"/>' },
      neighbor: { x: 33, y: 45, icon: '<path d="m3 11 9-7 9 7M5 10v10h14V10M9 14h6v6M17 5V3M3 20h18"/>' },
      shop:     { x: 61, y: 69, icon: '<path d="M4 10v10h16V10M3 10l2-6h14l2 6M3 10q3 4 6 0 3 4 6 0 3 4 6 0M9 20v-6h6v6"/>' },
      garden:   { x: 81, y: 41, icon: '<path d="M12 21V10M12 14C3 14 3 7 3 7s9-1 9 7Zm0-4c0-7 8-7 8-7s1 7-8 7ZM5 21h14"/>' },
      school:   { x: 60, y: 17, icon: '<path d="M3 9h18L12 3 3 9Zm2 0v11h14V9M3 20h18M9 20v-6h6v6M12 6v1"/>' },
      pond:     { x: 25, y: 25, icon: '<path d="M3 16q3-3 6 0t6 0 6 0M3 20q3-3 6 0t6 0 6 0M8 12V4M8 8 4 5M8 10l4-5M17 12V6"/>' },
    },

    // Course signs on the wide map, keyed by place, as % of the stage: each stands just above its
    // landmark so the drawing stays visible. Wide screens only: phones use phoneMap below.
    courseFlags: { bridge: [33, 38], shop: [90, 40], garden: [50, 20] },

    // Phones get their own tall village (home at the bottom, then the river bridge, the shop, the
    // garden) with the path drawn into the art. Each sign is a row on the grass at the left, its flag
    // planted on the path: [where the flag ends, where the row sits], as % of the picture, measured off the file.
    phoneMap: {
      src: 'assets/map-phone.webp',
      flags: { bridge: [62, 63], shop: [62, 36], garden: [62, 21] },
    },

    creatures: {
      blue: 'assets/creature-kingfisher.webp',
      green: 'assets/creature-hedgehog.webp',
      amber: 'assets/creature-beaver.webp',
    },

    // The creature redrawn wearing what it has earned, keyed by the latest part: the satchel.
    // Drawn whole rather than overlaid, so the paws, straps and materials
    // belong to the animal.
    outfits: {
      blue:  { satchel: 'assets/creature-kingfisher-satchel.webp' },
      green: { satchel: 'assets/creature-hedgehog-satchel.webp' },
      amber: { satchel: 'assets/creature-beaver-satchel.webp' },
    },

    // Poses for the base look only; a worn outfit keeps its own picture (see bridgeFigure).
    poses: {
      green: { worried: 'assets/creature-hedgehog-worried.webp', happy: 'assets/creature-hedgehog-happy.webp', crouch: 'assets/creature-hedgehog-crouch.webp', jump: 'assets/creature-hedgehog-jump.webp' },
    },
    scenes: { bridge: 'assets/scene-bridge.webp' },

    // Keyed by story role, so a skin never shows through an id.
    cast: {
      client: 'assets/cast-rabbit.webp',
      neighbor: 'assets/cast-tortoise.webp',
      shopkeeper: 'assets/cast-mouse.webp',
      gardener: 'assets/cast-mole.webp',
      dog: 'assets/cast-goose.webp',
      helper: 'assets/cast-helper.webp',
    },
  };
