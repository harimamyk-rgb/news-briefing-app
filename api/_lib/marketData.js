const SYMBOLS = { kosdaq: "^KQ11", nasdaq: "^IXIC" };

async function fetchIndex(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
  const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });

  if (!response.ok) {
    throw new Error(`yahoo finance error for ${symbol}: ${response.status}`);
  }

  const data = await response.json();
  const meta = data.chart?.result?.[0]?.meta;

  if (!meta || typeof meta.regularMarketPrice !== "number") {
    throw new Error(`no market data for ${symbol}`);
  }

  const value = meta.regularMarketPrice;
  const prevClose = meta.previousClose ?? meta.chartPreviousClose;
  const changePct = prevClose ? ((value - prevClose) / prevClose) * 100 : 0;

  return { value: Number(value.toFixed(2)), changePct: Number(changePct.toFixed(2)) };
}

export async function fetchIndices() {
  const [kosdaq, nasdaq] = await Promise.all([
    fetchIndex(SYMBOLS.kosdaq),
    fetchIndex(SYMBOLS.nasdaq),
  ]);
  return { kosdaq, nasdaq };
}
