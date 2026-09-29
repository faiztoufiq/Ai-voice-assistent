import { buildInstructions, openrouterModel, requireOpenRouterKey } from "./_shared.js";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (!requireOpenRouterKey(response)) return;

  const message = String(request.body?.message || "").trim();

  if (!message) {
    response.status(400).json({ error: "Message is required" });
    return;
  }

  try {
    const openrouterResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.PUBLIC_BASE_URL || "http://localhost:3000",
        "X-OpenRouter-Title": "AI Voice Assistant Prototype",
      },
      body: JSON.stringify({
        model: openrouterModel,
        messages: [
          {
            role: "system",
            content: buildInstructions(),
          },
          {
            role: "user",
            content: message,
          },
        ],
        max_tokens: 220,
        temperature: 0.7,
      }),
    });

    const data = await openrouterResponse.json();

    if (!openrouterResponse.ok) {
      response.status(openrouterResponse.status).json({
        error: data.error?.message || "OpenRouter request failed",
      });
      return;
    }

    response.status(200).json({
      reply:
        data.choices?.[0]?.message?.content?.trim() ||
        "I can help with that. Could you share a little more detail?",
      model: openrouterModel,
    });
  } catch (error) {
    response.status(500).json({ error: error.message });
  }
}
