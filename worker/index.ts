/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  CASE_REGISTRY_URL?: string;
  CASE_REGISTRY_CATALOG_TOKEN?: string;
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

    if (url.pathname === "/api/catalog") {
      if (request.method !== "GET") return new Response("Method not allowed", { status: 405 });
      if (!env.CASE_REGISTRY_URL || !env.CASE_REGISTRY_CATALOG_TOKEN) {
        return Response.json({ error: "case_catalog_not_configured" }, { status: 503, headers: { "cache-control": "no-store" } });
      }
      try {
        const upstream = await fetch(`${env.CASE_REGISTRY_URL.replace(/\/$/, "")}/v1/catalog`, {
          headers: { authorization: `Bearer ${env.CASE_REGISTRY_CATALOG_TOKEN}`, accept: "application/json" },
        });
        return new Response(upstream.body, {
          status: upstream.status,
          headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" },
        });
      } catch {
        return Response.json({ error: "case_catalog_unavailable" }, { status: 502, headers: { "cache-control": "no-store" } });
      }
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

    return handler.fetch(request, env, ctx);
  },
};

export default worker;
