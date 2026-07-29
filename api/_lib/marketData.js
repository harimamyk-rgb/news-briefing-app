const SYMBOLS = { kospi: "^KS11", nasdaq: "^IXIC" };

async function fetchIndex(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
  const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });

  if (!response.ok) {
    throw new Error(`yahoo finance error for ${symbol}: ${response.status}`);
  }

  const data = await response.json();
  const result = data.chart?.result?.[0];
  const meta = result?.meta;

  if (!meta || typeof meta.regularMarketPrice !== "number") {
    throw new Error(`no market data for ${symbol}`);
  }

  const value = meta.regularMarketPrice;
  // meta.previousClose/chartPreviousClose are unreliable (often null, or the
  // start of the requested range rather than the prior trading day), so derive
  // the previous close directly from the daily close series instead.
  const closes = (result.indicators?.quote?.[0]?.close ?? []).filter(
    (c) => typeof c === "number"
  );
  const prevClose = closes.length >= 2 ? closes[closes.length - 2] : meta.previousClose;
  const changePct = prevClose ? ((value - prevClose) / prevClose) * 100 : 0;

  return { value: Number(value.toFixed(2)), changePct: Number(changePct.toFixed(2)) };
}

export async function fetchIndices() {
  const [kospi, nasdaq] = await Promise.all([
    fetchIndex(SYMBOLS.kospi),
    fetchIndex(SYMBOLS.nasdaq),
  ]);
  return { kospi, nasdaq };
}

// 추세(3/7/30일) 기능용: 특정 심볼의 일별 종가 배열을 가져온다.
export async function fetchSeries(symbol, range = "3mo") {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=${range}`;
  const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });

  if (!response.ok) {
    throw new Error(`yahoo finance error for ${symbol}: ${response.status}`);
  }

  const data = await response.json();
  const closes = (data.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? []).filter(
    (c) => typeof c === "number"
  );

  if (closes.length < 2) {
    throw new Error(`insufficient market data for ${symbol}`);
  }

  return closes;
}

// closes 배열에서 최근 값 대비 tradingDaysAgo 거래일 전 값의 등락률을 계산.
export function periodReturn(closes, tradingDaysAgo) {
  const endIdx = closes.length - 1;
  const startIdx = Math.max(0, endIdx - tradingDaysAgo);
  const startValue = closes[startIdx];
  const endValue = closes[endIdx];
  const changePct = ((endValue - startValue) / startValue) * 100;

  return {
    startValue: Number(startValue.toFixed(2)),
    endValue: Number(endValue.toFixed(2)),
    changePct: Number(changePct.toFixed(2)),
  };
}
