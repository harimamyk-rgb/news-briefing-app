// api/briefing.js
// 1일 1회 배치로 호출 (예: Vercel Cron으로 매일 아침 트리거)
// 지수(코스닥/나스닥) + 오늘의 이슈 카드를 한 번에 생성해 DB/캐시에 저장

const SYSTEM_PROMPT = `너는 바쁜 직장인을 위한 뉴스 큐레이터다. web_search로 아래 두 가지를 조사해라.

1. 코스닥, 나스닥의 가장 최근 종가와 전일 대비 등락률
2. 오늘 한국 및 글로벌에서 중요한 이슈 3~5개
   대상 도메인: 부동산 정책, 주식/증시, 글로벌 정세, 반도체 산업
   도메인은 섞어서 선정하되 가장 파급력 있는 것만 고를 것
   각 이슈의 카드 제목은 15자 이내로 클릭을 유도할 만큼 구체적으로 작성

반드시 아래 JSON 형식으로만 답하라. 다른 텍스트, 설명, 마크다운 코드블록 금지.

{
  "date": "YYYY-MM-DD",
  "indices": {
    "kosdaq": { "value": number, "changePct": number },
    "nasdaq": { "value": number, "changePct": number }
  },
  "issues": [
    {
      "id": "string (slug)",
      "category": "부동산 | 주식 | 글로벌 | 반도체",
      "title": "카드용 15자 이내 제목",
      "searchQuery": "이 이슈를 딥다이브할 때 재검색에 쓸 키워드"
    }
  ]
}`;

export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "method not allowed" });
  }

  try {
    console.log('KEY length:', process.env.ANTHROPIC_API_KEY?.length);
    console.log('env keys with ANTHROPIC:', Object.keys(process.env).filter((k) => k.toUpperCase().includes('ANTHROPIC')));
    console.log('total env keys:', Object.keys(process.env).length);
    console.log('has VERCEL_OIDC_TOKEN:', 'VERCEL_OIDC_TOKEN' in process.env);
    console.log('all env keys:', Object.keys(process.env).sort());
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: "오늘 브리핑을 생성해줘." }],
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

    // TODO: 여기서 DB/캐시(KV, Postgres 등)에 parsed를 저장
    // 지금은 바로 응답만 반환

    return res.status(200).json(parsed);
  } catch (err) {
    console.error("briefing generation failed:", err);
    return res.status(500).json({ error: "briefing generation failed" });
  }
}