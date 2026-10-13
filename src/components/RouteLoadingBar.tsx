"use client";

import { Suspense, useCallback, useEffect, useReducer, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  INITIAL_ROUTE_LOADING_STATE,
  ROUTE_LOADING_FADE_DELAY_MS,
  ROUTE_LOADING_RESET_DELAY_MS,
  ROUTE_LOADING_TIMEOUT_MS,
  routeLoadingReducer,
  shouldAnimateRouteLoading,
  shouldStartRouteLoading,
} from "@/lib/route-loading";

interface TimerSet {
  progress?: number;
  watchdog?: number;
  fade?: number;
  reset?: number;
}

function RouteLoadingBarTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = `${pathname}?${searchParams.toString()}`;
  const [state, dispatch] = useReducer(
    routeLoadingReducer,
    INITIAL_ROUTE_LOADING_STATE
  );
  const activeRef = useRef(false);
  const timersRef = useRef<TimerSet>({});
  const routeKeyRef = useRef(routeKey);

  const clearTimers = useCallback(() => {
    const timers = timersRef.current;
    if (timers.progress !== undefined) window.clearInterval(timers.progress);
    if (timers.watchdog !== undefined) window.clearTimeout(timers.watchdog);
    if (timers.fade !== undefined) window.clearTimeout(timers.fade);
    if (timers.reset !== undefined) window.clearTimeout(timers.reset);
    timersRef.current = {};
  }, []);

  const complete = useCallback(() => {
    if (!activeRef.current) return;
    activeRef.current = false;
    clearTimers();
    dispatch({ type: "complete" });
    timersRef.current.fade = window.setTimeout(() => {
      dispatch({ type: "fade" });
    }, ROUTE_LOADING_FADE_DELAY_MS);
    timersRef.current.reset = window.setTimeout(() => {
      dispatch({ type: "reset" });
      timersRef.current = {};
    }, ROUTE_LOADING_RESET_DELAY_MS);
  }, [clearTimers]);

  const start = useCallback(() => {
    clearTimers();
    activeRef.current = true;
    dispatch({ type: "start" });

    const prefersReducedMotion =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (shouldAnimateRouteLoading(prefersReducedMotion)) {
      timersRef.current.progress = window.setInterval(() => {
        dispatch({ type: "tick" });
      }, 160);
    }

    // Navigation failures, cancelled transitions, and route errors must never
    // leave the indicator active forever.
    timersRef.current.watchdog = window.setTimeout(
      complete,
      ROUTE_LOADING_TIMEOUT_MS
    );
  }, [clearTimers, complete]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || anchor.closest('[aria-disabled="true"]')) return;

      const eligible = shouldStartRouteLoading({
        href: anchor.href,
        currentHref: window.location.href,
        button: event.button,
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        defaultPrevented: event.defaultPrevented,
        target: anchor.target,
        rel: anchor.rel,
        download: anchor.hasAttribute("download"),
        noRouteLoading: anchor.hasAttribute("data-no-route-loading"),
      });
      if (eligible) start();
    };

    const handlePopState = () => {
      const nextRouteKey = `${window.location.pathname}?${new URLSearchParams(window.location.search).toString()}`;
      if (nextRouteKey !== routeKeyRef.current) start();
    };

    window.addEventListener("click", handleClick, true);
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("click", handleClick, true);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [start]);

  useEffect(() => {
    if (routeKeyRef.current !== routeKey) {
      routeKeyRef.current = routeKey;
      complete();
    }
  }, [complete, routeKey]);

  useEffect(
    () => () => {
      activeRef.current = false;
      clearTimers();
    },
    [clearTimers]
  );

  return (
    <div
      className={`route-loading-bar${state.visible ? " is-visible" : ""}${state.fading ? " is-fading" : ""}`}
      style={{ width: `${state.progress}%` }}
      role={state.visible ? "progressbar" : undefined}
      aria-label={state.visible ? "Page navigation progress" : undefined}
      aria-valuemin={state.visible ? 0 : undefined}
      aria-valuemax={state.visible ? 100 : undefined}
      aria-valuenow={state.visible ? Math.round(state.progress) : undefined}
      aria-hidden={!state.visible}
    />
  );
}

export default function RouteLoadingBar() {
  return (
    <Suspense fallback={null}>
      <RouteLoadingBarTracker />
    </Suspense>
  );
}
