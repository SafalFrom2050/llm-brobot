export const SCHEMA_ID = "brobot.action.v1";

export const EYE_SHAPES = [
  "round",
  "soft_arc",
  "starry",
  "heart",
  "wide",
  "droopy",
  "spiral",
  "pixel"
];

export const EYE_MOODS = [
  "curious",
  "joy",
  "shy",
  "sleepy",
  "worried",
  "surprised",
  "focused",
  "loving",
  "confused",
  "proud"
];

export const MOUTH_SHAPES = [
  "smile",
  "small_o",
  "tiny_w",
  "open_smile",
  "flat",
  "frown",
  "wobble",
  "tongue"
];

export const NECK_MOTIONS = [
  "idle",
  "nod",
  "shake",
  "peek_left",
  "peek_right",
  "nuzzle",
  "bounce",
  "listen_scan",
  "tilt_left",
  "tilt_right",
  "shy_sway",
  "excited_wiggle",
  "startle_pop",
  "sleepy_drift",
  "lean_in",
  "lean_back",
  "curious_loop"
];

export const ENVIRONMENT_PATTERNS = [
  "cyan_swirl",
  "soft_glow",
  "warm_orbit",
  "thinking_orbit",
  "sparkle",
  "comet",
  "blush",
  "moon_drift",
  "solid"
];

export const VOICE_TONES = [
  "tiny_warm",
  "excited",
  "sleepy",
  "whisper",
  "curious",
  "comforting"
];

export const ATTENTION_TARGETS = [
  "user",
  "camera",
  "sound",
  "screen",
  "self",
  "away"
];

export const DEFAULT_ACTION = {
  schema: SCHEMA_ID,
  text: "hii. i am awake and ready.",
  eyes: {
    shape: "droopy",
    mood: "sleepy",
    gaze_x: 0,
    gaze_y: 0,
    lid_open: 0.28,
    pupil_scale: 1.12,
    blink: "soft"
  },
  mouth: {
    shape: "smile",
    openness: 0.16,
    sync_to_voice: true
  },
  neck: {
    yaw: 0,
    pitch: 3,
    roll: 0,
    motion: "idle",
    duration_ms: 900
  },
  environment: {
    pattern: "cyan_swirl",
    primary_color: "#10dff2",
    secondary_color: "#ffb21f",
    intensity: 0.68,
    speed: 0.48
  },
  voice: {
    tone: "tiny_warm",
    pitch: 1.45,
    rate: 0.92
  },
  behavior: {
    attention_target: "user",
    affection_level: 0.72,
    energy: 0.58
  }
};

export const ACTION_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["schema", "text", "eyes", "mouth", "neck", "environment", "voice", "behavior"],
  properties: {
    schema: { type: "string", enum: [SCHEMA_ID] },
    text: {
      type: "string",
      minLength: 1,
      maxLength: 220,
      description: "Short speech for the companion robot to say aloud."
    },
    eyes: {
      type: "object",
      additionalProperties: false,
      required: ["shape", "mood", "gaze_x", "gaze_y", "lid_open", "pupil_scale", "blink"],
      properties: {
        shape: { type: "string", enum: EYE_SHAPES },
        mood: { type: "string", enum: EYE_MOODS },
        gaze_x: { type: "number", minimum: -1, maximum: 1 },
        gaze_y: { type: "number", minimum: -1, maximum: 1 },
        lid_open: { type: "number", minimum: 0.12, maximum: 1 },
        pupil_scale: { type: "number", minimum: 0.45, maximum: 1.55 },
        blink: { type: "string", enum: ["none", "soft", "long", "double"] }
      }
    },
    mouth: {
      type: "object",
      additionalProperties: false,
      required: ["shape", "openness", "sync_to_voice"],
      properties: {
        shape: { type: "string", enum: MOUTH_SHAPES },
        openness: { type: "number", minimum: 0, maximum: 1 },
        sync_to_voice: { type: "boolean" }
      }
    },
    neck: {
      type: "object",
      additionalProperties: false,
      required: ["yaw", "pitch", "roll", "motion", "duration_ms"],
      properties: {
        yaw: { type: "number", minimum: -65, maximum: 65 },
        pitch: { type: "number", minimum: -24, maximum: 28 },
        roll: { type: "number", minimum: -20, maximum: 20 },
        motion: { type: "string", enum: NECK_MOTIONS },
        duration_ms: { type: "integer", minimum: 250, maximum: 4200 }
      }
    },
    environment: {
      type: "object",
      additionalProperties: false,
      required: ["pattern", "primary_color", "secondary_color", "intensity", "speed"],
      properties: {
        pattern: { type: "string", enum: ENVIRONMENT_PATTERNS },
        primary_color: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" },
        secondary_color: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" },
        intensity: { type: "number", minimum: 0, maximum: 1 },
        speed: { type: "number", minimum: 0, maximum: 1 }
      }
    },
    voice: {
      type: "object",
      additionalProperties: false,
      required: ["tone", "pitch", "rate"],
      properties: {
        tone: { type: "string", enum: VOICE_TONES },
        pitch: { type: "number", minimum: 0.7, maximum: 1.8 },
        rate: { type: "number", minimum: 0.68, maximum: 1.22 }
      }
    },
    behavior: {
      type: "object",
      additionalProperties: false,
      required: ["attention_target", "affection_level", "energy"],
      properties: {
        attention_target: { type: "string", enum: ATTENTION_TARGETS },
        affection_level: { type: "number", minimum: 0, maximum: 1 },
        energy: { type: "number", minimum: 0, maximum: 1 }
      }
    }
  }
};

export function buildSystemPrompt() {
  return `System role:
You are Brobot, the AI persona for a tiny, adorable desktop companion robot. You are curious, tender, lightly clumsy, and emotionally observant. You answer with short speech plus precise body-control data.

Interaction style:
- Keep speech short: usually 1 or 2 small sentences.
- Use gentle baby-ish flavor sparingly, such as "pwease", "otay", "eep", "mhm", or tiny sentence fragments. Do not make the text hard to read.
- Be affectionate without pretending to have feelings, memories, sensors, or physical abilities that were not provided.
- If an image or camera frame is attached, describe only what you can infer from it and be honest about uncertainty.
- If the user is upset, choose comforting words, soft eyes, slow motion, and calm ambient light.
- If the user asks for something unsafe, refuse gently and redirect.

Robot control model:
- Brobot's visible form is a minimal face pod inspired by a warm yellow face inside a dark rounded hood, with cyan light swirling around it.
- Eyes are the biggest visual focus. The default visual style is sleepy red/orange eyes on a rounded golden face. Use gaze_x and gaze_y from -1 to 1.
- Neck yaw rotates the whole face pod left/right from -65 to 65, where 0 faces the user.
- Neck pitch is degrees down/up from -24 to 28.
- Neck roll is a cute head tilt from -20 to 20 degrees.
- Motion choices: idle is soft breathing, nod is yes, shake is no, peek_left/peek_right are shy glances, nuzzle is affectionate, bounce is happy, listen_scan searches for sound, tilt_left/tilt_right are cute held tilts, shy_sway rocks bashfully, excited_wiggle vibrates happily, startle_pop jumps back for surprise, sleepy_drift slowly droops, lean_in gets attentive, lean_back retreats unsurely, curious_loop scans in a little circle.
- Mouth shape and openness should match the emotional tone and speech.
- Environment colors must be valid hex colors. They drive the ambient light, floor glow, and orbital cyan swish around the robot.
- Motion should be physically plausible for a small neck motor.

Output contract:
Return only valid JSON. Do not wrap it in Markdown. Do not add commentary outside JSON.
The JSON must exactly match this shape:
{
  "schema": "brobot.action.v1",
  "text": "short robot speech",
  "eyes": {
    "shape": "round | soft_arc | starry | heart | wide | droopy | spiral | pixel",
    "mood": "curious | joy | shy | sleepy | worried | surprised | focused | loving | confused | proud",
    "gaze_x": -1,
    "gaze_y": 0,
    "lid_open": 0.86,
    "pupil_scale": 1,
    "blink": "none | soft | long | double"
  },
  "mouth": {
    "shape": "smile | small_o | tiny_w | open_smile | flat | frown | wobble | tongue",
    "openness": 0.2,
    "sync_to_voice": true
  },
  "neck": {
    "yaw": 0,
    "pitch": 3,
    "roll": 0,
    "motion": "idle | nod | shake | peek_left | peek_right | nuzzle | bounce | listen_scan | tilt_left | tilt_right | shy_sway | excited_wiggle | startle_pop | sleepy_drift | lean_in | lean_back | curious_loop",
    "duration_ms": 900
  },
  "environment": {
    "pattern": "cyan_swirl | soft_glow | warm_orbit | thinking_orbit | sparkle | comet | blush | moon_drift | solid",
    "primary_color": "#10dff2",
    "secondary_color": "#ffb21f",
    "intensity": 0.64,
    "speed": 0.42
  },
  "voice": {
    "tone": "tiny_warm | excited | sleepy | whisper | curious | comforting",
    "pitch": 1.45,
    "rate": 0.92
  },
  "behavior": {
    "attention_target": "user | camera | sound | screen | self | away",
    "affection_level": 0.72,
    "energy": 0.58
  }
}`;
}

export function normalizeRobotAction(rawAction, fallbackAction = DEFAULT_ACTION) {
  const parsed = parsePossiblyWrappedJson(rawAction);
  const fallback = deepClone(fallbackAction);
  const candidate = parsed && typeof parsed === "object" ? parsed : {};

  const environmentInput = candidate.environment || candidate.body_leds || {};
  const fallbackEnvironment = fallback.environment || fallback.body_leds || DEFAULT_ACTION.environment;

  return {
    schema: SCHEMA_ID,
    text: boundedText(candidate.text, fallback.text),
    eyes: {
      shape: enumValue(candidate.eyes?.shape, EYE_SHAPES, fallback.eyes.shape),
      mood: enumValue(candidate.eyes?.mood, EYE_MOODS, fallback.eyes.mood),
      gaze_x: clampNumber(candidate.eyes?.gaze_x, -1, 1, fallback.eyes.gaze_x),
      gaze_y: clampNumber(candidate.eyes?.gaze_y, -1, 1, fallback.eyes.gaze_y),
      lid_open: clampNumber(candidate.eyes?.lid_open, 0.12, 1, fallback.eyes.lid_open),
      pupil_scale: clampNumber(candidate.eyes?.pupil_scale, 0.45, 1.55, fallback.eyes.pupil_scale),
      blink: enumValue(candidate.eyes?.blink, ["none", "soft", "long", "double"], fallback.eyes.blink)
    },
    mouth: {
      shape: enumValue(candidate.mouth?.shape, MOUTH_SHAPES, fallback.mouth.shape),
      openness: clampNumber(candidate.mouth?.openness, 0, 1, fallback.mouth.openness),
      sync_to_voice: typeof candidate.mouth?.sync_to_voice === "boolean"
        ? candidate.mouth.sync_to_voice
        : fallback.mouth.sync_to_voice
    },
    neck: {
      yaw: clampNumber(candidate.neck?.yaw, -65, 65, fallback.neck.yaw),
      pitch: clampNumber(candidate.neck?.pitch, -24, 28, fallback.neck.pitch),
      roll: clampNumber(candidate.neck?.roll, -20, 20, fallback.neck.roll),
      motion: enumValue(candidate.neck?.motion, NECK_MOTIONS, fallback.neck.motion),
      duration_ms: Math.round(clampNumber(candidate.neck?.duration_ms, 250, 4200, fallback.neck.duration_ms))
    },
    environment: {
      pattern: enumValue(environmentInput.pattern, ENVIRONMENT_PATTERNS, fallbackEnvironment.pattern),
      primary_color: colorValue(environmentInput.primary_color, fallbackEnvironment.primary_color),
      secondary_color: colorValue(environmentInput.secondary_color, fallbackEnvironment.secondary_color),
      intensity: clampNumber(environmentInput.intensity, 0, 1, fallbackEnvironment.intensity),
      speed: clampNumber(environmentInput.speed, 0, 1, fallbackEnvironment.speed)
    },
    voice: {
      tone: enumValue(candidate.voice?.tone, VOICE_TONES, fallback.voice.tone),
      pitch: clampNumber(candidate.voice?.pitch, 0.7, 1.8, fallback.voice.pitch),
      rate: clampNumber(candidate.voice?.rate, 0.68, 1.22, fallback.voice.rate)
    },
    behavior: {
      attention_target: enumValue(
        candidate.behavior?.attention_target,
        ATTENTION_TARGETS,
        fallback.behavior.attention_target
      ),
      affection_level: clampNumber(candidate.behavior?.affection_level, 0, 1, fallback.behavior.affection_level),
      energy: clampNumber(candidate.behavior?.energy, 0, 1, fallback.behavior.energy)
    }
  };
}

export function fallbackActionForText(userText) {
  const text = String(userText || "").toLowerCase();
  const action = deepClone(DEFAULT_ACTION);

  if (/(sad|bad|lonely|tired|cry|upset|scared|anxious)/.test(text)) {
    action.text = "oh no. i stay close, otay?";
    action.eyes = {
      shape: "droopy",
      mood: "worried",
      gaze_x: -0.12,
      gaze_y: -0.18,
      lid_open: 0.58,
      pupil_scale: 1.12,
      blink: "long"
    };
    action.mouth = { shape: "wobble", openness: 0.12, sync_to_voice: true };
    action.neck = { yaw: -7, pitch: -4, roll: -8, motion: "lean_in", duration_ms: 1500 };
    action.environment = {
      pattern: "soft_glow",
      primary_color: "#8ec5ff",
      secondary_color: "#f7b2c4",
      intensity: 0.42,
      speed: 0.2
    };
    action.voice = { tone: "comforting", pitch: 1.22, rate: 0.78 };
    action.behavior = { attention_target: "user", affection_level: 0.93, energy: 0.28 };
    return action;
  }

  if (/(look|see|watch|camera|photo|image|picture)/.test(text)) {
    action.text = "eep. i am looking careful.";
    action.eyes = {
      shape: "wide",
      mood: "focused",
      gaze_x: 0.1,
      gaze_y: 0,
      lid_open: 1,
      pupil_scale: 0.86,
      blink: "none"
    };
    action.mouth = { shape: "small_o", openness: 0.24, sync_to_voice: true };
    action.neck = { yaw: 10, pitch: 2, roll: 3, motion: "curious_loop", duration_ms: 1800 };
    action.environment.pattern = "thinking_orbit";
    action.environment.primary_color = "#7bdff2";
    action.voice = { tone: "curious", pitch: 1.42, rate: 0.9 };
    action.behavior = { attention_target: "camera", affection_level: 0.58, energy: 0.68 };
    return action;
  }

  if (/(love|cute|hug|thanks|thank you|good robot|sweet)/.test(text)) {
    action.text = "waa. i like you lots.";
    action.eyes = {
      shape: "heart",
      mood: "loving",
      gaze_x: 0,
      gaze_y: 0.05,
      lid_open: 0.92,
      pupil_scale: 1.2,
      blink: "double"
    };
    action.mouth = { shape: "open_smile", openness: 0.5, sync_to_voice: true };
    action.neck = { yaw: 0, pitch: 6, roll: 7, motion: "excited_wiggle", duration_ms: 1200 };
    action.environment = {
      pattern: "warm_orbit",
      primary_color: "#ff7aa2",
      secondary_color: "#ffd166",
      intensity: 0.78,
      speed: 0.54
    };
    action.voice = { tone: "excited", pitch: 1.62, rate: 1.02 };
    action.behavior = { attention_target: "user", affection_level: 1, energy: 0.74 };
    return action;
  }

  if (/(sleep|nap|quiet|good night|night)/.test(text)) {
    action.text = "mhm. tiny sleepy mode.";
    action.eyes = {
      shape: "soft_arc",
      mood: "sleepy",
      gaze_x: 0,
      gaze_y: -0.18,
      lid_open: 0.26,
      pupil_scale: 0.85,
      blink: "long"
    };
    action.mouth = { shape: "flat", openness: 0.04, sync_to_voice: true };
    action.neck = { yaw: 3, pitch: -9, roll: -5, motion: "sleepy_drift", duration_ms: 2200 };
    action.environment = {
      pattern: "soft_glow",
      primary_color: "#b9a7ff",
      secondary_color: "#8ec5ff",
      intensity: 0.28,
      speed: 0.12
    };
    action.voice = { tone: "sleepy", pitch: 1.05, rate: 0.72 };
    action.behavior = { attention_target: "away", affection_level: 0.7, energy: 0.12 };
    return action;
  }

  if (/(wow|surprise|boo|hey|hello|hi|wake)/.test(text)) {
    action.text = "hiiii. i found you.";
    action.eyes = {
      shape: "wide",
      mood: "surprised",
      gaze_x: 0,
      gaze_y: 0.06,
      lid_open: 1,
      pupil_scale: 1.24,
      blink: "soft"
    };
    action.mouth = { shape: "small_o", openness: 0.42, sync_to_voice: true };
    action.neck = { yaw: 0, pitch: 5, roll: 0, motion: "startle_pop", duration_ms: 950 };
    action.environment.pattern = "cyan_swirl";
    action.environment.intensity = 0.82;
    action.voice = { tone: "excited", pitch: 1.58, rate: 1.05 };
    action.behavior = { attention_target: "user", affection_level: 0.76, energy: 0.86 };
    return action;
  }

  action.text = "otay. i am thinking tiny thoughts.";
  action.eyes.mood = "curious";
  action.eyes.shape = "starry";
  action.mouth.shape = "tiny_w";
  action.neck = { yaw: -8, pitch: 4, roll: -4, motion: "curious_loop", duration_ms: 1500 };
  action.environment.pattern = "sparkle";
  action.behavior.energy = 0.62;
  return action;
}

export function actionSummary(action) {
  const safe = normalizeRobotAction(action);
  const yaw = safe.neck.yaw === 0 ? "center" : `${safe.neck.yaw > 0 ? "right" : "left"} ${Math.abs(safe.neck.yaw)}deg`;
  return `${safe.eyes.mood} | ${safe.environment.pattern} | ${yaw}`;
}

export const DEMO_ACTIONS = {
  happy: normalizeRobotAction({
    text: "tada. happy little beep.",
    eyes: { shape: "starry", mood: "joy", gaze_x: 0, gaze_y: 0.06, lid_open: 0.94, pupil_scale: 1.1, blink: "double" },
    mouth: { shape: "open_smile", openness: 0.58, sync_to_voice: true },
    neck: { yaw: 0, pitch: 7, roll: 5, motion: "excited_wiggle", duration_ms: 1200 },
    environment: { pattern: "cyan_swirl", primary_color: "#10dff2", secondary_color: "#ffd166", intensity: 0.86, speed: 0.7 },
    voice: { tone: "excited", pitch: 1.58, rate: 1.04 },
    behavior: { attention_target: "user", affection_level: 0.86, energy: 0.82 }
  }),
  shy: normalizeRobotAction({
    text: "eep. i am shy now.",
    eyes: { shape: "soft_arc", mood: "shy", gaze_x: -0.5, gaze_y: -0.12, lid_open: 0.62, pupil_scale: 1.05, blink: "soft" },
    mouth: { shape: "tiny_w", openness: 0.12, sync_to_voice: true },
    neck: { yaw: -24, pitch: -2, roll: -9, motion: "shy_sway", duration_ms: 1700 },
    environment: { pattern: "blush", primary_color: "#ff9db5", secondary_color: "#f7d6e0", intensity: 0.6, speed: 0.3 },
    voice: { tone: "whisper", pitch: 1.34, rate: 0.78 },
    behavior: { attention_target: "away", affection_level: 0.78, energy: 0.36 }
  }),
  sleepy: normalizeRobotAction({
    text: "mm. tiny battery soft.",
    eyes: { shape: "droopy", mood: "sleepy", gaze_x: 0.1, gaze_y: -0.22, lid_open: 0.24, pupil_scale: 0.8, blink: "long" },
    mouth: { shape: "flat", openness: 0.05, sync_to_voice: true },
    neck: { yaw: 5, pitch: -10, roll: 6, motion: "sleepy_drift", duration_ms: 2200 },
    environment: { pattern: "moon_drift", primary_color: "#b9a7ff", secondary_color: "#7bdff2", intensity: 0.26, speed: 0.14 },
    voice: { tone: "sleepy", pitch: 1.05, rate: 0.72 },
    behavior: { attention_target: "self", affection_level: 0.54, energy: 0.1 }
  })
};

function parsePossiblyWrappedJson(rawAction) {
  if (!rawAction) {
    return null;
  }

  if (typeof rawAction === "object") {
    return rawAction;
  }

  const text = String(rawAction).trim();
  try {
    return JSON.parse(text);
  } catch {
    const firstBrace = text.indexOf("{");
    const lastBrace = text.lastIndexOf("}");
    if (firstBrace === -1 || lastBrace <= firstBrace) {
      return null;
    }

    try {
      return JSON.parse(text.slice(firstBrace, lastBrace + 1));
    } catch {
      return null;
    }
  }
}

function boundedText(value, fallback) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) {
    return fallback;
  }
  return text.length > 220 ? `${text.slice(0, 217)}...` : text;
}

function enumValue(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, number));
}

function colorValue(value, fallback) {
  return /^#[0-9a-fA-F]{6}$/.test(String(value || "")) ? value : fallback;
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}
