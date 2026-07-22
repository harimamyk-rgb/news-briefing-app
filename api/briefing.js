// api/briefing.js
// 1일 1회 배치로 호출 (예: Vercel Cron으로 매일 아침 트리거)
// 지수(코스닥/나스닥) + 오늘의 이슈 카드를 한 번에 생성해 DB/캐시에 저장

import { config } from "dotenv";

config({ path: new URL("../.env.local", import.meta.url) });

import { fetchIndices } from "./_lib/marketData.js";
import { fetchNews } from "./_lib/news.js";

const CATEGORY_QUERIES = {
  부동산: "부동산 정책",
  주식: "코스피 증시",
  글로벌: "국제 정세",
  반도체: "반도체 산업",
};

const SYSTEM_PROMPT = `너는 바쁜 직장인을 위한 뉴스 큐레이터다.
사용자가 제공하는 카테고리별 뉴스 헤드라인 목록만 근거로 삼아, 가장 파급력 있는 이슈 3~5개를 골라라.
헤드라인 목록에 없는 내용은 지어내지 마라. 도메인은 섞어서 선정할 것.
각 이슈의 카드 제목은 15자 이내로 클릭을 유도할 만큼 구체적으로 작성하라.

반드시 아래 JSON 배열 형식으로만 답하라. 다른 텍스트, 설명, 마크다운 코드블록 금지.

[
  {
    "id": "string (slug)",
    "category": "부동산 | 주식 | 글로벌 | 반도체",
    "title": "카드용 15자 이내 제목",
    "searchQuery": "이 이슈를 딥다이브할 때 재검색에 쓸 키워드"
  }
]`;

export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "method not allowed" });
  }

  try {
    const [indices, newsLists] = await Promise.all([
      fetchIndices(),
      Promise.all(
        Object.entries(CATEGORY_QUERIES).map(async ([category, query]) => ({
          category,
          articles: await fetchNews(query, { limit: 5 }),
        }))
      ),
    ]);

    const headlinesText = newsLists
      .map(
        ({ category, articles }) =>
          `[${category}]\n` + articles.map((a, i) => `${i + 1}. ${a.title}`).join("\n")
      )
      .join("\n\n");

    const userPrompt = `카테고리별 최신 헤드라인:\n\n${headlinesText}\n\n위 헤드라인 중에서 이슈 카드를 만들어라.`;

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
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(502).json({ error: "openrouter api error", detail: errText });
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;

    if (!text) {
      return res.status(502).json({ error: "no text content in response" });
    }

    const cleaned = text.replace(/```json|```/g, "").trim();
    const issues = JSON.parse(cleaned);

    const parsed = {
      date: new Date().toISOString().slice(0, 10),
      indices,
      issues,
    };

    // TODO: 여기서 DB/캐시(KV, Postgres 등)에 parsed를 저장
    // 지금은 바로 응답만 반환

    return res.status(200).json(parsed);
  } catch (err) {
    console.error("briefing generation failed:", err);
    return res.status(500).json({ error: "briefing generation failed" });
  }
}
