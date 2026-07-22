import { XMLParser } from "fast-xml-parser";

const parser = new XMLParser({ ignoreAttributes: false });

export async function fetchNews(query, { lang = "ko", country = "KR", limit = 5 } = {}) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=${lang}&gl=${country}&ceid=${country}:${lang}`;
  const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });

  if (!response.ok) {
    throw new Error(`google news rss error for "${query}": ${response.status}`);
  }

  const xml = await response.text();
  const parsed = parser.parse(xml);
  const items = parsed?.rss?.channel?.item;
  const list = Array.isArray(items) ? items : items ? [items] : [];

  return list.slice(0, limit).map((item) => ({
    title: item.title,
    link: item.link,
    pubDate: item.pubDate,
  }));
}
