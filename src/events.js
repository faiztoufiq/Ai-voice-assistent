const subscribers = new Set();
const recentEvents = [];
const maxEvents = 80;

export function emitDemoEvent(type, data = {}) {
  const event = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    at: new Date().toISOString(),
    type,
    ...data,
  };

  recentEvents.unshift(event);
  recentEvents.splice(maxEvents);

  for (const response of subscribers) {
    response.write(`data: ${JSON.stringify(event)}\n\n`);
  }
}

export function getRecentEvents() {
  return recentEvents;
}

export function addEventSubscriber(response) {
  subscribers.add(response);
  response.write(`data: ${JSON.stringify({ type: "snapshot", events: recentEvents })}\n\n`);

  return () => subscribers.delete(response);
}
