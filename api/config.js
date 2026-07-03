import { getOrigin } from "./_shared.js";

export default function handler(request, response) {
  const origin = getOrigin(request);

  response.status(200).json({
    publicBaseUrl: origin,
    voiceWebhookUrl: "Phone provider disabled on Vercel demo",
    mediaStreamPath: "Not available on Vercel",
    healthUrl: `${origin}/api/health`,
    eventStreamAvailable: false,
  });
}
