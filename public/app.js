const statusText = document.querySelector("#server-status");
const pulse = document.querySelector(".pulse");
const eventsContainer = document.querySelector("#events");
const clearButton = document.querySelector("#clear-events");
const voiceUrl = document.querySelector("#voice-url");
const startBrowserCall = document.querySelector("#start-browser-call");
const stopBrowserCall = document.querySelector("#stop-browser-call");
const browserCallStatus = document.querySelector("#browser-call-status");
const remoteAudio = document.querySelector("#remote-audio");

let visibleEvents = [];
let peerConnection = null;
let localStream = null;
let dataChannel = null;

function renderEvents() {
  if (visibleEvents.length === 0) {
    eventsContainer.innerHTML = '<p class="empty">No call events yet. Place a test call to begin.</p>';
    return;
  }

  eventsContainer.innerHTML = visibleEvents
    .slice(0, 40)
    .map((event) => {
      const message = event.text || event.message || event.callSid || "";
      return `
        <article class="event">
          <time>${new Date(event.at || Date.now()).toLocaleTimeString()}</time>
          <div>
            <strong>${event.type}</strong>
            ${message ? `<p>${message}</p>` : ""}
          </div>
        </article>
      `;
    })
    .join("");
}

async function checkHealth() {
  try {
    const response = await fetch("/health");
    const data = await response.json();
    statusText.textContent = data.ok ? `Ready (${data.model})` : data.message;
    pulse.classList.toggle("ok", data.ok);
  } catch {
    statusText.textContent = "Offline";
    pulse.classList.remove("ok");
  }
}

async function loadDemoConfig() {
  try {
    const response = await fetch("/api/config");
    const data = await response.json();
    voiceUrl.textContent = data.voiceWebhookUrl;
  } catch {
    voiceUrl.textContent = `${window.location.origin}/voice`;
  }
}

function addLocalEvent(type, message) {
  visibleEvents.unshift({
    type,
    at: new Date().toISOString(),
    message,
  });
  renderEvents();
}

function setBrowserCallState(status, active) {
  browserCallStatus.textContent = status;
  startBrowserCall.disabled = active;
  stopBrowserCall.disabled = !active;
}

async function startBrowserVoiceDemo() {
  setBrowserCallState("Connecting", true);

  try {
    const tokenResponse = await fetch("/api/realtime-token");
    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      throw new Error(tokenData.error || "Could not create realtime token");
    }

    const clientSecret = tokenData.value;
    if (!clientSecret) {
      throw new Error("Realtime token response did not include a client secret");
    }

    peerConnection = new RTCPeerConnection();
    dataChannel = peerConnection.createDataChannel("oai-events");

    const sendGreeting = () => {
      if (dataChannel?.readyState !== "open") return;
      dataChannel.send(
        JSON.stringify({
          type: "response.create",
          response: {
            instructions:
              "Greet the caller warmly in one short sentence, then ask how you can help today.",
          },
        })
      );
    };

    dataChannel.addEventListener("open", sendGreeting);
    dataChannel.addEventListener("message", (message) => {
      const event = JSON.parse(message.data);

      if (event.type === "session.updated") {
        sendGreeting();
      }

      if (event.type === "input_audio_buffer.speech_started") {
        addLocalEvent("browser.caller.speaking", "Microphone speech detected");
      }

      if (event.type === "response.output_audio_transcript.done") {
        addLocalEvent("browser.assistant", event.transcript);
      }

      if (event.type === "error") {
        addLocalEvent("browser.error", event.error?.message || "Realtime error");
      }
    });

    peerConnection.ontrack = (event) => {
      remoteAudio.srcObject = event.streams[0];
    };

    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    for (const track of localStream.getTracks()) {
      peerConnection.addTrack(track, localStream);
    }

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    const realtimeResponse = await fetch("https://api.openai.com/v1/realtime/calls", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${clientSecret}`,
        "Content-Type": "application/sdp",
      },
      body: offer.sdp,
    });

    if (!realtimeResponse.ok) {
      throw new Error(await realtimeResponse.text());
    }

    const answer = {
      type: "answer",
      sdp: await realtimeResponse.text(),
    };
    await peerConnection.setRemoteDescription(answer);

    setBrowserCallState("Live", true);
    addLocalEvent("browser.call.started", "Browser voice demo is live");
  } catch (error) {
    stopBrowserVoiceDemo();
    setBrowserCallState("Error", false);
    addLocalEvent("browser.error", error.message);
  }
}

function stopBrowserVoiceDemo() {
  dataChannel?.close();
  peerConnection?.close();
  localStream?.getTracks().forEach((track) => track.stop());

  dataChannel = null;
  peerConnection = null;
  localStream = null;
  remoteAudio.srcObject = null;

  setBrowserCallState("Idle", false);
  addLocalEvent("browser.call.ended", "Browser voice demo ended");
}

clearButton.addEventListener("click", () => {
  visibleEvents = [];
  renderEvents();
});

startBrowserCall.addEventListener("click", startBrowserVoiceDemo);
stopBrowserCall.addEventListener("click", stopBrowserVoiceDemo);

const source = new EventSource("/events");
source.onmessage = (message) => {
  const event = JSON.parse(message.data);

  if (event.type === "snapshot") {
    visibleEvents = event.events || [];
  } else {
    visibleEvents.unshift(event);
  }

  renderEvents();
};

source.onerror = () => {
  visibleEvents.unshift({
    type: "dashboard.disconnected",
    at: new Date().toISOString(),
    message: "Live dashboard stream disconnected.",
  });
  renderEvents();
};

loadDemoConfig();
checkHealth();
setInterval(checkHealth, 8000);
renderEvents();
