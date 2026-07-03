import twilio from "twilio";
import { config } from "./config.js";

export function buildVoiceResponse(request) {
  const host = config.publicBaseUrl || `${request.protocol}://${request.get("host")}`;
  const wsUrl = host.replace(/^http/, "ws");
  const response = new twilio.twiml.VoiceResponse();

  response.say(
    {
      voice: "Polly.Joanna",
      language: "en-US",
    },
    "Connecting you to our AI assistant now."
  );

  const connect = response.connect();
  connect.stream({
    url: `${wsUrl}/media-stream`,
  });

  return response.toString();
}

export function isValidTwilioRequest(request) {
  if (!config.verifyTwilioSignature) return true;
  if (!config.twilioAuthToken) return false;

  const signature = request.get("x-twilio-signature") || "";
  const url = `${config.publicBaseUrl || `${request.protocol}://${request.get("host")}`}${request.originalUrl}`;

  return twilio.validateRequest(config.twilioAuthToken, signature, url, request.body);
}
