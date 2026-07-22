// api/deepdive.js
// 사용자가 카드/연관질문 클릭할 때마다 실시간 호출

import { config } from "dotenv";

config({ path: new URL("../.env.local", import.meta.url) });

import { fetchNews } from "./_lib/news.js";

const SYSTEM_PROMPT = `너는 바쁜 직장인에게 이슈를 설명해주는 브리핑 어시스턴트다.
사용자가 제공하는 뉴스 헤드라인 목록만 근거로 삼아 아래 항목을 채워라. 목록에 없는 내용은 지어내지 마라.

- summary: 핵심 요약, 2~3문장
- whyItMatters: 이게 왜 중요한지, 2~3문장
- context: 그동안의 흐름/배경, 2~3문장
- sourceUrl: 제공된 헤드라인 목록의 링크 중 가장 신뢰도 높은 것 1개 (목록에 있는 링크 그대로 사용)
- followUpQuestions: 이 브리핑을 읽고 나면 자연스럽게 궁금해질 질문 2~3개
  (영향 범위, 반대 의견, 앞으로 전망 등 다양한 각도로)

반드시 아래 JSON 형식으로만 답하라. 다른 텍스트, 설명, 마크다운 코드블록 금지.

{
  "summary": "string",
  "whyItMatters": "string",
  "context": "string",
  "sourceUrl": "string",
  "followUpQuestions": ["string", "string", "string"]
}`;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method not allowed" });
  }

  const { searchQuery } = req.body || {};
  if (!searchQuery || typeof searchQuery !== "string") {
    return res.status(400).json({ error: "searchQuery is required" });
  }

  try {
    const articles = await fetchNews(searchQuery, { limit: 6 });

    if (articles.length === 0) {
      return res.status(502).json({ error: "no news articles found for query" });
    }

    const headlinesText = articles.map((a, i) => `${i + 1}. ${a.title} (${a.link})`).join("\n");
    const userPrompt = `주제: ${searchQuery}\n\n관련 뉴스 헤드라인:\n${headlinesText}`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: "nvidia/nemotron-3-ultra-550b-a55b:free",
        max_tokens: 2000,
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
    const parsed = JSON.parse(cleaned);

    return res.status(200).json(parsed);
  } catch (err) {
    console.error("deep dive generation failed:", err);
    return res.status(500).json({ error: "deep dive generation failed" });
  }
}
