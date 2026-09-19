"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  displayPercentage,
  formatPlaybackTime,
  PLAYBACK_SAVE_INTERVAL_MS,
} from "@/lib/progress";
import { isYouTubeVideoId, parseYouTubeUrl } from "@/lib/youtube";

export interface PlaybackProgressData {
  status: string;
  playbackPositionSeconds: number;
  furthestPositionSeconds: number;
  durationSeconds: number | null;
  watchedSeconds: number;
  percentComplete: number;
}

interface VideoPlayerProps {
  lessonId: number;
  videoKind: string;
  videoSource: string | null;
  lessonTitle: string;
  initialProgress?: PlaybackProgressData | null;
}

type SaveEvent =
  | "play"
  | "progress"
  | "pause"
  | "seeked"
  | "ended"
  | "hidden"
  | "unmount";

interface ProgressPayload {
  event: SaveEvent;
  positionSeconds: number;
  durationSeconds: number | null;
  activelyPlaying: boolean;
}

type SaveState = "idle" | "saving" | "saved" | "error";

function normalizeProgress(
  progress: PlaybackProgressData | null | undefined
): PlaybackProgressData {
  return {
    status: progress?.status || "not_started",
    playbackPositionSeconds: Math.max(0, progress?.playbackPositionSeconds || 0),
    furthestPositionSeconds: Math.max(0, progress?.furthestPositionSeconds || 0),
    durationSeconds:
      progress?.durationSeconds && progress.durationSeconds > 0
        ? progress.durationSeconds
        : null,
    watchedSeconds: Math.max(0, progress?.watchedSeconds || 0),
    percentComplete: Math.min(
      100,
      Math.max(0, progress?.percentComplete || 0)
    ),
  };
}

function useProgressSender(
  lessonId: number,
  initialProgress: PlaybackProgressData | null | undefined
) {
  const [progress, setProgress] = useState(() => normalizeProgress(initialProgress));
  const progressRef = useRef(progress);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const mountedRef = useRef(true);
  const queueRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const send = useCallback(
    async (payload: ProgressPayload, keepalive: boolean) => {
      if (mountedRef.current && !keepalive) setSaveState("saving");
      try {
        const localProgress = progressRef.current;
        const requestProgress = {
          // The server derives all aggregate values. These fields make the
          // request self-describing for diagnostics without granting the
          // browser authority over completion or watched time.
          status: localProgress.status === "completed" ? "completed" : "in_progress",
          furthestPositionSeconds: Math.max(
            localProgress.furthestPositionSeconds,
            payload.positionSeconds
          ),
          watchedSeconds: localProgress.watchedSeconds,
          percentComplete: localProgress.percentComplete,
          timestamp: new Date().toISOString(),
        };
        const response = await fetch("/api/progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          keepalive,
          body: JSON.stringify({ lessonId, ...payload, ...requestProgress }),
        });
        if (!response.ok) throw new Error("Progress request failed");
        const data = await response.json();
        if (data.progress) {
          const nextProgress = normalizeProgress(data.progress);
          progressRef.current = nextProgress;
          if (mountedRef.current) {
            setProgress(nextProgress);
            setSaveState("saved");
          }
        }
      } catch {
        if (mountedRef.current && !keepalive) setSaveState("error");
      }
    },
    [lessonId]
  );

  const enqueue = useCallback(
    (payload: ProgressPayload, keepalive = false) => {
      if (keepalive) {
        // A final keepalive request starts immediately rather than waiting for
        // an earlier queued request during route changes/pagehide.
        void send(payload, true);
        return;
      }
      queueRef.current = queueRef.current.then(
        () => send(payload, false),
        () => send(payload, false)
      );
    },
    [send]
  );

  return { progress, saveState, enqueue };
}

function PlaybackPanel({
  progress,
  positionSeconds,
  durationSeconds,
  saveState,
}: {
  progress: PlaybackProgressData;
  positionSeconds: number;
  durationSeconds: number | null;
  saveState: SaveState;
}) {
  const percentage = Math.round(displayPercentage(progress));
  const statusLabel =
    progress.status === "completed"
      ? "Completed"
      : percentage > 0
        ? "In progress"
        : "Not started";
  const saveLabel =
    saveState === "saving"
      ? "Saving progress…"
      : saveState === "saved"
        ? "Progress saved"
        : saveState === "error"
          ? "Progress will retry"
          : progress.playbackPositionSeconds > 0
            ? "Resume position saved"
            : "Ready to track";

  return (
    <div className="playback-progress-panel" aria-live="polite">
      <div className="flex justify-between items-center gap-3 flex-wrap">
        <span className="text-sm font-semibold">{statusLabel}</span>
        <span className="text-sm text-[var(--muted)]">{saveLabel}</span>
      </div>
      <div className="flex justify-between items-center gap-3 mt-2 text-sm text-[var(--muted)]">
        <span>
          {formatPlaybackTime(positionSeconds)} / {formatPlaybackTime(durationSeconds)}
        </span>
        <strong className="text-[var(--brand)]">{percentage}% watched</strong>
      </div>
      <div className="progress-bar mt-2" role="progressbar" aria-valuenow={percentage} aria-valuemin={0} aria-valuemax={100}>
        <span className="progress-bar-fill" style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}

function usePlaybackState(
  lessonId: number,
  initialProgress: PlaybackProgressData | null | undefined
) {
  const sender = useProgressSender(lessonId, initialProgress);
  const { enqueue } = sender;
  const [positionSeconds, setPositionSeconds] = useState(
    () => normalizeProgress(initialProgress).playbackPositionSeconds
  );
  const [durationSeconds, setDurationSeconds] = useState<number | null>(
    () => normalizeProgress(initialProgress).durationSeconds
  );
  const positionRef = useRef(positionSeconds);
  const durationRef = useRef(durationSeconds);
  const lastSaveAtRef = useRef(0);
  const playingRef = useRef(false);

  const updatePosition = useCallback((position: number, duration: number | null) => {
    const safePosition = Number.isFinite(position) ? Math.max(0, position) : 0;
    const safeDuration = duration && Number.isFinite(duration) && duration > 0 ? duration : null;
    positionRef.current = safePosition;
    durationRef.current = safeDuration;
    setPositionSeconds(safePosition);
    if (safeDuration) setDurationSeconds(safeDuration);
  }, []);

  const saveSnapshot = useCallback(
    (
      event: SaveEvent,
      activelyPlaying: boolean,
      force = false,
      keepalive = false
    ) => {
      const now = Date.now();
      if (!force && now - lastSaveAtRef.current < PLAYBACK_SAVE_INTERVAL_MS) {
        return;
      }
      if (!keepalive) lastSaveAtRef.current = now;
      enqueue(
        {
          event,
          positionSeconds: positionRef.current,
          durationSeconds: durationRef.current,
          activelyPlaying,
        },
        keepalive
      );
    },
    [enqueue]
  );

  return {
    ...sender,
    positionSeconds,
    durationSeconds,
    positionRef,
    durationRef,
    playingRef,
    updatePosition,
    saveSnapshot,
  };
}

function DirectVideoPlayer({
  lessonId,
  videoSource,
  lessonTitle,
  initialProgress,
}: Omit<VideoPlayerProps, "videoKind">) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const initial = normalizeProgress(initialProgress);
  const initialProgressRef = useRef(initial);
  const playback = usePlaybackState(lessonId, initialProgress);
  const {
    progress,
    saveState,
    positionSeconds,
    durationSeconds,
    playingRef,
    updatePosition,
    saveSnapshot,
  } = playback;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let resumeApplied = false;
    const seekingRef = { current: false };

    const sync = () => {
      updatePosition(video.currentTime, video.duration || null);
    };
    const loadedMetadata = () => {
      sync();
      const duration = video.duration;
      const resumePosition = initialProgressRef.current.playbackPositionSeconds;
      if (
        !resumeApplied &&
        initialProgressRef.current.status !== "completed" &&
        resumePosition > 3 &&
        duration > resumePosition + 3
      ) {
        video.currentTime = resumePosition;
        sync();
      }
      resumeApplied = true;
    };
    const saveSample = (
      event: SaveEvent,
      active: boolean,
      force = false,
      keepalive = false
    ) => {
      saveSnapshot(event, active, force, keepalive);
    };
    const onPlay = () => {
      playingRef.current = true;
      saveSample("play", true, true);
    };
    const onPause = () => {
      const wasPlaying = playingRef.current && !seekingRef.current;
      playingRef.current = false;
      sync();
      saveSample("pause", wasPlaying, true);
    };
    const onSeeking = () => {
      seekingRef.current = true;
      sync();
    };
    const onTimeUpdate = () => {
      sync();
      if (playingRef.current && !seekingRef.current) saveSample("progress", true);
    };
    const onSeeked = () => {
      seekingRef.current = false;
      sync();
      saveSample("seeked", playingRef.current, true);
    };
    const onEnded = () => {
      const wasPlaying = playingRef.current;
      playingRef.current = false;
      sync();
      saveSample("ended", wasPlaying, true);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        saveSample("hidden", playingRef.current && !seekingRef.current, true, true);
      }
    };
    const onPageHide = () => {
      saveSample("hidden", playingRef.current && !seekingRef.current, true, true);
    };

    video.addEventListener("loadedmetadata", loadedMetadata);
    video.addEventListener("durationchange", sync);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("seeking", onSeeking);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("ended", onEnded);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);
    if (video.readyState >= 1) loadedMetadata();

    return () => {
      saveSample("unmount", playingRef.current && !seekingRef.current, true, true);
      video.removeEventListener("loadedmetadata", loadedMetadata);
      video.removeEventListener("durationchange", sync);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("seeking", onSeeking);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("ended", onEnded);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [playingRef, saveSnapshot, updatePosition]);

  return (
    <>
      <div className="video-container">
        <video ref={videoRef} controls preload="metadata">
          <source
            src={videoSource || undefined}
            type={videoSource?.toLowerCase().includes(".m3u8") ? "application/x-mpegURL" : "video/mp4"}
          />
          Your browser does not support the video tag.
        </video>
      </div>
      <PlaybackPanel
        progress={progress}
        positionSeconds={positionSeconds}
        durationSeconds={durationSeconds}
        saveState={saveState}
      />
      <p className="sr-only">{lessonTitle}</p>
    </>
  );
}

type YouTubePlayer = {
  getCurrentTime: () => number;
  getDuration: () => number;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  destroy: () => void;
};

type YouTubeApi = {
  Player: new (element: HTMLElement, options: {
    host?: string;
    videoId: string;
    playerVars?: Record<string, number | string>;
    events: {
      onReady: (event: { target: YouTubePlayer }) => void;
      onStateChange: (event: { data: number; target: YouTubePlayer }) => void;
    };
  }) => YouTubePlayer;
  PlayerState: { PLAYING: number; PAUSED: number; ENDED: number };
};

declare global {
  interface Window {
    YT?: YouTubeApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let youtubeApiPromise: Promise<YouTubeApi> | null = null;

function loadYouTubeApi(): Promise<YouTubeApi> {
  if (typeof window !== "undefined" && window.YT?.Player) {
    return Promise.resolve(window.YT);
  }
  if (youtubeApiPromise) return youtubeApiPromise;

  youtubeApiPromise = new Promise<YouTubeApi>((resolve, reject) => {
    const finish = () => {
      if (window.YT?.Player) resolve(window.YT);
      else reject(new Error("YouTube API did not initialize"));
    };
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      finish();
    };

    const existing = document.getElementById("youtube-iframe-api");
    if (existing) return;

    const script = document.createElement("script");
    script.id = "youtube-iframe-api";
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => reject(new Error("YouTube API failed to load"));
    document.head.appendChild(script);
  });

  return youtubeApiPromise;
}

function YouTubeVideoPlayer({
  lessonId,
  videoSource,
  lessonTitle,
  initialProgress,
  videoId,
}: Omit<VideoPlayerProps, "videoKind"> & { videoId: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const initial = normalizeProgress(initialProgress);
  const initialProgressRef = useRef(initial);
  const playback = usePlaybackState(lessonId, initialProgress);
  const {
    progress,
    saveState,
    positionSeconds,
    durationSeconds,
    playingRef,
    updatePosition,
    saveSnapshot,
  } = playback;
  const playerRef = useRef<YouTubePlayer | null>(null);
  const timerRef = useRef<number | null>(null);
  const lastSamplePositionRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const stopTimer = () => {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
    const sync = (player: YouTubePlayer) => {
      const duration = player.getDuration() || null;
      const position = player.getCurrentTime() || 0;
      updatePosition(position, duration);
      return { duration, position };
    };
    const sample = (player: YouTubePlayer) => {
      const { duration, position } = sync(player);
      const previous = lastSamplePositionRef.current;
      const jumped =
        playingRef.current &&
        previous > 0 &&
        Math.abs(position - previous) > 3;
      lastSamplePositionRef.current = position;
      if (jumped) {
        saveSnapshot("seeked", false, true);
      } else if (playingRef.current) {
        saveSnapshot("progress", true);
      }
      return { duration, position };
    };
    const startTimer = (player: YouTubePlayer) => {
      stopTimer();
      timerRef.current = window.setInterval(() => sample(player), 1_000);
    };

    loadYouTubeApi()
      .then((api) => {
        if (cancelled || !containerRef.current) return;
        playerRef.current = new api.Player(containerRef.current, {
          host: "https://www.youtube-nocookie.com",
          videoId,
          playerVars: {
            controls: 1,
            enablejsapi: 1,
            modestbranding: 1,
            origin: window.location.origin,
            playsinline: 1,
            rel: 0,
          },
          events: {
            onReady: ({ target }) => {
              const { position } = sync(target);
              if (
                initialProgressRef.current.status !== "completed" &&
                initialProgressRef.current.playbackPositionSeconds > 3 &&
                initialProgressRef.current.playbackPositionSeconds < (target.getDuration() || Infinity) - 3
              ) {
                target.seekTo(initialProgressRef.current.playbackPositionSeconds, true);
                sync(target);
              }
              lastSamplePositionRef.current = position;
            },
            onStateChange: ({ data, target }) => {
              if (data === api.PlayerState.PLAYING) {
                playingRef.current = true;
                saveSnapshot("play", true, true);
                startTimer(target);
              } else if (data === api.PlayerState.PAUSED) {
                const wasPlaying = playingRef.current;
                playingRef.current = false;
                sync(target);
                saveSnapshot("pause", wasPlaying, true);
                stopTimer();
              } else if (data === api.PlayerState.ENDED) {
                const wasPlaying = playingRef.current;
                playingRef.current = false;
                sync(target);
                saveSnapshot("ended", wasPlaying, true);
                stopTimer();
              }
            },
          },
        });
      })
      .catch(() => {
        // The panel remains usable and the user can retry by reloading. No
        // arbitrary iframe source is rendered when the official API fails.
      });

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        saveSnapshot("hidden", playingRef.current, true, true);
      }
    };
    const onPageHide = () => {
      saveSnapshot("hidden", playingRef.current, true, true);
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      cancelled = true;
      stopTimer();
      saveSnapshot("unmount", playingRef.current, true, true);
      playerRef.current?.destroy();
      playerRef.current = null;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [playingRef, saveSnapshot, updatePosition, videoId]);

  return (
    <>
      <div className="video-container" ref={containerRef} aria-label={`${lessonTitle} video`} />
      <PlaybackPanel
        progress={progress}
        positionSeconds={positionSeconds}
        durationSeconds={durationSeconds}
        saveState={saveState}
      />
    </>
  );
}

export default function VideoPlayer(props: VideoPlayerProps) {
  if (!props.videoSource || props.videoKind === "none") {
    return (
      <div className="video-container bg-gray-900 flex items-center justify-center">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-white">
            <svg
              className="mx-auto mb-3 opacity-40"
              width="64"
              height="64"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            <p className="text-lg font-semibold opacity-60">Video coming soon</p>
          </div>
        </div>
      </div>
    );
  }

  const parsedId = parseYouTubeUrl(props.videoSource);
  const videoId = parsedId || (props.videoKind === "youtube" && isYouTubeVideoId(props.videoSource) ? props.videoSource : null);
  if (videoId) {
    return <YouTubeVideoPlayer {...props} videoId={videoId} />;
  }

  return <DirectVideoPlayer {...props} />;
}
