/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { accessDecision, privateResponse, type AccessSecrets } from "./access-gate";
import { handleInterpretation } from "./ai-interpretation";
import { handleSiteInterpretation, type SiteAIEnvironment } from "./ai-site-interpretation";
import { handleSiteControl } from "./ai-site-control";

interface Env extends AccessSecrets, SiteAIEnvironment {
  AI_FIXTURE_ENABLED?: string;
  ASSETS: Fetcher;
  DB: D1Database;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    // Only brand assets are public, including versioned phone and home-screen icons.
    if (["GET", "HEAD"].includes(request.method) && ["/brand.svg", "/favicon.svg", "/brand-light-v2.png", "/favicon-v2.png", "/apple-touch-icon-v2.png"].includes(url.pathname)) {
      return env.ASSETS.fetch(request);
    }
    const access = await accessDecision(request, env);
    if (typeof access !== "string") return access;
    if (url.pathname === "/api/interpretation/control") return privateResponse(await handleSiteControl(request, env));
    if (url.pathname === "/api/interpretation" || url.pathname === "/api/interpretation/result") {
      const localFixture = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) && env.AI_FIXTURE_ENABLED === "1";
      if (localFixture && url.pathname === "/api/interpretation") return privateResponse(await handleInterpretation(request, env));
      // A reading session may discover the old, unconfigured capability. Never consult its
      // platform account, grants, D1 or provider; result/control and writes already fail the gate.
      if (access === "visitor") return privateResponse(await handleInterpretation(request, {}));
      return privateResponse(await handleSiteInterpretation(request, env, ctx));
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    if (["GET", "HEAD"].includes(request.method) && !url.pathname.startsWith("/api/") && request.headers.get("rsc") !== "1") {
      const asset = await env.ASSETS.fetch(request);
      if (asset.status !== 404) return privateResponse(asset);
    }
    return privateResponse(await handler.fetch(request, env, ctx));
  },
};

export default worker;
