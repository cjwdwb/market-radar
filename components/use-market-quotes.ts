"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { Quote, QuoteResult } from "../lib/market";
import { browserMarketCooldown, ClientCooldown, ClientMarketError, ClientRequestPool, clientFailure, completeQuoteResults, isClientCancelled } from "../lib/market-client";
import { retryDelay, reusePoints } from "../lib/refresh-policy";

export type MarketQuotesOptions = { requestKey: string; symbolKey: string; hydrated: boolean; visible: boolean; online: boolean; auto: boolean; backgroundTabs: boolean };
type QuoteSnapshot = { quotes: Record<string, Quote>; errors: Record<string, string>; loading: boolean; lastFetched?: number };
type Job = { generation: number; controller: AbortController; promise: Promise<void> };

/** Each asset keeps its own failure/backoff, even inside a partially successful
 * response. Source timestamps, never the aggregate response time, own freshness. */
export class MarketQuotesController {
  private state: QuoteSnapshot = { quotes: {}, errors: {}, loading: true };
  private listeners = new Set<() => void>();
  private options?: MarketQuotesOptions;
  private generation = 0;
  private jobs = new Map<string, Job>();
  private retries = new Map<string, { failures: number; after: number }>();
  private pool = new ClientRequestPool();
  private foreground = new Set<object>();
  private cryptoTimer?: ReturnType<typeof setInterval>;
  private stockTimer?: ReturnType<typeof setInterval>;
  readonly cooldown: ClientCooldown;
  constructor(cooldown: ClientCooldown = browserMarketCooldown) { this.cooldown = cooldown; }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.state;
  private emit(change: Partial<QuoteSnapshot>) { this.state = { ...this.state, ...change }; for (const listener of this.listeners) listener(); }
  private clearTimers() { clearInterval(this.cryptoTimer); clearInterval(this.stockTimer); }
  private cancel() {
    this.generation++;
    for (const job of this.jobs.values()) job.controller.abort("superseded");
    this.jobs.clear(); this.foreground.clear(); this.pool.clear();
  }
  dispose = () => { this.clearTimers(); this.cancel(); this.options = undefined; };

  update(options: MarketQuotesOptions) {
    const previous = this.options;
    const explicit = !previous || (!previous.hydrated && options.hydrated) || previous.requestKey !== options.requestKey;
    const resumed = !!previous && options.auto && ((!previous.visible && options.visible) || (!previous.online && options.online) || !previous.auto || (!previous.backgroundTabs && options.backgroundTabs));
    const canRead = options.hydrated && options.online && (options.visible || (options.auto && options.backgroundTabs));
    this.clearTimers();
    if (explicit || !canRead) this.cancel();
    this.options = options;
    const visibleSymbols = new Set(options.symbolKey.split(","));
    const requested = new Set(options.requestKey.split(","));
    const quotes = Object.fromEntries(Object.entries(this.state.quotes).filter(([symbol]) => requested.has(symbol)));
    const errors = Object.fromEntries(Object.entries(quotes).flatMap(([symbol, quote]) => visibleSymbols.has(symbol) && quote.error ? [[symbol, quote.error]] : []));
    // Include failures without an earlier quote, not just errors attached to data.
    for (const [symbol, error] of Object.entries(this.state.errors)) if (visibleSymbols.has(symbol)) errors[symbol] = error;
    for (const symbol of this.retries.keys()) if (!requested.has(symbol)) this.retries.delete(symbol);
    this.emit({ quotes, errors, ...(!canRead || explicit ? { loading: false } : {}) });
    if (!canRead) return;
    if (explicit || resumed) void this.read(false);
    if (options.auto) {
      this.cryptoTimer = setInterval(() => { void this.read(true, "crypto"); }, options.visible ? 5000 : 60_000);
      this.stockTimer = setInterval(() => { void this.read(true, "stocks"); }, options.visible ? 15_000 : 60_000);
    }
  }

  private failure(symbol: string, failure: ClientMarketError) {
    const previous = this.retries.get(symbol), failures = (previous?.failures ?? 0) + 1;
    this.retries.set(symbol, { failures, after: Math.max(Date.now() + retryDelay(failures, symbol.endsWith("-USDT") ? 5000 : 15_000), failure.info.retryAt ?? 0) });
    this.cooldown.observe(symbol, failure);
  }
  private apply(results: QuoteResult[]) {
    const quotes = { ...this.state.quotes }, errors = { ...this.state.errors };
    const visibleSymbols = new Set(this.options?.symbolKey.split(",") ?? []);
    for (const result of results) {
      if (result.quote) {
        quotes[result.symbol] = { ...result.quote, error: undefined, errorInfo: undefined, points: reusePoints(quotes[result.symbol]?.points, result.quote.points) };
        delete errors[result.symbol]; this.retries.delete(result.symbol);
      } else {
        const failure = new ClientMarketError(result.error ?? "该标的未返回有效报价", result.errorInfo ?? { code: "invalid_data", stage: "admission" });
        this.failure(result.symbol, failure);
        if (visibleSymbols.has(result.symbol)) errors[result.symbol] = failure.message;
        if (quotes[result.symbol]) quotes[result.symbol] = { ...quotes[result.symbol], error: failure.message, errorInfo: failure.info };
      }
    }
    const symbols = this.options?.requestKey.split(",").filter(Boolean) ?? [];
    const allHealthy = symbols.length > 0 && symbols.every(symbol => quotes[symbol] && !quotes[symbol].error && !errors[symbol]);
    this.emit({ quotes, errors, ...(allHealthy ? { lastFetched: Math.min(...symbols.map(symbol => quotes[symbol].fetchedAt)) } : {}) });
  }

  private group(symbols: string[]): Promise<void> {
    const key = [...symbols].sort().join(","), generation = this.generation;
    const pending = this.jobs.get(key);
    if (pending?.generation === generation) return pending.promise;
    const controller = new AbortController(), job: Job = { generation, controller, promise: Promise.resolve() };
    job.promise = (async () => {
      try {
        const results = await this.pool.request(`quotes:${key}`, async signal => {
          const body = await this.cooldown.readJson<{ results?: unknown }>(symbols[0], "/api/quotes?symbols=" + encodeURIComponent(key), signal, 18_000);
          return completeQuoteResults(symbols, body?.results);
        }, controller.signal);
        if (generation !== this.generation || controller.signal.aborted || this.jobs.get(key) !== job) return;
        this.apply(results);
      } catch (error) {
        if (generation !== this.generation || controller.signal.aborted || isClientCancelled(error) || this.jobs.get(key) !== job) return;
        const failure = clientFailure(error);
        // A local cooldown rejection must not extend the server's deadline.
        if (failure.info.code === "rate_limited" && failure.info.stage === "browser") {
          const quotes = { ...this.state.quotes }, errors = { ...this.state.errors };
          for (const symbol of symbols) {
            if (this.options?.symbolKey.split(",").includes(symbol)) errors[symbol] = failure.message;
            if (quotes[symbol]) quotes[symbol] = { ...quotes[symbol], error: failure.message, errorInfo: failure.info };
          }
          this.emit({ quotes, errors });
        } else this.apply(symbols.map(symbol => ({ symbol, error: failure.message, errorInfo: failure.info })));
      } finally { if (generation === this.generation && this.jobs.get(key) === job) this.jobs.delete(key); }
    })();
    this.jobs.set(key, job); return job.promise;
  }

  private read(background: boolean, provider?: "crypto" | "stocks"): Promise<void> {
    const options = this.options;
    if (!options?.hydrated || !options.online) return Promise.resolve();
    const generation = this.generation, ticket = {};
    const symbols = [...new Set(options.requestKey.split(",").filter(Boolean))];
    const crypto = symbols.filter(symbol => symbol.endsWith("-USDT")), stocks = symbols.filter(symbol => !symbol.endsWith("-USDT"));
    const groups: string[][] = [];
    const joined = new Set<Promise<void>>();
    // One stock group keeps the server's four-worker / sixteen-second operation
    // budget intact; parallel groups of four would multiply that concurrency.
    for (const [assets, size, kind] of [[crypto, 20, "crypto"], [stocks, 28, "stocks"]] as const) {
      if (provider && provider !== kind) continue;
      const due = assets.filter(symbol => {
        for (const [key, job] of this.jobs) if (job.generation === generation && key.split(",").includes(symbol)) { joined.add(job.promise); return false; }
        return !background || (this.retries.get(symbol)?.after ?? 0) <= Date.now();
      });
      for (let i = 0; i < due.length; i += size) groups.push(due.slice(i, i + size));
    }
    if (!background) { this.foreground.add(ticket); this.emit({ loading: true }); }
    return Promise.all([...joined, ...groups.map(group => this.group(group))]).then(() => {}).finally(() => {
      if (generation !== this.generation) return;
      this.foreground.delete(ticket);
      if (!background) this.emit({ loading: this.foreground.size > 0 });
    });
  }

  refresh = () => this.read(false);
  acceptQuote = (quote: Quote) => { if (completeQuoteResults([quote.symbol], [{ symbol: quote.symbol, quote }])[0].quote) this.apply([{ symbol: quote.symbol, quote }]); };
}

export function useMarketQuotes(options: MarketQuotesOptions) {
  const [controller] = useState(() => new MarketQuotesController());
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const { requestKey, symbolKey, hydrated, visible, online, auto, backgroundTabs } = options;
  useEffect(() => { controller.update({ requestKey, symbolKey, hydrated, visible, online, auto, backgroundTabs }); }, [controller, requestKey, symbolKey, hydrated, visible, online, auto, backgroundTabs]);
  useEffect(() => () => controller.dispose(), [controller]);
  return { ...snapshot, refresh: controller.refresh, acceptQuote: controller.acceptQuote };
}
