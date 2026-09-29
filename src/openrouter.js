import { config } from "./config.js";
import { buildInstructions } from "./prompt.js";

export async function generateOpenRouterReply(message) {
  if (!config.openrouterApiKey) {
    throw new Error("Missing OPENROUTER_API_KEY environment variable");
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.openrouterApiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": config.publicBaseUrl || "http://localhost:3000",
      "X-OpenRouter-Title": "AI Voice Assistant Prototype",
    },
    body: JSON.stringify({
      model: config.openrouterModel,
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

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || "OpenRouter request failed");
  }

  return (
    data.choices?.[0]?.message?.content?.trim() ||
    "I can help with that. Could you share a little more detail?"
  );
}
