# AI Voice Assistant Prototype

A simple, professional prototype for demoing a realtime AI phone assistant. A caller phones your Twilio number, Twilio streams the call audio to this app, the app bridges it to OpenAI Realtime, and the AI speaks back over the live call.

## Tech Stack

- Node.js + Express
- Twilio Programmable Voice + Media Streams
- OpenAI Realtime API
- WebSocket bridge with `ws`
- Static live demo dashboard

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create your env file:

   ```bash
   cp .env.example .env
   ```

3. Fill in `.env`:

   ```bash
   OPENAI_API_KEY=sk-...
   PUBLIC_BASE_URL=https://your-ngrok-url.ngrok-free.app
   BUSINESS_NAME=Your Client Name
   ASSISTANT_NAME=Ava
   ASSISTANT_PURPOSE=answer FAQs, collect lead details, and schedule callbacks
   ```

4. Start the server:

   ```bash
   npm run dev
   ```

5. Expose the server for Twilio:

   ```bash
   ngrok http 3000
   ```

6. In Twilio Console, set your phone number Voice webhook to:

   ```text
   https://your-ngrok-url.ngrok-free.app/voice
   ```

7. Open the dashboard:

   ```text
   http://localhost:3000
   ```

8. Call the Twilio number.

## Browser Demo Without Twilio

If Twilio, Plivo, or another phone provider blocks signup in your region, you can still demo realtime AI voice from the browser.

1. Add your OpenAI key to `.env`.

   ```bash
   OPENAI_API_KEY=sk-...
   ```

2. Start the app:

   ```bash
   npm run dev
   ```

3. Open:

   ```text
   http://localhost:3000
   ```

4. Click **Start Demo Call** in the Browser Voice Demo section.

5. Allow microphone permission, speak naturally, and the assistant will answer with voice.

This mode does not use a real phone number, but it shows the client the realtime AI conversation experience immediately.

## Useful Routes

- `GET /` - live demo dashboard
- `GET /health` - config and server health
- `GET /api/realtime-token` - short-lived browser Realtime token
- `POST /voice` - Twilio Voice webhook
- `GET /twiml` - preview generated TwiML
- `WS /media-stream` - Twilio bidirectional Media Stream
- `GET /events` - server-sent live events for the dashboard

## Demo Notes

For a client demo, keep the assistant focused. Update `BUSINESS_NAME` and `ASSISTANT_PURPOSE` in `.env` so it sounds tailored to the client without adding complexity.

Set `VERIFY_TWILIO_SIGNATURE=true` and `TWILIO_AUTH_TOKEN=...` when you want a more production-like public demo.
