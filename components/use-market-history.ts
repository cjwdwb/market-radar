"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { MarketErrorInfo, MarketHistory, Range } from "../lib/market";
import type { RadarHistory } from "../lib/radar/types";
import { browserMarketCooldown, ClientCooldown, ClientHistoryCache, clientFailure, clientHistoryKey, isClientCancelled } from "../lib/market-client";
import { reusePoints } from "../lib/refresh-policy";

export type MarketHistoryOptions = { selected: string; range: Range; requestKey: string; hydrated: boolean; visible: boolean; online: boolean; auto: boolean };
type Trend = RadarHistory & { error?: string; errorInfo?: MarketErrorInfo };
type HistoryView = MarketHistory & { key: string };
type HistorySnapshot = { selectionKey: string; history: HistoryView | null; trends: Record<string, Trend>; historyLoading: boolean; historyError: string; trendErrors: Record<string, string> };
type Job = { generation: number; controller: AbortController; promise: Promise<void> };
const viewKey = (options: MarketHistoryOptions) => `${options.selected}:${options.range}`;
const hasPrimary = (options: MarketHistoryOptions) => !(options.range === "1d" && !options.selected.endsWith("-USDT"));

/** Owns the existing selected/overview schedules. It has no implicit resume while
 * auto is off; selection and manual refresh remain explicit reads. */
export class MarketHistoryController {
  private state: HistorySnapshot = { selectionKey: "", history: null, trends: {}, historyLoading: false, historyError: "", trendErrors: {} };
  private listeners = new Set<() => void>();
  private options?: MarketHistoryOptions;
  private generation = 0;
  private jobs = new Map<string, Job>();
  private failures = new Map<string, string>();
  private first?: ReturnType<typeof setTimeout>;
  private primaryTimer?: ReturnType<typeof setInterval>;
  private overviewTimer?: ReturnType<typeof setInterval>;
  private overviewJob?: { generation: number; promise: Promise<void> };
  readonly cache: ClientHistoryCache;
  constructor(cooldown: ClientCooldown = browserMarketCooldown) { this.cache = new ClientHistoryCache(cooldown); }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.state;
  private emit(change: Partial<HistorySnapshot>) { this.state = { ...this.state, ...change }; for (const listener of this.listeners) listener(); }
  private clearTimers() { clearTimeout(this.first); clearInterval(this.primaryTimer); clearInterval(this.overviewTimer); }
  private cancel() {
    this.generation++;
    for (const job of this.jobs.values()) job.controller.abort("superseded");
    this.jobs.clear(); this.overviewJob = undefined;
    this.cache.pool.clear();
  }
  dispose = () => { this.clearTimers(); this.cancel(); this.options = undefined; };

  update(options: MarketHistoryOptions) {
    const previous = this.options;
    const explicit = !previous || (!previous.hydrated && options.hydrated) || previous.selected !== options.selected || previous.range !== options.range || previous.requestKey !== options.requestKey;
    const resumed = !!previous && options.auto && ((!previous.visible && options.visible) || (!previous.online && options.online) || !previous.auto);
    this.clearTimers();
    if (explicit || !options.online || !options.visible || !options.hydrated) this.cancel();
    this.options = options;
    if (explicit) {
      const wanted = new Set([options.selected, ...options.requestKey.split(",")]);
      this.emit({ trends: Object.fromEntries(Object.entries(this.state.trends).filter(([symbol]) => wanted.has(symbol))),
        trendErrors: Object.fromEntries(Object.entries(this.state.trendErrors).filter(([symbol]) => wanted.has(symbol))) });
    }
    const key = viewKey(options), cached = hasPrimary(options) ? this.cache.peek(options.selected, options.range) : undefined;
    if (explicit || !options.online || !options.visible || !options.hydrated) this.emit({
      selectionKey: key,
      history: cached ? { ...cached, key } : this.state.history?.key === key ? this.state.history : null,
      historyLoading: false,
      historyError: hasPrimary(options) ? this.failures.get(clientHistoryKey(options.selected, options.range)) ?? "" : ""
    });
    if (!options.hydrated || !options.online || !options.visible) return;
    if (explicit || resumed) {
      // Start the selected chart synchronously before the deferred overview workers.
      void this.primary(false);
      this.first = setTimeout(() => { void this.overview(); }, 1500);
    }
    if (options.auto) {
      this.primaryTimer = setInterval(() => { void this.primary(true); }, options.range === "15m" ? 15_000 : 60_000);
      this.overviewTimer = setInterval(() => { void this.overview(true); }, 60_000);
    }
  }

  private markTrend(data: MarketHistory, network: boolean) {
    const previous = this.state.trends[data.symbol];
    if (!network && previous?.error) return;
    let recovered: Partial<HistorySnapshot> = {};
    if (network) {
      // The overview and these two chart views share one verified acquisition.
      // Recovery must also clear a chart failure saved while it was unselected.
      this.failures.delete(clientHistoryKey(data.symbol, "1d"));
      const options = this.options;
      if (options?.selected === data.symbol && (options.range === "15m" || options.range === "1d")) recovered = { history: { ...data, range: options.range, key: viewKey(options) }, historyError: "" };
    }
    const intervalMs = data.metadata?.intervalMs;
    const trend: Trend = { points: reusePoints(previous?.points, data.points), source: data.source, currency: data.currency, fetchedAt: data.fetchedAt,
      intervalMs: typeof intervalMs === "number" && Number.isFinite(intervalMs) && intervalMs > 0 ? intervalMs : 0 };
    const errors = { ...this.state.trendErrors }; delete errors[data.symbol];
    this.emit({ ...recovered, trends: { ...this.state.trends, [data.symbol]: trend }, trendErrors: errors });
  }
  private failTrend(symbol: string, error: unknown) {
    const failure = clientFailure(error), previous = this.state.trends[symbol];
    this.emit({ trendErrors: { ...this.state.trendErrors, [symbol]: failure.message },
      ...(previous ? { trends: { ...this.state.trends, [symbol]: { ...previous, error: failure.message, errorInfo: failure.info } } } : {}) });
  }

  private primary(force: boolean): Promise<void> {
    const options = this.options;
    if (!options?.hydrated || !options.online || !hasPrimary(options)) return Promise.resolve();
    const generation = this.generation, key = viewKey(options), operationKey = `primary:${key}`;
    const pending = this.jobs.get(operationKey);
    if (pending?.generation === generation) return pending.promise;
    const controller = new AbortController(), job: Job = { generation, controller, promise: Promise.resolve() };
    this.emit({ historyLoading: !this.state.history || this.state.history.key !== key });
    job.promise = (async () => {
      try {
        const { data, network } = await this.cache.read(options.selected, options.range, controller.signal, force);
        if (generation !== this.generation || controller.signal.aborted || this.jobs.get(operationKey) !== job) return;
        if (network) this.failures.delete(clientHistoryKey(options.selected, options.range));
        this.emit({ history: { ...data, key }, historyError: this.failures.get(clientHistoryKey(options.selected, options.range)) ?? "" });
        if (options.selected.endsWith("-USDT") && (options.range === "15m" || options.range === "1d")) this.markTrend(data, network);
      } catch (error) {
        if (generation !== this.generation || controller.signal.aborted || isClientCancelled(error) || this.jobs.get(operationKey) !== job) return;
        const message = clientFailure(error).message;
        this.failures.set(clientHistoryKey(options.selected, options.range), message);
        if (this.failures.size > 24) this.failures.delete(this.failures.keys().next().value!);
        this.emit({ historyError: message });
        if (options.selected.endsWith("-USDT") && (options.range === "15m" || options.range === "1d")) this.failTrend(options.selected, error);
      } finally {
        if (generation === this.generation && this.jobs.get(operationKey) === job) { this.jobs.delete(operationKey); this.emit({ historyLoading: false }); }
      }
    })();
    this.jobs.set(operationKey, job); return job.promise;
  }

  private trend(symbol: string, force: boolean): Promise<void> {
    const generation = this.generation, operationKey = `trend:${symbol}`;
    const pending = this.jobs.get(operationKey);
    if (pending?.generation === generation) return pending.promise;
    const controller = new AbortController(), job: Job = { generation, controller, promise: Promise.resolve() };
    job.promise = (async () => {
      try {
        const result = await this.cache.read(symbol, "1d", controller.signal, force);
        if (generation !== this.generation || controller.signal.aborted || this.jobs.get(operationKey) !== job) return;
        this.markTrend(result.data, result.network);
      } catch (error) {
        if (generation === this.generation && !controller.signal.aborted && !isClientCancelled(error) && this.jobs.get(operationKey) === job) this.failTrend(symbol, error);
      } finally { if (generation === this.generation && this.jobs.get(operationKey) === job) this.jobs.delete(operationKey); }
    })();
    this.jobs.set(operationKey, job); return job.promise;
  }

  private overview(force = false): Promise<void> {
    const options = this.options;
    if (!options?.hydrated || !options.visible || !options.online) return Promise.resolve();
    const generation = this.generation;
    if (this.overviewJob?.generation === generation) return this.overviewJob.promise;
    const symbols = [...new Set([options.selected, ...options.requestKey.split(",")].filter(symbol => symbol.endsWith("-USDT")))];
    const batch = { generation, promise: Promise.resolve() }; let cursor = 0;
    batch.promise = (async () => {
      const worker = async () => {
        while (generation === this.generation && cursor < symbols.length) {
          const symbol = symbols[cursor++];
          await this.trend(symbol, force);
        }
      };
      await Promise.all(Array.from({ length: Math.min(3, symbols.length) }, worker));
    })().finally(() => { if (this.overviewJob === batch) this.overviewJob = undefined; });
    this.overviewJob = batch; return batch.promise;
  }

  refresh = async (): Promise<void> => {
    const options = this.options;
    if (!options?.hydrated || !options.online) return;
    const main = this.primary(true);
    const analysis = options.selected.endsWith("-USDT") ? this.trend(options.selected, true) : Promise.resolve();
    await Promise.all([main, analysis]);
  };
}

export function useMarketHistory(options: MarketHistoryOptions) {
  const [controller] = useState(() => new MarketHistoryController());
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const { selected, range, requestKey, hydrated, visible, online, auto } = options;
  useEffect(() => { controller.update({ selected, range, requestKey, hydrated, visible, online, auto }); }, [controller, selected, range, requestKey, hydrated, visible, online, auto]);
  useEffect(() => () => controller.dispose(), [controller]);
  const key = `${selected}:${range}`;
  const { selectionKey, ...view } = snapshot;
  return { ...view, history: snapshot.history?.key === key ? snapshot.history : null, historyError: selectionKey === key ? snapshot.historyError : "", refresh: controller.refresh };
}
