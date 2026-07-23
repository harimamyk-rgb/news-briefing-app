// api/briefing.js
// 1일 1회 배치로 호출 (예: Vercel Cron으로 매일 아침 트리거)
// 지수(코스닥/나스닥) + 오늘의 이슈 카드를 한 번에 생성해 DB/캐시에 저장

import { config } from "dotenv";

config({ path: new URL("../.env.local", import.meta.url) });

import { generateBriefing } from "./_lib/generateBriefing.js";

export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "method not allowed" });
  }

  try {
    const briefing = await generateBriefing();

    // TODO: 여기서 DB/캐시(KV, Postgres 등)에 briefing을 저장

    return res.status(200).json(briefing);
  } catch (err) {
    console.error("briefing generation failed:", err);
    return res.status(500).json({ error: "briefing generation failed" });
  }
}
