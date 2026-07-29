import { fetchSeries, periodReturn } from "./marketData.js";
import { fetchNews } from "./news.js";

const INDEX_SYMBOL = { kospi: "^KS11", nasdaq: "^IXIC" };
const CROSS_INDEX_SYMBOL = { kospi: "^IXIC", nasdaq: "^KS11" };
const CROSS_INDEX_NAME = { kospi: "나스닥", nasdaq: "코스피" };
const CURRENCY_SYMBOL = "KRW=X";

const CONSTITUENTS = {
  kospi: [
    { symbol: "005930.KS", name: "삼성전자" },
    { symbol: "000660.KS", name: "SK하이닉스" },
  ],
  nasdaq: [
    { symbol: "NVDA", name: "엔비디아" },
    { symbol: "AAPL", name: "애플" },
    { symbol: "MSFT", name: "마이크로소프트" },
  ],
};

const PERIODS = [
  { key: "3d", days: 3, label: "3일" },
  { key: "7d", days: 7, label: "7일" },
  { key: "30d", days: 30, label: "30일" },
];

const SYSTEM_PROMPT = `너는 증권 애널리스트다. 사용자가 제공하는 수치와 뉴스 헤드라인만 근거로 삼아 지수 변동을 설명해라.
제공되지 않은 내용은 절대 지어내지 마라. 뚜렷한 계기를 찾을 수 없으면 "특정 계기보다는 전반적 흐름으로 보임"처럼 솔직하게 표현해라.

각 기간(3일/7일/30일)에 대해 다음을 반드시 포함해서 2~3문장으로 설명해라:
- 제공된 뉴스 헤드라인에서 찾을 수 있는, 변동의 실제 계기(사건)
- 개별 종목 등락률을 근거로, 특정 종목이 하락/상승을 주도했는지 아니면 대체로 함께 움직였는지
- 환율·해외지수 등락 등 참고 수치도 관련 있으면 활용

반드시 아래 JSON 형식으로만 답하라. 다른 텍스트, 설명, 마크다운 코드블록 금지.

{
  "3d": { "summary": "string", "factors": ["string", "string"] },
  "7d": { "summary": "string", "factors": ["string", "string"] },
  "30d": { "summary": "string", "factors": ["string", "string"] }
}`;

function sliceSeries(closes, days) {
  return closes.slice(Math.max(0, closes.length - 1 - days));
}

export async function generateTrend(indexKey) {
  const constituents = CONSTITUENTS[indexKey];
  const indexSymbol = INDEX_SYMBOL[indexKey];
  const crossSymbol = CROSS_INDEX_SYMBOL[indexKey];
  const crossName = CROSS_INDEX_NAME[indexKey];

  const [indexCloses, currencyCloses, crossCloses, ...constituentCloses] = await Promise.all([
    fetchSeries(indexSymbol),
    fetchSeries(CURRENCY_SYMBOL),
    fetchSeries(crossSymbol),
    ...constituents.map((c) => fetchSeries(c.symbol)),
  ]);

  const periodsData = {};

  for (const { key, days, label } of PERIODS) {
    const indexReturn = periodReturn(indexCloses, days);
    const currencyReturn = periodReturn(currencyCloses, days);
    const crossReturn = periodReturn(crossCloses, days);
    const constituentReturns = constituents.map((c, i) => ({
      name: c.name,
      ...periodReturn(constituentCloses[i], days),
    }));

    // 지수보다 눈에 띄게(1.3배 이상) 더 크게 움직인 종목만 "주도 후보"로 취급.
    // 실제 시장 전체의 상승/하락 종목 비율(breadth)은 무료로 구할 수 없어서
    // 소수 대형주 비교로 "쏠림 vs 전반적"을 근사치로만 판단한다.
    const drivers = constituentReturns.filter(
      (c) => Math.abs(c.changePct) > Math.abs(indexReturn.changePct) * 1.3
    );

    const direction = indexReturn.changePct >= 0 ? "상승" : "하락";
    const searchQuery = drivers.length > 0
      ? `${drivers.map((d) => d.name).join(" ")} 주가 ${direction} 이유`
      : `증시 ${label} ${direction} 이유`;

    const headlines = await fetchNews(searchQuery, { limit: 5 });

    periodsData[key] = {
      series: sliceSeries(indexCloses, days),
      indexReturn,
      currencyReturn,
      crossReturn,
      constituentReturns,
      headlines,
    };
  }

  const promptSections = PERIODS.map(({ key, label }) => {
    const d = periodsData[key];
    const lines = [
      `[${label}]`,
      `지수 등락률: ${d.indexReturn.changePct}% (${d.indexReturn.startValue} → ${d.indexReturn.endValue})`,
      `원/달러 환율 등락률: ${d.currencyReturn.changePct}%`,
      `${crossName} 등락률: ${d.crossReturn.changePct}%`,
      `개별 종목 등락률: ${d.constituentReturns.map((c) => `${c.name} ${c.changePct}%`).join(", ")}`,
      `관련 뉴스 헤드라인:`,
      ...d.headlines.map((h, i) => `${i + 1}. ${h.title}`),
    ];
    return lines.join("\n");
  }).join("\n\n");

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
    },
    body: JSON.stringify({
      model: "nvidia/nemotron-3-ultra-550b-a55b:free",
      max_tokens: 3000,
      reasoning: { effort: "low" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: promptSections },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`openrouter api error: ${errText}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;

  if (!text) {
    throw new Error("no text content in response");
  }

  const cleaned = text.replace(/```json|```/g, "").trim();
  const llmPeriods = JSON.parse(cleaned);

  const result = {};
  for (const { key } of PERIODS) {
    const d = periodsData[key];
    result[key] = {
      series: d.series,
      startValue: d.indexReturn.startValue,
      endValue: d.indexReturn.endValue,
      changePct: d.indexReturn.changePct,
      summary: llmPeriods[key]?.summary ?? "",
      factors: llmPeriods[key]?.factors ?? [],
    };
  }

  return result;
}
