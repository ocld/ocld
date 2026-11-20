export type Action = "jump" | "run" | "duck" | "left" | "reset";

export type ObstacleKind = "cactus_small" | "cactus_large" | "ptero";

export interface Obstacle {
  id: number;
  kind: ObstacleKind;
  size: 1 | 2 | 3;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Cloud {
  x: number;
  y: number;
}

export interface DinoState {
  status: "waiting" | "running" | "crashed";
  tick: number;
  score: number;
  highScore: number;
  totalMoves: number;
  airStep: number; // 0 = ground, 1 = rising, 2 = peak, 3 = landing
  ducking: boolean;
  lastAction: Action;
  horizonOffset: number;
  nextObstacleId: number;
  obstacles: Obstacle[];
  clouds: Cloud[];
}

export const GAME_WIDTH = 600;
export const GAME_HEIGHT = 150;
export const DINO_X = 50;
export const DINO_GROUND_Y = 93;
export const DINO_DUCK_Y = 112;

// 3-step jump arc tuned for discrete click-per-step gameplay so jumps clear 1-3 cactus clusters cleanly
const JUMP_Y_BY_STEP = [DINO_GROUND_Y, 40, 24, 50];

export function dinoY(state: DinoState): number {
  if (state.airStep > 0) return JUMP_Y_BY_STEP[state.airStep] ?? DINO_GROUND_Y;
  return state.ducking ? DINO_DUCK_Y : DINO_GROUND_Y;
}

export function createInitialState(highScore = 0, totalMoves = 0): DinoState {
  return {
    status: "waiting",
    tick: 0,
    score: 0,
    highScore,
    totalMoves,
    airStep: 0,
    ducking: false,
    lastAction: "reset",
    horizonOffset: 0,
    nextObstacleId: 2,
    obstacles: [
      {
        id: 1,
        kind: "cactus_small",
        size: 1,
        x: 410,
        y: 105,
        width: 17,
        height: 35,
      },
    ],
    clouds: [
      { x: 180, y: 34 },
      { x: 430, y: 52 },
    ],
  };
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function spawnObstacle(state: DinoState, startX: number): Obstacle {
  const id = state.nextObstacleId++;
  const allowPtero = state.score >= 100;
  const allowLarge = state.score >= 30;
  const roll = Math.random();

  if (allowPtero && roll < 0.25) {
    // mid ptero (y=70, visual bottom 107, hitbox 76..103) hits standing dino (98..136) and leaves 8px air gap over ducking dino (115..140)
    // high ptero (y=42) punishes blind jumps while standing/ducking pass safely underneath
    const high = Math.random() < 0.3;
    return {
      id,
      kind: "ptero",
      size: 1,
      x: startX,
      y: high ? 42 : 70,
      width: 46,
      height: 38,
    };
  }

  if (allowLarge && roll < 0.62) {
    const size = (state.score >= 120 ? randInt(1, 2) : 1) as 1 | 2;
    return {
      id,
      kind: "cactus_large",
      size,
      x: startX,
      y: 90,
      width: 25 * size,
      height: 50,
    };
  }

  const size = (state.score >= 60 ? randInt(1, 3) : randInt(1, 2)) as 1 | 2 | 3;
  return {
    id,
    kind: "cactus_small",
    size,
    x: startX,
    y: 105,
    width: 17 * size,
    height: 35,
  };
}

export function checkCollision(state: DinoState): boolean {
  // forgiving inner hitboxes: ducking dino (y=116..138) has a clear 14px margin under mid pterodactyls (y=78..102)
  const isDuck = state.airStep === 0 && state.ducking;
  const dy = dinoY(state);
  const dx1 = DINO_X + 8;
  const dx2 = DINO_X + (isDuck ? 48 : 34);
  const dy1 = dy + (isDuck ? 4 : 5);
  const dy2 = dy + (isDuck ? 26 : 43);

  for (const ob of state.obstacles) {
    const padX = ob.kind === "ptero" ? 6 : 4;
    const padY = ob.kind === "ptero" ? 6 : 5;
    const ox1 = ob.x + padX;
    const ox2 = ob.x + ob.width - padX;
    const oy1 = ob.y + padY;
    const oy2 = ob.y + ob.height - (ob.kind === "ptero" ? 5 : 5);

    if (dx1 < ox2 && dx2 > ox1 && dy1 < oy2 && dy2 > oy1) {
      return true;
    }
  }
  return false;
}

export function stepGame(prev: DinoState, action: Action): DinoState {
  // restart is strictly locked until you die so nobody can reset a live run
  if (action === "reset") {
    if (prev.status !== "crashed") return prev;
    return createInitialState(prev.highScore, prev.totalMoves);
  }

  // once crashed, wait for restart button
  if (prev.status === "crashed") {
    return prev;
  }

  // left arrow is permanently disabled (kept in the layout for symmetry)
  if (action === "left") {
    return prev;
  }

  const state: DinoState = {
    ...prev,
    obstacles: prev.obstacles.map((o) => ({ ...o })),
    clouds: prev.clouds.map((c) => ({ ...c })),
  };

  if (state.status === "waiting") {
    state.status = "running";
  }

  state.tick += 1;
  state.totalMoves += 1;
  state.lastAction = action;

  // update dino vertical / duck state
  if (action === "jump") {
    state.ducking = false;
    if (state.airStep === 0) {
      state.airStep = 1;
    } else {
      state.airStep = state.airStep < 3 ? state.airStep + 1 : 0;
    }
  } else if (action === "duck") {
    // fast-drop straight to ground crouch if mid-air (like Chrome's setSpeedDrop)
    state.airStep = 0;
    state.ducking = true;
  } else {
    // "run": advance airborne arc naturally or keep running on the ground
    state.ducking = false;
    if (state.airStep > 0) {
      state.airStep = state.airStep < 3 ? state.airStep + 1 : 0;
    }
  }

  // scroll horizon, clouds & obstacles
  const stepDx = Math.min(70, 48 + Math.floor(state.score / 120) * 4);
  state.horizonOffset = (state.horizonOffset + stepDx) % 600;

  for (const c of state.clouds) {
    c.x -= 12;
  }
  state.clouds = state.clouds.filter((c) => c.x > -52);
  if (state.clouds.length < 3 && Math.random() < 0.45) {
    const lastX = state.clouds.reduce((m, c) => Math.max(m, c.x), 0);
    if (GAME_WIDTH - lastX > 160) {
      state.clouds.push({ x: GAME_WIDTH + randInt(10, 60), y: randInt(24, 68) });
    }
  }

  for (const ob of state.obstacles) {
    ob.x -= stepDx;
  }
  state.obstacles = state.obstacles.filter((ob) => ob.x + ob.width > -10);

  // spawn next obstacle with guaranteed fair landing gap
  const rightMost = state.obstacles.reduce((m, o) => Math.max(m, o.x + o.width), 0);
  const minGap = Math.max(200, 235 - Math.floor(state.score / 150) * 8);
  if (state.obstacles.length === 0 || GAME_WIDTH - rightMost >= minGap) {
    const spawnX = Math.max(GAME_WIDTH + 10, rightMost + randInt(minGap, minGap + 120));
    state.obstacles.push(spawnObstacle(state, spawnX));
  }

  // check collision after movement
  if (checkCollision(state)) {
    state.status = "crashed";
    if (state.score > state.highScore) state.highScore = state.score;
  } else {
    state.score += 10;
    if (state.score > state.highScore) state.highScore = state.score;
  }

  return state;
}
