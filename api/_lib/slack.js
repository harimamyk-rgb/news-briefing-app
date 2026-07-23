const CATEGORY_EMOJI = {
  부동산: "🏠",
  주식: "📈",
  글로벌: "🌐",
  반도체: "💾",
};

function formatBriefingForSlack(briefing) {
  const { date, indices, issues } = briefing;

  const indexLine = (label, index) => {
    const arrow = index.changePct >= 0 ? "▲" : "▼";
    return `*${label}* ${index.value.toLocaleString()} (${arrow} ${Math.abs(index.changePct)}%)`;
  };

  const issueLines = issues
    .map((issue) => `${CATEGORY_EMOJI[issue.category] ?? "•"} *[${issue.category}]* ${issue.title}`)
    .join("\n");

  return {
    text: `오늘의 브리핑 (${date})`,
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: `📰 오늘의 브리핑 · ${date}` },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: indexLine("코스닥", indices.kosdaq) },
          { type: "mrkdwn", text: indexLine("나스닥", indices.nasdaq) },
        ],
      },
      { type: "divider" },
      {
        type: "section",
        text: { type: "mrkdwn", text: issueLines },
      },
    ],
  };
}

export async function sendBriefingToSlack(briefing) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    throw new Error("SLACK_WEBHOOK_URL is not set");
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(formatBriefingForSlack(briefing)),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`slack webhook error: ${response.status} ${errText}`);
  }
}
