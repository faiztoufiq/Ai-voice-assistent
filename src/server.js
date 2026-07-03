import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { WebSocketServer } from "ws";
import { config, validateConfig } from "./config.js";
import { addEventSubscriber, getRecentEvents, emitDemoEvent } from "./events.js";
import { handleMediaStream } from "./realtimeBridge.js";
import { buildInstructions } from "./prompt.js";
import { buildVoiceResponse, isValidTwilioRequest } from "./twilio.js";

const app = express();

app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);
app.use(morgan("tiny"));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static("public"));

app.get("/health", (_request, response) => {
  const status = validateConfig();
  response.status(status.ok ? 200 : 500).json({
    ok: status.ok,
    message: status.message,
    model: config.realtimeModel,
    voice: config.realtimeVoice,
  });
});

app.get("/events", (request, response) => {
  response.setHeader("Content-Type", "text/event-stream");
  response.setHeader("Cache-Control", "no-cache, no-transform");
  response.setHeader("Connection", "keep-alive");
  response.flushHeaders?.();

  const unsubscribe = addEventSubscriber(response);
  request.on("close", unsubscribe);
});

app.get("/api/events", (_request, response) => {
  response.json({ events: getRecentEvents() });
});

app.get("/api/config", (request, response) => {
  const origin = config.publicBaseUrl || `${request.protocol}://${request.get("host")}`;

  response.json({
    publicBaseUrl: origin,
    voiceWebhookUrl: `${origin}/voice`,
    mediaStreamPath: "/media-stream",
    healthUrl: `${origin}/health`,
  });
});

app.get("/api/realtime-token", async (_request, response) => {
  const status = validateConfig();
  if (!status.ok) {
    response.status(500).json({ error: status.message });
    return;
  }

  try {
    const openaiResponse = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.openaiApiKey}`,
        "Content-Type": "application/json",
        "OpenAI-Safety-Identifier": "browser-voice-demo",
      },
      body: JSON.stringify({
        session: {
          type: "realtime",
          model: config.realtimeModel,
          instructions: buildInstructions(),
          output_modalities: ["audio"],
          audio: {
            output: {
              voice: config.realtimeVoice,
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

    emitDemoEvent("browser.token.created", { message: "Browser demo token created" });
    response.json(data);
  } catch (error) {
    response.status(500).json({ error: error.message });
  }
});

app.all("/voice", (request, response) => {
  if (!isValidTwilioRequest(request)) {
    emitDemoEvent("security.rejected", { message: "Rejected invalid Twilio signature" });
    response.status(403).send("Invalid Twilio signature");
    return;
  }

  response.type("text/xml").send(buildVoiceResponse(request));
});

app.get("/twiml", (request, response) => {
  response.type("text/xml").send(buildVoiceResponse(request));
});

const server = app.listen(config.port, () => {
  const status = validateConfig();
  console.log(`AI voice assistant demo running on http://localhost:${config.port}`);
  console.log(status.message);
  if (!config.publicBaseUrl) {
    console.log("Set PUBLIC_BASE_URL to your ngrok/deployed HTTPS URL before connecting Twilio.");
  }
});

const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (request, socket, head) => {
  if (request.url !== "/media-stream") {
    socket.destroy();
    return;
  }

  wss.handleUpgrade(request, socket, head, (ws) => {
    handleMediaStream(ws, request);
  });
});

process.on("SIGINT", () => {
  server.close(() => process.exit(0));
});
