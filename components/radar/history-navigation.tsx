export type HistoryNavigationProps = {
  value: string;
  minimum: number;
  maximum: number;
  busy: boolean;
  previous: number | null;
  next: number | null;
  suggested: number | null;
  requestedAt: number | null;
  displayedAt: number | null;
  onChange: (value: string) => void;
  onQuery: () => void;
  onChoose: (at: number) => void;
};

const iso = (at: number) => new Date(at).toISOString();
const minute = (at: number) => iso(at).slice(0, 16);
const flexWrap = { display: "flex", flexWrap: "wrap" } as const;
const text = { overflowWrap: "anywhere" } as const;

export function HistoryNavigation(props: HistoryNavigationProps) {
  const {
    value,
    minimum,
    maximum,
    busy,
    previous,
    next,
    suggested,
    requestedAt,
    displayedAt,
    onChange,
    onQuery,
    onChoose,
  } = props;

  const chooseButton = (label: string, at: number | null) => (
    <button
      className="btn"
      type="button"
      style={{ minHeight: 44 }}
      disabled={at === null || busy}
      onClick={() => {
        if (at !== null) onChoose(at);
      }}
    >
      {label}
    </button>
  );

  return (
    <section>
      <form
        className="macro-filter"
        style={flexWrap}
        onSubmit={(event) => {
          event.preventDefault();
          onQuery();
        }}
      >
        <label htmlFor="history-navigation-cutoff">回放截止（UTC）</label>
        <input
          id="history-navigation-cutoff"
          style={{ minHeight: 44, fontSize: 16, minWidth: 0 }}
          type="datetime-local"
          aria-label="历史回放截止 UTC"
          value={value}
          min={minute(minimum)}
          max={minute(maximum)}
          onChange={(event) => onChange(event.target.value)}
        />
        <button className="btn" type="submit" style={{ minHeight: 44 }}>
          查询历史
        </button>
      </form>

      <div className="macro-pages" style={flexWrap}>
        {chooseButton("上一有效时点", previous)}
        {chooseButton("下一有效时点", next)}
      </div>

      {suggested !== null ? (
        <p className="macro-filter" style={text}>
          建议时点 UTC：{iso(suggested)} {chooseButton("选择建议时点", suggested)}
        </p>
      ) : null}

      <p className="macro-filter" style={text}>
        有效时点仅表示存在完整 K 线；状态与研究是否可用分别判断。
      </p>

      {requestedAt !== null ? (
        <p className="macro-filter" style={text}>
          请求时点 UTC：{iso(requestedAt)}；实际展示 UTC：
          {displayedAt !== null ? iso(displayedAt) : "无精确截止记录"}
        </p>
      ) : null}
    </section>
  );
}
