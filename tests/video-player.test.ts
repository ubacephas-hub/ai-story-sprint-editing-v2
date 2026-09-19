import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import VideoPlayer, { getYouTubeFallbackUrl } from "../src/components/VideoPlayer";

const progress = {
  status: "in_progress",
  playbackPositionSeconds: 12,
  furthestPositionSeconds: 12,
  durationSeconds: 120,
  watchedSeconds: 12,
  percentComplete: 10,
};

const youtubeProps = {
  lessonId: 7,
  videoKind: "youtube",
  videoSource: "https://youtu.be/dQw4w9WgXcQ?t=42",
  lessonTitle: "A YouTube lesson",
  initialProgress: progress,
};

test("YouTube rendering keeps the responsive wrapper and inner API target", () => {
  const markup = renderToStaticMarkup(createElement(VideoPlayer, youtubeProps));

  assert.match(markup, /class="video-container"/);
  assert.match(markup, /class="youtube-player-target"/);
  assert.match(markup, /Loading video/);
  assert.doesNotMatch(markup, /ref=/);
});

test("YouTube fallback is restricted to the no-cookie embed host", () => {
  const fallbackUrl = getYouTubeFallbackUrl("dQw4w9WgXcQ");
  assert.equal(
    fallbackUrl,
    "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=0&enablejsapi=1&modestbranding=1&playsinline=1&rel=0"
  );
});

test("direct MP4 and HLS sources still render as video sources", () => {
  const mp4 = renderToStaticMarkup(
    createElement(VideoPlayer, {
      lessonId: 8,
      videoKind: "upload",
      videoSource: "https://cdn.example.test/lesson.mp4",
      lessonTitle: "Direct video",
    })
  );
  const hls = renderToStaticMarkup(
    createElement(VideoPlayer, {
      lessonId: 9,
      videoKind: "url",
      videoSource: "https://cdn.example.test/lesson.m3u8",
      lessonTitle: "HLS video",
    })
  );

  assert.match(mp4, /<video[^>]+controls/);
  assert.match(mp4, /src="https:\/\/cdn\.example\.test\/lesson\.mp4"/);
  assert.match(hls, /src="https:\/\/cdn\.example\.test\/lesson\.m3u8"/);
  assert.match(hls, /application\/x-mpegURL/);
});

test("player iframe and target styles fill the nonzero responsive wrapper", () => {
  const css = readFileSync(resolve("src/app/globals.css"), "utf8");

  assert.match(css, /\.video-container\s*\{[\s\S]*?padding-bottom:\s*56\.25%/);
  assert.match(
    css,
    /\.video-container iframe,[\s\S]*?width:\s*100%;[\s\S]*?height:\s*100%/,
  );
  assert.match(css, /\.youtube-player-target iframe,[\s\S]*?inset:\s*0/);
});

test("progress requests stay same-origin and use the shared throttle", () => {
  const source = readFileSync(resolve("src/components/VideoPlayer.tsx"), "utf8");

  assert.match(source, /fetch\("\/api\/progress"/);
  assert.match(source, /credentials:\s*"same-origin"/);
  assert.match(source, /keepalive/);
  assert.match(source, /PLAYBACK_SAVE_INTERVAL_MS/);
  assert.match(source, /if \(!force && now - lastSaveAtRef\.current < PLAYBACK_SAVE_INTERVAL_MS\)/);
});
