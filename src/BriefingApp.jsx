import { useState, useEffect } from "react";
import { ChevronLeft, ExternalLink, TrendingUp, TrendingDown, Loader2 } from "lucide-react";

const CATEGORY_STYLE = {
  부동산: { bg: "bg-blue-50", text: "text-blue-700" },
  주식: { bg: "bg-emerald-50", text: "text-emerald-700" },
  글로벌: { bg: "bg-amber-50", text: "text-amber-700" },
  반도체: { bg: "bg-violet-50", text: "text-violet-700" },
};

// ---------- API 호출 ----------

// 브라우저 저장(localStorage)에 브리핑을 저장해둘 때 쓰는 이름표(key)
const BRIEFING_CACHE_KEY = "briefing_cache_v1";

// 오늘 날짜를 "2026-07-18" 형식의 문자열로 반환
// → 저장된 캐시가 "오늘 것인지" 비교할 때 씀
function getTodayKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

async function fetchBriefing() {
  // [안전장치] API 재호출 방지 로직
  // 브리핑은 하루에 한 번만 생성되는 게 설계 의도라서,
  // 같은 날 새로고침/재방문할 때마다 API를 다시 부르면 비용만 새어나감.
  // 그래서 브라우저에 "오늘 받아온 데이터"가 있으면 그걸 재사용하고,
  // 없거나 날짜가 바뀌었을 때만 실제로 서버(api/briefing)를 호출함.
  try {
    // 1. 저장해둔 캐시가 있는지 확인
    const cached = localStorage.getItem(BRIEFING_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      // 2. 캐시가 "오늘 날짜"로 저장된 것이면 → API 호출 없이 바로 반환
      if (parsed.cachedDate === getTodayKey()) {
        return parsed.data;
      }
      // 날짜가 다르면(어제 캐시) → 아래로 내려가서 새로 호출
    }
  } catch {
    // localStorage 읽기 자체가 실패해도(브라우저 설정 등) 앱이 멈추면 안 되니
    // 에러는 무시하고 그냥 새로 API를 호출하는 흐름으로 넘어감
  }

  // 3. 캐시가 없거나 오늘 것이 아닐 때만 실제 API 호출 (여기서만 비용 발생)
  const res = await fetch("/api/briefing");
  if (!res.ok) throw new Error("브리핑을 불러오지 못했습니다.");
  const data = await res.json();

  // 4. 방금 받아온 결과를 "오늘 날짜"와 함께 저장
  //    → 다음 새로고침부터는 위 1~2번 단계에서 걸려서 API를 다시 안 부름
  try {
    localStorage.setItem(
      BRIEFING_CACHE_KEY,
      JSON.stringify({ cachedDate: getTodayKey(), data })
    );
  } catch {
    // 저장 실패해도(용량 초과 등) 화면 동작 자체에는 지장 없음, 조용히 넘어감
  }

  return data;
}

async function fetchDeepDive(searchQuery) {
  const res = await fetch("/api/deepdive", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ searchQuery }),
  });
  if (!res.ok) throw new Error("상세 내용을 불러오지 못했습니다.");
  return res.json();
}

// ---------- UI 조각 ----------

function IndexCard({ label, value, changePct, onClick }) {
  const isUp = changePct >= 0;
  return (
    <button
      onClick={onClick}
      className="flex-1 rounded-xl bg-gray-50 px-3 py-2.5 text-left transition hover:bg-gray-100"
    >
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">{label}</p>
        <span className="text-[10px] text-gray-400">추세 ›</span>
      </div>
      <p className="mt-0.5 text-base font-medium text-gray-900">{value.toLocaleString()}</p>
      <div className={`mt-0.5 flex items-center gap-1 text-xs ${isUp ? "text-emerald-600" : "text-red-600"}`}>
        {isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
        <span>{Math.abs(changePct)}%</span>
      </div>
    </button>
  );
}

// series 배열(종가들)로 미니 스파크라인 SVG용 path를 계산
function buildSparklinePath(series, w = 300, h = 90, padX = 4, padY = 10) {
  if (!series || series.length < 2) {
    return { linePath: "", areaPath: "", endpoint: [0, 0] };
  }
  const min = Math.min(...series);
  const max = Math.max(...series);
  const range = max - min || 1;
  const stepX = (w - padX * 2) / (series.length - 1);

  const points = series.map((v, i) => {
    const x = padX + i * stepX;
    const y = padY + (1 - (v - min) / range) * (h - padY * 2);
    return [x, y];
  });

  const linePath = points.map((p, i) => (i === 0 ? "M" : "L") + p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");
  const areaPath = `${linePath} L${points[points.length - 1][0].toFixed(1)},${h} L${points[0][0].toFixed(1)},${h} Z`;

  return { linePath, areaPath, endpoint: points[points.length - 1] };
}

const PERIOD_LABEL = { "3d": "3일", "7d": "7일", "30d": "30일" };

function TrendScreen({ indexLabel, trend, period, onSelectPeriod, onBack }) {
  const data = trend?.[period];

  return (
    <div className="mx-auto w-full max-w-sm rounded-2xl border border-gray-200 bg-white">
      <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3.5">
        <button onClick={onBack} className="text-gray-400 hover:text-gray-600" aria-label="뒤로가기">
          <ChevronLeft size={18} />
        </button>
        <p className="text-sm font-medium text-gray-900">{indexLabel} 추세</p>
      </div>

      <div className="flex gap-1 px-3 pt-3">
        {Object.keys(PERIOD_LABEL).map((p) => (
          <button
            key={p}
            onClick={() => onSelectPeriod(p)}
            className={`flex-1 rounded-lg border py-1.5 text-xs font-medium transition ${
              p === period
                ? "border-gray-900 bg-gray-900 text-white"
                : "border-gray-200 text-gray-500 hover:border-gray-300"
            }`}
          >
            {PERIOD_LABEL[p]}
          </button>
        ))}
      </div>

      {!trend && (
        <div className="px-4 py-10 text-center text-sm text-gray-500">추세 데이터를 불러오지 못했어요.</div>
      )}

      {data && (
        <>
          {(() => {
            const isUp = data.changePct >= 0;
            const color = isUp ? "#059669" : "#dc2626";
            const { linePath, areaPath, endpoint } = buildSparklinePath(data.series);
            return (
              <>
                <div className="mx-3 mt-3 rounded-xl bg-gray-50 p-3">
                  <svg viewBox="0 0 300 90" className="w-full">
                    <path d={areaPath} fill={color} opacity={0.12} />
                    <path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx={endpoint[0]} cy={endpoint[1]} r={3.5} fill={color} stroke="#fff" strokeWidth={2} />
                  </svg>
                </div>

                <div className="grid grid-cols-3 gap-2 px-3 pt-2">
                  <div className="rounded-lg bg-gray-50 p-2">
                    <p className="text-[10px] text-gray-400">구간 시작</p>
                    <p className="mt-0.5 text-sm font-semibold text-gray-900">{data.startValue.toLocaleString()}</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-2">
                    <p className="text-[10px] text-gray-400">현재</p>
                    <p className="mt-0.5 text-sm font-semibold text-gray-900">{data.endValue.toLocaleString()}</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-2">
                    <p className="text-[10px] text-gray-400">구간 등락률</p>
                    <p className={`mt-0.5 text-sm font-semibold ${isUp ? "text-emerald-600" : "text-red-600"}`}>
                      {isUp ? "▲" : "▼"} {Math.abs(data.changePct)}%
                    </p>
                  </div>
                </div>
              </>
            );
          })()}

          <div className="mx-3 my-3 rounded-xl border border-gray-100 p-3">
            <p className="text-[10px] font-medium text-gray-400">핵심 변동 요인</p>
            <p className="mt-1.5 text-xs leading-relaxed text-gray-900">{data.summary}</p>
            {data.factors?.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {data.factors.map((f) => (
                  <span key={f} className="rounded-md border border-gray-100 bg-gray-50 px-2 py-1 text-[10px] text-gray-500">
                    {f}
                  </span>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function IssueCard({ issue, onClick }) {
  const style = CATEGORY_STYLE[issue.category] ?? CATEGORY_STYLE["글로벌"];
  return (
    <button
      onClick={onClick}
      className="w-full rounded-xl bg-gray-50 px-3.5 py-3 text-left transition hover:bg-gray-100"
    >
      <span className={`inline-block rounded-md px-2 py-0.5 text-xs ${style.bg} ${style.text}`}>
        {issue.category}
      </span>
      <p className="mt-1.5 text-sm text-gray-900">{issue.title}</p>
    </button>
  );
}

function CenterState({ children }) {
  return (
    <div className="mx-auto flex w-full max-w-sm items-center justify-center rounded-2xl border border-gray-200 bg-white py-16">
      {children}
    </div>
  );
}

function HomeScreen({ briefing, loading, error, onRetry, onSelectIssue, onSelectIndex }) {
  if (loading) {
    return (
      <CenterState>
        <Loader2 className="animate-spin text-gray-400" size={22} />
      </CenterState>
    );
  }

  if (error || !briefing) {
    return (
      <CenterState>
        <div className="text-center">
          <p className="text-sm text-gray-500">브리핑을 불러오지 못했어요.</p>
          <button onClick={onRetry} className="mt-3 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50">
            다시 시도
          </button>
        </div>
      </CenterState>
    );
  }

  return (
    <div className="mx-auto w-full max-w-sm rounded-2xl border border-gray-200 bg-white">
      <div className="border-b border-gray-100 px-4 py-3.5">
        <p className="text-[15px] font-medium text-gray-900">오늘의 브리핑</p>
        <p className="mt-0.5 text-xs text-gray-400">{briefing.date} · 이슈 {briefing.issues.length}개</p>
      </div>

      <div className="flex gap-2 px-3 pt-3">
        <IndexCard
          label="코스피"
          value={briefing.indices.kospi.value}
          changePct={briefing.indices.kospi.changePct}
          onClick={() => onSelectIndex("kospi")}
        />
        <IndexCard
          label="나스닥"
          value={briefing.indices.nasdaq.value}
          changePct={briefing.indices.nasdaq.changePct}
          onClick={() => onSelectIndex("nasdaq")}
        />
      </div>

      <div className="flex flex-col gap-2 p-3">
        {briefing.issues.map((issue) => (
          <IssueCard key={issue.id} issue={issue} onClick={() => onSelectIssue(issue)} />
        ))}
      </div>
    </div>
  );
}

function DetailScreen({ issueTitle, detail, loading, error, onBack, onSelectFollowUp }) {
  return (
    <div className="mx-auto w-full max-w-sm rounded-2xl border border-gray-200 bg-white">
      <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3.5">
        <button onClick={onBack} className="text-gray-400 hover:text-gray-600" aria-label="뒤로가기">
          <ChevronLeft size={18} />
        </button>
        <p className="text-sm font-medium text-gray-900">{issueTitle}</p>
      </div>

      {loading && (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-gray-400" size={22} />
        </div>
      )}

      {!loading && error && (
        <div className="px-4 py-10 text-center text-sm text-gray-500">상세 내용을 불러오지 못했어요.</div>
      )}

      {!loading && !error && detail && (
        <div className="flex flex-col gap-3.5 px-4 py-4">
          <section>
            <p className="mb-1 text-xs font-medium text-gray-500">요약</p>
            <p className="text-sm leading-relaxed text-gray-900">{detail.summary}</p>
          </section>
          <section>
            <p className="mb-1 text-xs font-medium text-gray-500">왜 중요한가</p>
            <p className="text-sm leading-relaxed text-gray-900">{detail.whyItMatters}</p>
          </section>
          <section>
            <p className="mb-1 text-xs font-medium text-gray-500">그동안의 흐름</p>
            <p className="text-sm leading-relaxed text-gray-900">{detail.context}</p>
          </section>

          {detail.sourceUrl && (
            <a href={detail.sourceUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-blue-600">
              원문 보기 <ExternalLink size={12} />
            </a>
          )}

          <div className="mt-1 border-t border-gray-100 pt-3">
            <p className="mb-2 text-xs font-medium text-gray-500">이런 것도 궁금하지 않으세요?</p>
            <div className="flex flex-col gap-1.5">
              {detail.followUpQuestions?.map((q) => (
                <button
                  key={q}
                  onClick={() => onSelectFollowUp(q)}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- 메인 ----------

export default function BriefingApp() {
  const [briefing, setBriefing] = useState(null);
  const [briefingLoading, setBriefingLoading] = useState(true);
  const [briefingError, setBriefingError] = useState(null);

  const [selected, setSelected] = useState(null); // { title, searchQuery }
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);

  const [selectedIndex, setSelectedIndex] = useState(null); // "kospi" | "nasdaq" | null
  const [trendPeriod, setTrendPeriod] = useState("7d");

  const loadBriefing = () => {
    setBriefingLoading(true);
    setBriefingError(null);
    fetchBriefing()
      .then(setBriefing)
      .catch((e) => setBriefingError(e.message))
      .finally(() => setBriefingLoading(false));
  };

  useEffect(() => {
    loadBriefing();
  }, []);

  const loadDeepDive = (title, searchQuery) => {
    setSelected({ title, searchQuery });
    setDetail(null);
    setDetailLoading(true);
    setDetailError(null);
    fetchDeepDive(searchQuery)
      .then(setDetail)
      .catch((e) => setDetailError(e.message))
      .finally(() => setDetailLoading(false));
  };

  return (
    <div className="min-h-screen bg-gray-100 px-4 py-8">
      {selectedIndex ? (
        <TrendScreen
          indexLabel={selectedIndex === "kospi" ? "코스피" : "나스닥"}
          trend={briefing?.trends?.[selectedIndex] ?? null}
          period={trendPeriod}
          onSelectPeriod={setTrendPeriod}
          onBack={() => setSelectedIndex(null)}
        />
      ) : selected ? (
        <DetailScreen
          issueTitle={selected.title}
          detail={detail}
          loading={detailLoading}
          error={detailError}
          onBack={() => setSelected(null)}
          onSelectFollowUp={(question) => loadDeepDive(question, question)}
        />
      ) : (
        <HomeScreen
          briefing={briefing}
          loading={briefingLoading}
          error={briefingError}
          onRetry={loadBriefing}
          onSelectIssue={(issue) => loadDeepDive(issue.title, issue.searchQuery)}
          onSelectIndex={(key) => {
            setSelectedIndex(key);
            setTrendPeriod("7d");
          }}
        />
      )}
    </div>
  );
}
