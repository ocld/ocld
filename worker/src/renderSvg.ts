import { DINO_X, GAME_HEIGHT, GAME_WIDTH, dinoY, type DinoState, type Obstacle } from "./game";
import { DUCK_TREX_A, DUCK_TREX_B, PTERO_DOWN_PATH, PTERO_UP_PATH, SPRITES } from "./sprites";

function spriteCrop(
  id: string,
  href: string,
  sheetW: number,
  sheetH: number,
  srcX: number,
  srcY: number,
  w: number,
  h: number,
  dstX: number,
  dstY: number,
  extra = ""
): string {
  return (
    `<g transform="translate(${dstX},${dstY})"${extra}>` +
    `<clipPath id="${id}"><rect x="0" y="0" width="${w}" height="${h}"/></clipPath>` +
    `<image href="${href}" x="${-srcX}" y="${-srcY}" width="${sheetW}" height="${sheetH}" clip-path="url(#${id})" style="image-rendering:pixelated"/>` +
    `</g>`
  );
}

function renderScoreDigits(score: number, highScore: number): string {
  const parts: string[] = [];
  const scoreStr = String(Math.min(99999, Math.max(0, Math.floor(score)))).padStart(5, "0");
  const hiStr = String(Math.min(99999, Math.max(0, Math.floor(highScore)))).padStart(5, "0");

  // HI 00000 (drawn at 0.72 opacity left of current score, matching Chromium DistanceMeter)
  const hiBaseX = GAME_WIDTH - 11 * 6 - 10 * 9 - 8;
  parts.push(`<g opacity="0.72">`);
  // H (10) and I (11)
  parts.push(spriteCrop("ch-h", SPRITES.text2x, 191, 24, 100, 0, 10, 13, hiBaseX, 10));
  parts.push(spriteCrop("ch-i", SPRITES.text2x, 191, 24, 110, 0, 10, 13, hiBaseX + 11, 10));
  for (let i = 0; i < 5; i++) {
    const d = Number(hiStr[i]);
    parts.push(spriteCrop(`hi-${i}`, SPRITES.text2x, 191, 24, d * 10, 0, 10, 13, hiBaseX + 30 + i * 11, 10));
  }
  parts.push(`</g>`);

  // current score 00000
  const curBaseX = GAME_WIDTH - 11 * 6;
  for (let i = 0; i < 5; i++) {
    const d = Number(scoreStr[i]);
    parts.push(spriteCrop(`sc-${i}`, SPRITES.text2x, 191, 24, d * 10, 0, 10, 13, curBaseX + i * 11, 10));
  }

  return parts.join("");
}

function renderObstacle(ob: Obstacle, idx: number, tick: number): string {
  if (ob.kind === "ptero") {
    const flapUp = (tick + idx) % 2 === 0;
    return (
      `<g transform="translate(${Math.round(ob.x)},${Math.round(ob.y)})">` +
      `<path class="ptero-a" fill="#535353" d="${flapUp ? PTERO_UP_PATH : PTERO_DOWN_PATH}"/>` +
      `<path class="ptero-b" fill="#535353" d="${flapUp ? PTERO_DOWN_PATH : PTERO_UP_PATH}"/>` +
      `</g>`
    );
  }

  if (ob.kind === "cactus_large") {
    const srcX = 25 * ob.size * (0.5 * (ob.size - 1));
    return spriteCrop(
      `ob-${idx}`,
      SPRITES.cactusLarge2x,
      150,
      50,
      srcX,
      0,
      25 * ob.size,
      50,
      Math.round(ob.x),
      ob.y
    );
  }

  const srcX = 17 * ob.size * (0.5 * (ob.size - 1));
  return spriteCrop(
    `ob-${idx}`,
    SPRITES.cactusSmall2x,
    102,
    35,
    srcX,
    0,
    17 * ob.size,
    35,
    Math.round(ob.x),
    ob.y
  );
}

function renderDino(state: DinoState): string {
  const y = dinoY(state);

  if (state.status === "crashed") {
    return spriteCrop("trex-dead", SPRITES.trex2x, 264, 47, 220, 0, 44, 47, DINO_X, y);
  }

  if (state.airStep > 0) {
    // standing/jumping pose with subtle rise/hang css motion on frame load
    return (
      `<g class="dino-air">` +
      spriteCrop("trex-jump", SPRITES.trex2x, 264, 47, 0, 0, 44, 47, DINO_X, y) +
      `</g>`
    );
  }

  if (state.ducking) {
    return (
      `<g transform="translate(${DINO_X},${y})">` +
      `<path class="dino-run-a" fill="#535353" d="${DUCK_TREX_A}"/>` +
      `<path class="dino-run-b" fill="#535353" d="${DUCK_TREX_B}"/>` +
      `</g>`
    );
  }

  if (state.status === "waiting") {
    return (
      `<g class="dino-idle-a">` +
      spriteCrop("trex-wait-a", SPRITES.trex2x, 264, 47, 0, 0, 44, 47, DINO_X, y) +
      `</g>` +
      `<g class="dino-idle-b">` +
      spriteCrop("trex-wait-b", SPRITES.trex2x, 264, 47, 44, 0, 44, 47, DINO_X, y) +
      `</g>`
    );
  }

  // running: alternate the two authentic chromium run-cycle frames via css steps
  return (
    `<g class="dino-run-a">` +
    spriteCrop("trex-run-a", SPRITES.trex2x, 264, 47, 88, 0, 44, 47, DINO_X, y) +
    `</g>` +
    `<g class="dino-run-b">` +
    spriteCrop("trex-run-b", SPRITES.trex2x, 264, 47, 132, 0, 44, 47, DINO_X, y) +
    `</g>`
  );
}

export function renderDinoSvg(state: DinoState, theme: "light" | "dark" = "light"): string {
  const isDark = theme === "dark";
  const bg = isDark ? "#0d1117" : "#f7f7f7";
  const border = isDark ? "#30363d" : "#e5e5e5";

  const clouds = state.clouds
    .map(
      (c) =>
        `<image href="${SPRITES.cloud2x}" x="${Math.round(c.x)}" y="${Math.round(c.y)}" width="46" height="14" opacity="0.85" style="image-rendering:pixelated"/>`
    )
    .join("");

  const horizon =
    `<g clip-path="url(#stage-clip)">` +
    `<image href="${SPRITES.horizon2x}" x="${-state.horizonOffset}" y="127" width="1200" height="12" style="image-rendering:pixelated"/>` +
    `<image href="${SPRITES.horizon2x}" x="${1200 - state.horizonOffset}" y="127" width="1200" height="12" style="image-rendering:pixelated"/>` +
    `</g>`;

  const obstacles = state.obstacles.map((ob, i) => renderObstacle(ob, i, state.tick)).join("");
  const dino = renderDino(state);
  const scores = renderScoreDigits(state.score, state.highScore);

const CLICK_TO_START_PATH =
  "M218,56h8v2h-8zM216,58h2v2h-2zM216,60h2v2h-2zM216,62h2v2h-2zM216,64h2v2h-2zM216,66h2v2h-2zM218,68h8v2h-8zM229,56h2v2h-2zM229,58h2v2h-2zM229,60h2v2h-2zM229,62h2v2h-2zM229,64h2v2h-2zM229,66h2v2h-2zM229,68h10v2h-10zM242,56h10v2h-10zM246,58h2v2h-2zM246,60h2v2h-2zM246,62h2v2h-2zM246,64h2v2h-2zM246,66h2v2h-2zM242,68h10v2h-10zM257,56h8v2h-8zM255,58h2v2h-2zM255,60h2v2h-2zM255,62h2v2h-2zM255,64h2v2h-2zM255,66h2v2h-2zM257,68h8v2h-8zM268,56h2v2h-2zM276,56h2v2h-2zM268,58h2v2h-2zM274,58h2v2h-2zM268,60h2v2h-2zM272,60h2v2h-2zM268,62h4v2h-4zM268,64h2v2h-2zM272,64h2v2h-2zM268,66h2v2h-2zM274,66h2v2h-2zM268,68h2v2h-2zM276,68h2v2h-2zM289,56h10v2h-10zM293,58h2v2h-2zM293,60h2v2h-2zM293,62h2v2h-2zM293,64h2v2h-2zM293,66h2v2h-2zM293,68h2v2h-2zM304,56h6v2h-6zM302,58h2v2h-2zM310,58h2v2h-2zM302,60h2v2h-2zM310,60h2v2h-2zM302,62h2v2h-2zM310,62h2v2h-2zM302,64h2v2h-2zM310,64h2v2h-2zM302,66h2v2h-2zM310,66h2v2h-2zM304,68h6v2h-6zM325,56h8v2h-8zM323,58h2v2h-2zM323,60h2v2h-2zM325,62h6v2h-6zM331,64h2v2h-2zM331,66h2v2h-2zM323,68h8v2h-8zM336,56h10v2h-10zM340,58h2v2h-2zM340,60h2v2h-2zM340,62h2v2h-2zM340,64h2v2h-2zM340,66h2v2h-2zM340,68h2v2h-2zM351,56h6v2h-6zM349,58h2v2h-2zM357,58h2v2h-2zM349,60h2v2h-2zM357,60h2v2h-2zM349,62h10v2h-10zM349,64h2v2h-2zM357,64h2v2h-2zM349,66h2v2h-2zM357,66h2v2h-2zM349,68h2v2h-2zM357,68h2v2h-2zM362,56h8v2h-8zM362,58h2v2h-2zM370,58h2v2h-2zM362,60h2v2h-2zM370,60h2v2h-2zM362,62h8v2h-8zM362,64h2v2h-2zM366,64h2v2h-2zM362,66h2v2h-2zM368,66h2v2h-2zM362,68h2v2h-2zM370,68h2v2h-2zM375,56h10v2h-10zM379,58h2v2h-2zM379,60h2v2h-2zM379,62h2v2h-2zM379,64h2v2h-2zM379,66h2v2h-2zM379,68h2v2h-2z";

  const startPrompt =
    state.status === "waiting"
      ? `<path fill="#535353" d="${CLICK_TO_START_PATH}"/>`
      : "";

  const gameOver =
    state.status === "crashed"
      ? spriteCrop("go-txt", SPRITES.text2x, 191, 24, 0, 13, 191, 11, Math.round((GAME_WIDTH - 191) / 2), 42) +
        `<image href="${SPRITES.restart2x}" x="${Math.round((GAME_WIDTH - 36) / 2)}" y="68" width="36" height="32" style="image-rendering:pixelated"/>`
      : "";

  const layerFilter = isDark ? ` filter="url(#chrome-night)"` : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${GAME_WIDTH}" height="${GAME_HEIGHT}" viewBox="0 0 ${GAME_WIDTH} ${GAME_HEIGHT}" shape-rendering="crispEdges" role="img" aria-label="chrome t-rex dino game score ${state.score}">
  <defs>
    <clipPath id="stage-clip"><rect x="0" y="0" width="${GAME_WIDTH}" height="${GAME_HEIGHT}" rx="8"/></clipPath>
    <filter id="chrome-night" color-interpolation-filters="sRGB">
      <feColorMatrix type="matrix" values="-1 0 0 0 1  0 -1 0 0 1  0 0 -1 0 1  0 0 0 1 0"/>
    </filter>
  </defs>
  <style>
    @keyframes runA { 0%, 49.9% { opacity: 1; } 50%, 100% { opacity: 0; } }
    @keyframes runB { 0%, 49.9% { opacity: 0; } 50%, 100% { opacity: 1; } }
    @keyframes blinkA { 0%, 92%, 100% { opacity: 1; } 93%, 99% { opacity: 0; } }
    @keyframes blinkB { 0%, 92%, 100% { opacity: 0; } 93%, 99% { opacity: 1; } }
    @keyframes airBob { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-2px); } }
    .dino-run-a { animation: runA 0.28s steps(1) infinite; }
    .dino-run-b { animation: runB 0.28s steps(1) infinite; }
    .dino-idle-a { animation: blinkA 3.8s steps(1) infinite; }
    .dino-idle-b { animation: blinkB 3.8s steps(1) infinite; }
    .dino-air { animation: airBob 0.55s ease-in-out infinite; }
    .ptero-a { animation: runA 0.36s steps(1) infinite; }
    .ptero-b { animation: runB 0.36s steps(1) infinite; }
  </style>
  <rect x="0.5" y="0.5" width="${GAME_WIDTH - 1}" height="${GAME_HEIGHT - 1}" rx="8" fill="${bg}" stroke="${border}"/>
  <g clip-path="url(#stage-clip)"${layerFilter}>
    ${clouds}
    ${horizon}
    ${obstacles}
    ${dino}
    ${scores}
    ${startPrompt}
    ${gameOver}
  </g>
</svg>`;
}

// exact pixel-for-pixel chromium 1x-restart silhouette
const CHROME_RESTART_PATH =
  "M3,1h30v1h-30zM2,2h32v1h-32zM1,3h34v1h-34zM1,4h34v1h-34zM1,5h34v1h-34zM1,6h14v1h-14zM16,6h19v1h-19zM1,7h14v1h-14zM17,7h18v1h-18zM1,8h14v1h-14zM18,8h17v1h-17zM1,9h9v1h-9zM19,9h4v1h-4zM26,9h9v1h-9zM1,10h8v1h-8zM20,10h3v1h-3zM27,10h8v1h-8zM1,11h7v1h-7zM19,11h4v1h-4zM28,11h7v1h-7zM1,12h7v1h-7zM11,12h4v1h-4zM18,12h7v1h-7zM28,12h7v1h-7zM1,13h7v1h-7zM11,13h4v1h-4zM17,13h8v1h-8zM28,13h7v1h-7zM1,14h7v1h-7zM11,14h4v1h-4zM16,14h9v1h-9zM28,14h7v1h-7zM1,15h7v1h-7zM11,15h14v1h-14zM28,15h7v1h-7zM1,16h7v1h-7zM11,16h14v1h-14zM28,16h7v1h-7zM1,17h7v1h-7zM11,17h14v1h-14zM28,17h7v1h-7zM1,18h7v1h-7zM11,18h14v1h-14zM28,18h7v1h-7zM1,19h7v1h-7zM11,19h14v1h-14zM28,19h7v1h-7zM1,20h7v1h-7zM28,20h7v1h-7zM1,21h8v1h-8zM27,21h8v1h-8zM1,22h9v1h-9zM26,22h9v1h-9zM1,23h34v1h-34zM1,24h34v1h-34zM1,25h34v1h-34zM1,26h34v1h-34zM1,27h34v1h-34zM1,28h34v1h-34zM2,29h32v1h-32zM3,30h30v1h-30z";

const CHROME_LEFT_PATH =
  "M3,1 H33 V2 H34 V3 H35 V29 H34 V30 H33 V31 H3 V30 H2 V29 H1 V3 H2 V2 H3 Z M27,14 H17 V9 H15 V10 H14 V11 H13 V12 H12 V13 H11 V14 H10 V15 H9 V17 H10 V18 H11 V19 H12 V20 H13 V21 H14 V22 H15 V23 H17 V18 H27 Z";

export function renderRestartButtonSvg(enabled: boolean, theme: "light" | "dark" = "light"): string {
  const fill = theme === "dark" ? "#c9d1d9" : "#535353";
  const opacity = enabled ? "1" : "0.26";
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="54" height="48" viewBox="0 0 36 32" shape-rendering="crispEdges" role="img" aria-label="${enabled ? "restart" : "restart (only available when crashed)"}">
  <path fill="${fill}" opacity="${opacity}" d="${CHROME_RESTART_PATH}"/>
</svg>`;
}

export function renderLeftButtonSvg(theme: "light" | "dark" = "light"): string {
  const fill = theme === "dark" ? "#c9d1d9" : "#535353";
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="54" height="48" viewBox="0 0 36 32" shape-rendering="crispEdges" role="img" aria-label="left (disabled)">
  <path fill="${fill}" fill-rule="evenodd" opacity="0.28" d="${CHROME_LEFT_PATH}"/>
</svg>`;
}
