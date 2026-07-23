// api/notify-slack.js
// Vercel Cron이 매일 정해진 시간에 호출 (vercel.json의 crons 설정 참고)

import { config } from "dotenv";

config({ path: new URL("../.env.local", import.meta.url) });

import { generateBriefing } from "./_lib/generateBriefing.js";
import { sendBriefingToSlack } from "./_lib/slack.js";

export default async function handler(req, res) {
  if (process.env.CRON_SECRET) {
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: "unauthorized" });
    }
  }

  try {
    const briefing = await generateBriefing();
    await sendBriefingToSlack(briefing);
    return res.status(200).json({ status: "ok", date: briefing.date });
  } catch (err) {
    console.error("slack notification failed:", err);
    return res.status(500).json({ error: "slack notification failed" });
  }
}
