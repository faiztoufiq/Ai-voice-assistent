import { buildInstructions, realtimeModel, realtimeVoice, requireOpenAIKey } from "./_shared.js";

export default async function handler(_request, response) {
  if (!requireOpenAIKey(response)) return;

  try {
    const openaiResponse = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
        "OpenAI-Safety-Identifier": "vercel-browser-voice-demo",
      },
      body: JSON.stringify({
        session: {
          type: "realtime",
          model: realtimeModel,
          instructions: buildInstructions(),
          output_modalities: ["audio"],
          audio: {
            output: {
              voice: realtimeVoice,
            },
          },
        },
      }),
    });

    const data = await openaiResponse.json();

    if (!openaiResponse.ok) {
      response.status(openaiResponse.status).json({
        error: data.error?.message || "Failed to create realtime token",
      });
      return;
    }

    response.status(200).json(data);
  } catch (error) {
    response.status(500).json({ error: error.message });
  }
}
