const LOCATION_HINT_PATTERNS = [
  /at\s+([^.,;!?]+)/i,
  /near\s+([^.,;!?]+)/i,
  /in\s+([^.,;!?]+)/i,
  /(?:@|location:?)\s*([^.,;!?]+)/i,
];

const NEED_TYPE_PATTERNS = [
  { pattern: /water/i, type: "Water" },
  { pattern: /food|hungry|meal/i, type: "Food" },
  { pattern: /medical|medicine|doctor|injured|sick|health/i, type: "Medical" },
  { pattern: /rescue|trapped|stuck|help|emergency/i, type: "Rescue" },
];

const URGENCY_PATTERNS = [
  { pattern: /urgent|emergency|immediately|asap|critical/i, level: "High" },
  { pattern: /soon|important/i, level: "Medium" },
];

export function extractLocationHint(text = "") {
  for (const pattern of LOCATION_HINT_PATTERNS) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return null;
}

function extractNeedType(text = "") {
  for (const { pattern, type } of NEED_TYPE_PATTERNS) {
    if (pattern.test(text)) {
      return type;
    }
  }
  return "Other";
}

function extractUrgency(text = "") {
  for (const { pattern, level } of URGENCY_PATTERNS) {
    if (pattern.test(text)) {
      return level;
    }
  }
  return "Medium";
}

export function fallbackTriage(rawMessage) {
  const location = extractLocationHint(rawMessage);
  return {
    needType: extractNeedType(rawMessage),
    location: location || "Unknown",
    details: rawMessage,
    urgency: extractUrgency(rawMessage),
  };
}
