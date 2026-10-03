"use client";
import { useEffect, useRef, useState } from "react";
import type { ReferenceCatalog, ReferenceQuery } from "@/lib/history/reference";
import { ReferenceHistory } from "./reference-history";

async function read<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal, cache:"no-store" });
  const text = await response.text();
  if (text.length > 32768) throw Error("日频资料超出查询上限。");
  let data; try { data = JSON.parse(text); } catch { throw Error("日频资料暂不可用，实时行情不受影响。"); }
  if (!response.ok) throw Error(typeof data?.error === "string" ? data.error : "日频查询暂不可用。");
  return data as T;
}
/** 构建时批准的公开资料；不需要本机会话key，也不触发供应商采集。 */
export function PublishedReferenceHistory() {
  const [catalog, setCatalog] = useState<ReferenceCatalog | null>(null);
  const [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const generation = useRef(0), controller = useRef<AbortController | null>(null);
  useEffect(() => () => { generation.current++; controller.current?.abort(); }, []);
  async function load() {
    controller.current?.abort(); const id = ++generation.current;
    controller.current = new AbortController(); setBusy(true); setError("");
    try {
      const data = await read<ReferenceCatalog>("/api/reference-history", controller.current.signal);
      if (id !== generation.current) return;
      if (data.format !== "reference-catalog-v1" || data.identity !== "reconstructed" ||
          !["CM-API-SEP2026-002","CM-LONG-20261003-001"].includes(data.batch) || !Array.isArray(data.series) || data.series.length !== 2) {
        throw Error("已发布日频目录无效。");
      }
      setCatalog(data);
    } catch (e) { if (id === generation.current) setError(e instanceof Error ? e.message : "日频资料暂不可用。"); }
    finally { if (id === generation.current) setBusy(false); }
  }
  function query(body: { asset: string; from: number; cutoff: number; version: string }, signal: AbortSignal) {
    const params = new URLSearchParams(Object.entries(body).map(([key,value]) => [key,String(value)]));
    return read<ReferenceQuery>("/api/reference-history?" + params, signal);
  }
  return <section className="published-reference" aria-label="网站日频资料">
    <p>网站日频资料 · BTC / ETH · 2021-10-01 至 2026-10-02。固定历史快照，不代表实时价格。</p>
    <button className="btn" style={{minHeight:44}} disabled={busy} onClick={() => void load()}>
      {busy ? "正在加载日频资料…" : catalog ? "重新加载日频资料" : "加载已发布日频资料"}
    </button>
    {error && <p role="alert" className="error-text">{error} 实时行情仍可使用。{catalog && "下方保留上次加载的固定版本。"}</p>}
    {catalog && <ReferenceHistory key={JSON.stringify(catalog)} catalog={catalog} query={query}/>}
  </section>;
}
