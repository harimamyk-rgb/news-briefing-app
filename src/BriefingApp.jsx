import { useState, useEffect } from "react";
import { ChevronLeft, ExternalLink, TrendingUp, TrendingDown, Loader2 } from "lucide-react";

const CATEGORY_STYLE = {
  부동산: { bg: "bg-blue-50", text: "text-blue-700" },
  주식: { bg: "bg-emerald-50", text: "text-emerald-700" },
  글로벌: { bg: "bg-amber-50", text: "text-amber-700" },
  반도체: { bg: "bg-violet-50", text: "text-violet-700" },
};

// ---------- API 호출 ----------

async function fetchBriefing() {
  const res = await fetch("/api/briefing");
  if (!res.ok) throw new Error("브리핑을 불러오지 못했습니다.");
  return res.json();
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

function IndexCard({ label, value, changePct }) {
  const isUp = changePct >= 0;
  return (
    <div className="flex-1 rounded-xl bg-gray-50 px-3 py-2.5">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-0.5 text-base font-medium text-gray-900">{value.toLocaleString()}</p>
      <div className={`mt-0.5 flex items-center gap-1 text-xs ${isUp ? "text-emerald-600" : "text-red-600"}`}>
        {isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
        <span>{Math.abs(changePct)}%</span>
      </div>
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

function HomeScreen({ briefing, loading, error, onRetry, onSelectIssue }) {
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
        <IndexCard label="코스닥" value={briefing.indices.kosdaq.value} changePct={briefing.indices.kosdaq.changePct} />
        <IndexCard label="나스닥" value={briefing.indices.nasdaq.value} changePct={briefing.indices.nasdaq.changePct} />
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
      {selected ? (
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
        />
      )}
    </div>
  );
}