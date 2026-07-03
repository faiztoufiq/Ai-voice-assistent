import { realtimeModel, realtimeVoice } from "./_shared.js";

export default function handler(_request, response) {
  response.status(process.env.OPENAI_API_KEY ? 200 : 500).json({
    ok: Boolean(process.env.OPENAI_API_KEY),
    message: process.env.OPENAI_API_KEY
      ? "Configuration ready"
      : "Missing required environment variables: OPENAI_API_KEY",
    model: realtimeModel,
    voice: realtimeVoice,
  });
}
