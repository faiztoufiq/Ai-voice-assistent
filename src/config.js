import dotenv from "dotenv";

dotenv.config();

const required = ["OPENAI_API_KEY"];

export const config = {
  port: Number(process.env.PORT || 3000),
  openaiApiKey: process.env.OPENAI_API_KEY || "",
  publicBaseUrl: (process.env.PUBLIC_BASE_URL || "").replace(/\/$/, ""),
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || "",
  verifyTwilioSignature: process.env.VERIFY_TWILIO_SIGNATURE === "true",
  realtimeModel: process.env.OPENAI_REALTIME_MODEL || "gpt-realtime-2",
  realtimeVoice: process.env.OPENAI_REALTIME_VOICE || "marin",
  businessName: process.env.BUSINESS_NAME || "Acme Clinic",
  assistantName: process.env.ASSISTANT_NAME || "Ava",
  assistantPurpose:
    process.env.ASSISTANT_PURPOSE ||
    "help callers book appointments, answer basic business questions, and collect a callback number when needed",
};

export function validateConfig() {
  const missing = required.filter((name) => !process.env[name]);

  if (missing.length > 0) {
    return {
      ok: false,
      message: `Missing required environment variables: ${missing.join(", ")}`,
    };
  }

  if (config.verifyTwilioSignature && !config.twilioAuthToken) {
    return {
      ok: false,
      message: "TWILIO_AUTH_TOKEN is required when VERIFY_TWILIO_SIGNATURE=true",
    };
  }

  return { ok: true, message: "Configuration ready" };
}
