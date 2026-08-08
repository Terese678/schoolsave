// Turns raw progress numbers into a short, warm nudge message using Backboard.
// Uses the "Send Message" endpoint directly, no pre-created assistant or thread needed.

const BACKBOARD_API_KEY = import.meta.env.VITE_BACKBOARD_API_KEY;

// Takes the goal's progress and returns a short nudge message for the parent.
export async function getPaceMessage({ savedBOT, targetBOT, secondsRemaining, label }) {
  const remaining = Math.max(targetBOT - savedBOT, 0);
  const pctDone = targetBOT > 0 ? Math.round((savedBOT / targetBOT) * 100) : 0;
  const daysRemaining = Math.max(Math.ceil(secondsRemaining / 86400), 0);

  // The pace math is done here, not left to the model, so the numbers in the message are always correct.
  const neededPerDay = daysRemaining > 0 ? (remaining / daysRemaining).toFixed(4) : remaining.toFixed(4);

  const promptContent = `A parent is saving toward "${label}". They have saved ${savedBOT} BOT of a ${targetBOT} BOT goal (${pctDone}% done), with ${daysRemaining} days left. To hit the goal in time, they would need to save about ${neededPerDay} BOT per day. Write one short, warm, encouraging sentence for them using these numbers, no more than two sentences, no emojis.`;

  const response = await fetch("https://app.backboard.io/api/threads/messages", {
    method: "POST",
    headers: {
      "X-API-Key": BACKBOARD_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content: promptContent,
      llm_provider: "anthropic",
      model_name: "claude-sonnet-4-6",
    }),
  });

  if (!response.ok) {
    // Falls back to a plain, honest message if the API call fails, so the app still works.
    return `You're ${pctDone}% of the way to "${label}". About ${neededPerDay} BOT a day gets you there on time.`;
  }

  const data = await response.json();
  return data.content;
}