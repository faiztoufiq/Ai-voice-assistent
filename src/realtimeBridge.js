import WebSocket from "ws";
import { config } from "./config.js";
import { buildInstructions } from "./prompt.js";
import { emitDemoEvent } from "./events.js";

const openAiUrl = () =>
  `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(config.realtimeModel)}`;

function safeSend(socket, payload) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload));
  }
}

function configureRealtime(openai) {
  safeSend(openai, {
    type: "session.update",
    session: {
      type: "realtime",
      instructions: buildInstructions(),
      output_modalities: ["audio"],
      audio: {
        input: {
          format: {
            type: "audio/pcmu",
          },
          turn_detection: {
            type: "server_vad",
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 650,
          },
        },
        output: {
          format: {
            type: "audio/pcmu",
          },
          voice: config.realtimeVoice,
        },
      },
    },
  });
}

function requestGreeting(openai) {
  safeSend(openai, {
    type: "response.create",
    response: {
      instructions:
        "Greet the caller warmly in one short sentence, then ask how you can help today.",
    },
  });
}

export function handleMediaStream(twilioSocket, request) {
  let streamSid = null;
  let callSid = null;
  let openaiReady = false;
  const pendingAudio = [];

  const openai = new WebSocket(openAiUrl(), {
    headers: {
      Authorization: `Bearer ${config.openaiApiKey}`,
      "OpenAI-Safety-Identifier": "voice-demo-caller",
    },
  });

  emitDemoEvent("call.connecting", {
    message: "Incoming media stream connected",
    ip: request.socket.remoteAddress,
  });

  openai.on("open", () => {
    openaiReady = true;
    configureRealtime(openai);
    for (const audio of pendingAudio.splice(0)) {
      safeSend(openai, audio);
    }
    emitDemoEvent("ai.connected", { message: "Connected to OpenAI Realtime" });
  });

  openai.on("message", (raw) => {
    let event;
    try {
      event = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (event.type === "session.updated") {
      emitDemoEvent("ai.ready", { message: "Realtime session ready" });
      requestGreeting(openai);
      return;
    }

    if (event.type === "response.output_audio.delta" && event.delta && streamSid) {
      safeSend(twilioSocket, {
        event: "media",
        streamSid,
        media: {
          payload: event.delta,
        },
      });
      return;
    }

    if (event.type === "input_audio_buffer.speech_started" && streamSid) {
      safeSend(twilioSocket, {
        event: "clear",
        streamSid,
      });
      safeSend(openai, { type: "response.cancel" });
      emitDemoEvent("caller.speaking", { message: "Caller started speaking" });
      return;
    }

    if (event.type === "conversation.item.input_audio_transcription.completed") {
      emitDemoEvent("transcript.caller", { text: event.transcript });
      return;
    }

    if (event.type === "response.output_audio_transcript.done") {
      emitDemoEvent("transcript.assistant", { text: event.transcript });
      return;
    }

    if (event.type === "error") {
      emitDemoEvent("ai.error", {
        message: event.error?.message || "OpenAI Realtime error",
        code: event.error?.code,
      });
    }
  });

  openai.on("close", () => {
    openaiReady = false;
    emitDemoEvent("ai.disconnected", { message: "OpenAI Realtime disconnected" });
    if (twilioSocket.readyState === WebSocket.OPEN) twilioSocket.close();
  });

  openai.on("error", (error) => {
    emitDemoEvent("ai.error", { message: error.message });
  });

  twilioSocket.on("message", (raw) => {
    let event;
    try {
      event = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (event.event === "start") {
      streamSid = event.start?.streamSid;
      callSid = event.start?.callSid;
      emitDemoEvent("call.started", {
        message: "Call media started",
        callSid,
        streamSid,
      });
      return;
    }

    if (event.event === "media" && event.media?.payload) {
      const audioEvent = {
        type: "input_audio_buffer.append",
        audio: event.media.payload,
      };

      if (openaiReady) {
        safeSend(openai, audioEvent);
      } else {
        pendingAudio.push(audioEvent);
      }
      return;
    }

    if (event.event === "stop") {
      emitDemoEvent("call.ended", {
        message: "Call media stopped",
        callSid,
      });
      if (openai.readyState === WebSocket.OPEN) openai.close();
    }
  });

  twilioSocket.on("close", () => {
    emitDemoEvent("call.disconnected", { message: "Twilio media stream disconnected", callSid });
    if (openai.readyState === WebSocket.OPEN) openai.close();
  });

  twilioSocket.on("error", (error) => {
    emitDemoEvent("call.error", { message: error.message, callSid });
  });
}
