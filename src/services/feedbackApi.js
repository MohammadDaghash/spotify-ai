const FEEDBACK_EVENTS_ENDPOINT = "/api/feedback/events";

async function parseApiResponse(response) {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `Feedback API failed with ${response.status}`);
  }

  return data;
}

export async function syncFeedbackEvent(event) {
  const response = await fetch(FEEDBACK_EVENTS_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ event }),
  });

  return parseApiResponse(response);
}

export async function fetchServerFeedbackEvents(limit = 500) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 500, 1000));
  const response = await fetch(`${FEEDBACK_EVENTS_ENDPOINT}?limit=${safeLimit}`);

  return parseApiResponse(response);
}
