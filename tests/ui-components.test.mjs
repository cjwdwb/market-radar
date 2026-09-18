import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({
  appType: "custom",
  configFile: false,
  root,
  resolve: { alias: { "@": root } },
  server: { middlewareMode: true },
});

after(async () => {
  await vite.close();
});

async function readCssTree(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const contents = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return readCssTree(entryPath);
      }
      return entry.name.endsWith(".css") ? readFile(entryPath, "utf8") : "";
    }),
  );
  return contents.join("\n");
}

test("Radar asset empty state uses its own coverage while preserving offline and paused states", async () => {
  const { RadarFeed } = await vite.ssrLoadModule("/components/radar/radar-feed.tsx");
  const { buildAssetIntelligenceContext } = await vite.ssrLoadModule("/lib/radar/workflow.ts");
  const props = {
    intelligence: { events: [], summary: { activeEvents: 0 } },
    coverage: [{ symbol: "BTC-USDT", eligible: true, relativeEligible: true, reason: "基线可用" }, { symbol: "NVDA", eligible: false, readiness: "insufficient", reason: "历史基线不足" }],
    watchlist: ["NVDA"], scanning: true, online: true, loading: false,
    priceAlertCounts: new Map(),
  };
  const context = symbol => buildAssetIntelligenceContext({ events: [], coverage: props.coverage, symbol, now: 1, enabled: true, online: true, isWatched: false, enabledAlertCount: 0 });
  const render = extra => renderToStaticMarkup(React.createElement(RadarFeed, { ...props, assetContext: context("NVDA"), ...extra }));
  assert.match(render(), /历史基线不足/);
  assert.doesNotMatch(render(), /当前筛选下，暂无异常事件/);
  assert.match(render({ online: false }), /等待网络恢复/);
  assert.match(render({ scanning: false }), /恢复自动监控后继续扫描/);
  assert.match(render({ assetContext: context("BTC-USDT") }), /暂无活跃事件/);
});

test("Radar primary and cluster evidence preserve tiny absolute prices", async () => {
  const { SignalCard } = await vite.ssrLoadModule("/components/radar/radar-feed.tsx");
  const signal = { id: "tiny", title: "区间突破", metric: "2%", source: "OKX", currency: "USDT", quoteAt: 1, fetchedAt: 1, evidenceAt: 1, detectedAt: 1,
    evidence: { reason: "测试证据", items: [{ label: "区间上沿价格 (USDT)", value: 0.0000001234 }] } };
  const event = { id: "event", symbol: "BTC-USDT", market: "crypto", title: "组合事件", metric: "2%", direction: "up", kind: "cluster", status: "active", severity: "high", detectedAt: 1, updatedAt: 1, context: [], confidence: { level: "high", reasons: [] }, signals: [signal, { ...signal, id: "support" }] };
  const html = renderToStaticMarkup(React.createElement(SignalCard, { event, alertCount: 0 }));
  assert.equal((html.match(/0\.0000001234/g) ?? []).length, 2);
  assert.doesNotMatch(html, /<details[^>]*\sopen/);
});

test("emits the catalog's animation and scrolling utilities", async () => {
  const css = await readCssTree(path.join(root, "dist"));

  assert.match(css, /--tw-enter-opacity/);
  assert.match(css, /scrollbar-width:\s*thin/);
  assert.match(css, /scrollbar-width:\s*none/);
  assert.match(css, /scrollbar-gutter:\s*stable/);
  assert.match(css, /scroll-fade-reveal-b/);
  assert.match(css, /mask-image:/);
  assert.match(css, /tw-shimmer/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
});

test("forwards progress semantics to the primitive", async () => {
  const { Progress } = await vite.ssrLoadModule("/components/ui/progress.tsx");
  const html = renderToStaticMarkup(React.createElement(Progress, { value: 37 }));

  assert.match(html, /aria-valuenow="37"/);
  assert.match(html, /aria-valuetext="37%"/);
  assert.match(html, /data-state="loading"/);
});

test("emits chart themes for the starter's media dark mode", async () => {
  const { ChartStyle } = await vite.ssrLoadModule("/components/ui/chart.tsx");
  const html = renderToStaticMarkup(
    React.createElement(ChartStyle, {
      id: "contract",
      config: {
        latency: { theme: { light: "#ffffff", dark: "#000000" } },
      },
    }),
  );

  assert.match(html, /\[data-chart=contract\]/);
  assert.match(html, /@media \(prefers-color-scheme: dark\)/);
  assert.doesNotMatch(html, /\.dark/);
});

test("renders sidebar skeletons deterministically", async () => {
  const { SidebarMenuSkeleton } = await vite.ssrLoadModule(
    "/components/ui/sidebar.tsx",
  );
  const first = renderToStaticMarkup(React.createElement(SidebarMenuSkeleton));
  const second = renderToStaticMarkup(React.createElement(SidebarMenuSkeleton));

  assert.equal(first, second);
  assert.match(first, /--skeleton-width:70%/);
});
