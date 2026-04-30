# Brobot Companion Lab

An Electron and Three.js prototype for a tiny companion robot driven by structured LLM output from a local Ollama server.

## What is implemented

- Electron desktop wrapper with a secure preload bridge.
- Minimal Three.js face pod with animated eyes, mouth, neck motion, and ambient environment lighting.
- Structured action schema for robot control.
- Ollama chat integration through `http://127.0.0.1:11434`.
- Text input, image upload, voice dictation when available, speech output, and low-fps camera snapshots.
- Local fallback behaviors when Ollama is offline.

## Run

```bash
npm install
npm run dev
```

If your model name is different, change it in the Model field inside the app. Vision inputs need a model that supports images in Ollama.

## Robot action shape

The LLM is prompted to output only valid JSON matching `brobot.action.v1`:

```json
{
  "schema": "brobot.action.v1",
  "text": "short robot speech",
  "eyes": {
    "shape": "round",
    "mood": "curious",
    "gaze_x": 0,
    "gaze_y": 0,
    "lid_open": 0.86,
    "pupil_scale": 1,
    "blink": "soft"
  },
  "mouth": {
    "shape": "smile",
    "openness": 0.16,
    "sync_to_voice": true
  },
  "neck": {
    "yaw": 0,
    "pitch": 3,
    "roll": 0,
    "motion": "idle",
    "duration_ms": 900
  },
  "environment": {
    "pattern": "cyan_swirl",
    "primary_color": "#10dff2",
    "secondary_color": "#ffb21f",
    "intensity": 0.64,
    "speed": 0.42
  },
  "voice": {
    "tone": "tiny_warm",
    "pitch": 1.45,
    "rate": 0.92
  },
  "behavior": {
    "attention_target": "user",
    "affection_level": 0.72,
    "energy": 0.58
  }
}
```
