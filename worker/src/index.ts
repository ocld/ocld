import { createInitialState, stepGame, type Action, type DinoState } from "./game";
import { renderDinoSvg, renderLeftButtonSvg, renderRestartButtonSvg } from "./renderSvg";

export interface Env {
  DINO_GAME: DurableObjectNamespace;
  PROFILE_URL?: string;
}

const VALID_ACTIONS = new Set<Action>(["jump", "run", "duck", "left", "reset"]);

// strongly-consistent single-room durable object so github camo never sees stale kv reads after a 302 redirect
export class DinoGameDO implements DurableObject {
  private state: DurableObjectState;
  private cached: DinoState | null = null;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  private async load(): Promise<DinoState> {
    if (this.cached) return this.cached;
    const saved = await this.state.storage.get<DinoState>("dino_state");
    this.cached = saved ?? createInitialState();
    return this.cached;
  }

  private async save(next: DinoState): Promise<void> {
    this.cached = next;
    await this.state.storage.put("dino_state", next);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/step") {
      const rawAction = (url.searchParams.get("a") ?? "run").toLowerCase() as Action;
      const action: Action = VALID_ACTIONS.has(rawAction) ? rawAction : "run";
      const current = await this.load();
      const next = stepGame(current, action);
      await this.save(next);
      return Response.json(next);
    }

    const current = await this.load();
    return Response.json(current);
  }
}

function noCacheHeaders(contentType: string, etag: string): HeadersInit {
  return {
    "Content-Type": contentType,
    "Cache-Control": "max-age=0, no-cache, no-store, must-revalidate, private",
    Pragma: "no-cache",
    Expires: "Thu, 01 Jan 1970 00:00:00 GMT",
    ETag: etag,
    "X-Content-Type-Options": "nosniff",
  };
}

function resolveReturnUrl(request: Request, url: URL, fallbackProfileUrl: string): string {
  const referer = request.headers.get("Referer");
  if (referer) {
    try {
      const refUrl = new URL(referer);
      // stay on whichever github.com/ocld* page (profile or repo) or worker preview page the click came from
      if (refUrl.origin === url.origin) return `${url.origin}/?t=${Date.now()}`;
      if (refUrl.hostname === "github.com" && refUrl.pathname.toLowerCase().startsWith("/ocld")) {
        return `${refUrl.origin}${refUrl.pathname}`;
      }
    } catch {
      // fall through to default profile url
    }
  }
  return fallbackProfileUrl;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const id = env.DINO_GAME.idFromName("global");
    const stub = env.DINO_GAME.get(id);
    const profileUrl = env.PROFILE_URL || "https://github.com/ocld";

    // instant move + 302 boomerang straight back to the page you clicked from
    if (url.pathname === "/move") {
      const action = url.searchParams.get("a") ?? "run";
      await stub.fetch(`https://do/step?a=${encodeURIComponent(action)}`);
      const target = resolveReturnUrl(request, url, profileUrl);
      return new Response(null, {
        status: 302,
        headers: {
          Location: target,
          "Cache-Control": "max-age=0, no-cache, no-store, must-revalidate",
          Expires: "Thu, 01 Jan 1970 00:00:00 GMT",
        },
      });
    }

    // live svg screen for github readme (light & dark themes)
    if (url.pathname === "/screen.svg" || url.pathname === "/screen-dark.svg") {
      const themeParam = url.searchParams.get("theme");
      const theme: "light" | "dark" =
        url.pathname === "/screen-dark.svg" || themeParam === "dark" ? "dark" : "light";
      const res = await stub.fetch("https://do/state");
      const state = (await res.json()) as DinoState;
      const svg = renderDinoSvg(state, theme);
      return new Response(svg, {
        status: 200,
        headers: noCacheHeaders("image/svg+xml; charset=utf-8", `"dino-${state.tick}-${Date.now()}"`),
      });
    }

    // dynamic button svgs reflecting live game state (restart enabled only on crash, left unlocked at 10,000 hi score)
    if (url.pathname === "/btn/restart.svg" || url.pathname === "/btn/restart-dark.svg") {
      const theme: "light" | "dark" = url.pathname.includes("dark") ? "dark" : "light";
      const res = await stub.fetch("https://do/state");
      const state = (await res.json()) as DinoState;
      const svg = renderRestartButtonSvg(state.status === "crashed", theme);
      return new Response(svg, {
        status: 200,
        headers: noCacheHeaders("image/svg+xml; charset=utf-8", `"rst-${state.status}-${state.tick}-${Date.now()}"`),
      });
    }

    if (url.pathname === "/btn/left.svg" || url.pathname === "/btn/left-dark.svg") {
      const theme: "light" | "dark" = url.pathname.includes("dark") ? "dark" : "light";
      const svg = renderLeftButtonSvg(theme);
      return new Response(svg, {
        status: 200,
        headers: noCacheHeaders("image/svg+xml; charset=utf-8", `"lft-disabled-${theme}"`),
      });
    }

    if (url.pathname === "/state.json") {
      const res = await stub.fetch("https://do/state");
      const state = (await res.json()) as DinoState;
      return new Response(JSON.stringify(state), {
        status: 200,
        headers: noCacheHeaders("application/json; charset=utf-8", `"state-${state.tick}"`),
      });
    }

    // live preview page at / so you can also test the worker directly in a browser
    const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ocld dino</title>
<style>
  body{margin:0;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;background:#f7f7f7;color:#535353;font-family:ui-monospace,monospace}
  @media(prefers-color-scheme:dark){body{background:#0d1117;color:#c9d1d9}}
  .btns{display:flex;gap:12px}
  a.btn{display:inline-flex;align-items:center;justify-content:center;padding:8px 14px;border-radius:6px;background:#535353;color:#f7f7f7;text-decoration:none;font-weight:700;font-size:13px}
  @media(prefers-color-scheme:dark){a.btn{background:#c9d1d9;color:#0d1117}}
</style></head>
<body>
  <a href="/move?a=run" title="start / run"><img src="/screen.svg?t=${Date.now()}" width="600" style="max-width:94vw;height:auto;display:block"/></a>
  <div class="btns">
    <a class="btn" href="/move?a=jump">jump</a>
    <a class="btn" href="/move?a=duck">duck</a>
    <a class="btn" href="/move?a=reset">restart</a>
  </div>
</body></html>`;
    return new Response(html, {
      status: 200,
      headers: noCacheHeaders("text/html; charset=utf-8", `"page-${Date.now()}"`),
    });
  },
};
