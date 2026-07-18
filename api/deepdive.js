// api/deepdive.js
// 사용자가 카드/연관질문 클릭할 때마다 실시간 호출

const SYSTEM_PROMPT = `너는 바쁜 직장인에게 이슈를 설명해주는 브리핑 어시스턴트다.
web_search로 주어진 주제에 대해 조사하고 아래 항목을 채워라.

- summary: 핵심 요약, 2~3문장
- whyItMatters: 이게 왜 중요한지, 2~3문장
- context: 그동안의 흐름/배경, 2~3문장
- sourceUrl: 참고한 원문 링크 중 가장 신뢰도 높은 것 1개
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
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 1000,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: `주제: ${searchQuery}` }],
        tools: [{ type: "web_search_20250305", name: "web_search" }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(502).json({ error: "anthropic api error", detail: errText });
    }

    const data = await response.json();
    const textBlock = data.content.find((b) => b.type === "text");

    if (!textBlock) {
      return res.status(502).json({ error: "no text content in response" });
    }

    const cleaned = textBlock.text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    return res.status(200).json(parsed);
  } catch (err) {
    console.error("deep dive generation failed:", err);
    return res.status(500).json({ error: "deep dive generation failed" });
  }
}