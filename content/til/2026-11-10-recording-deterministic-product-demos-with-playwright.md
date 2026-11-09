---
title: "Recording Deterministic Product Demos as Code with Playwright"
date: 2026-11-10
draft: false
summary: "Screen-recording a live UI and CLI demo takes five takes because you mistype a command or hit a slow network call. Here is how to script repeatable, single-take product demos with Playwright and FFmpeg."
tags: ["playwright", "tooling", "automation"]
---

Screen-recording a live product demo usually takes five takes. On take one you mistype a CLI flag, on take two a background notification slides into the corner, and on take three a slow network call leaves you stalling for four seconds. Editing the mistakes out in a timeline editor works once, right up until the UI changes the next morning and you have to re-record the whole thing from scratch.

Treating the demo as an executable Playwright script fixes this. When a button label changes or you want to tighten the pacing by two seconds, you edit a few lines of JavaScript and re-run the script to get a clean MP4. I'll keep it concise and to the point. Here is the setup that actually makes scripted browser and terminal demos look like a human recorded them.

## 1. Lock the Viewport and Enable Context-Level Video Capture

Playwright's `recordVideo` option on `browser.newContext()` records frames directly from the headless Chromium compositor. Lock `viewport` and `recordVideo.size` to the exact same dimensions so Chromium never downscales or blurs text:

```javascript
const { chromium } = require('playwright');

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  recordVideo: {
    dir: './videos',
    size: { width: 1440, height: 900 },
  },
});

const page = await context.newPage();
```

One gotcha that bites everyone the first time: the WebM video file is not finalized until `await context.close()` resolves. If your script exits early or only closes the page, the output file will be truncated or zero bytes.

## 2. Humanize Typing Cadence and Scene Pacing

By default, Playwright executes actions as fast as the DOM can settle. `await locator.fill('production-cluster')` teleports text into an input field in a single frame, which looks jarring and unnatural in a product video.

Use `pressSequentially` with a 50-85ms keystroke delay so viewers can watch fields populate at human typing speed, and pair it with deliberate holds after navigation or state changes so the viewer's eyes can register what just happened:

```javascript
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const nameInput = page.getByLabel('Service name');
await nameInput.click();
await nameInput.pressSequentially('payments-api', { delay: 70 });
await sleep(1200);

await page.getByRole('button', { name: 'Save configuration' }).click();
await page.locator('.toast-success').waitFor({ state: 'visible' });
await sleep(3000); // Hold so the viewer can actually read the confirmation
```

## 3. Keep Browser and Terminal Workflows in a Single Tab

Many developer tools bounce between a web dashboard and a CLI. If you record the browser with Playwright and the terminal with a separate screen recorder, splicing the two clips together at the exact millisecond a CLI command triggers a UI state change is painful.

A cleaner trick is rendering a full-screen terminal overlay (`position: fixed; inset: 0; z-index: 2147483640`) directly inside the recorded page via `page.evaluate()`, and streaming real `child_process.spawn` stdout and stderr lines into that DOM container:

```javascript
const { spawn } = require('child_process');

async function streamCommandToOverlay(page, displayCmd, bin, args) {
  // Type the command character-by-character in the DOM terminal overlay
  for (const ch of displayCmd) {
    await page.evaluate((c) => {
      document.getElementById('active-cmd').textContent += c;
    }, ch);
    await new Promise((r) => setTimeout(r, 25));
  }

  // Spawn the real CLI binary and stream each output line into the overlay
  return new Promise((resolve) => {
    const child = spawn(bin, args);
    child.stdout.on('data', async (chunk) => {
      for (const line of chunk.toString().split('\n').filter(Boolean)) {
        await page.evaluate((text) => {
          const row = document.createElement('div');
          row.textContent = text;
          const body = document.getElementById('term-body');
          body.appendChild(row);
          body.scrollTop = body.scrollHeight;
        }, line);
      }
    });
    child.on('close', (code) => resolve(code));
  });
}
```

Because the terminal overlay lives inside the same Chromium tab, toggling between the web UI and the CLI feels like an instant `Cmd+Tab`, preserves scrollback history across scenes, and stays in a single continuous video stream. You can use the same `page.evaluate()` pattern to pin a small bottom-right stage caption card that updates on each scene so viewers can follow the narrative even with the sound muted.

## 4. Debug Flaky Takes with `trace.zip` Instead of Re-Watching Video

When a 90-second demo script fails at second 74 because a modal animation was still fading in, watching the broken WebM video only tells you *that* the click missed. Wrapping the run in Playwright's Tracer gives you time-travel debugging:

```javascript
await context.tracing.start({ screenshots: true, snapshots: true });
try {
  await runDemoScenes(page);
} finally {
  await context.tracing.stop({ path: 'trace.zip' });
  await context.close();
  await browser.close();
}
```

Opening `npx playwright show-trace trace.zip` lets you scrub millisecond by millisecond through full DOM snapshots (not flat screenshots, actual inspectable HTML), network waterfalls, and console logs right before and after the failed step. Once you see the exact selector state or slow API response, you replace a brittle sleep with an explicit `waitFor({ state: 'visible' })`.

## 5. Transcode WebM to Crisp MP4 and Composite Webcam Overlays in Post

Playwright writes VP8/VP9 `.webm` files. Most social platforms, slide decks, and mobile browsers prefer H.264 `.mp4` with `yuv420p` pixel formatting and the `moov` atom moved to the front of the file:

```bash
ffmpeg -y -i raw-demo.webm \
  -c:v libx264 -preset veryfast -crf 18 \
  -pix_fmt yuv420p -movflags +faststart \
  product-demo.mp4
```

Separating the UI capture from the voiceover is the biggest quality-of-life win. Once the Playwright capture is deterministic and locked to exact timestamps, you can record your voiceover and webcam against the finished video and composite a circular Loom-style picture-in-picture bubble in a single FFmpeg pass using `alphamerge` and `overlay`. If you stumble on a sentence, you only re-record the audio track while the underlying UI demo stays pixel-perfect.
