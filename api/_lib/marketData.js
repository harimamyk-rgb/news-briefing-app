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
