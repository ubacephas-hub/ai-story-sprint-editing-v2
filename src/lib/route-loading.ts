export const ROUTE_LOADING_TIMEOUT_MS = 15_000;
export const ROUTE_LOADING_FADE_DELAY_MS = 180;
export const ROUTE_LOADING_RESET_DELAY_MS = 560;

export interface RouteLoadingState {
  visible: boolean;
  progress: number;
  fading: boolean;
}

export const INITIAL_ROUTE_LOADING_STATE: RouteLoadingState = {
  visible: false,
  progress: 0,
  fading: false,
};

export type RouteLoadingAction =
  | { type: "start" }
  | { type: "tick" }
  | { type: "complete" }
  | { type: "fade" }
  | { type: "reset" };

export function routeLoadingReducer(
  state: RouteLoadingState,
  action: RouteLoadingAction
): RouteLoadingState {
  switch (action.type) {
    case "start":
      return { visible: true, progress: 10, fading: false };
    case "tick":
      if (!state.visible || state.fading || state.progress >= 90) return state;
      return {
        ...state,
        progress: Math.min(
          90,
          state.progress + Math.max(1, (90 - state.progress) * 0.08)
        ),
      };
    case "complete":
      return state.visible ? { ...state, progress: 100 } : state;
    case "fade":
      return state.visible ? { ...state, fading: true } : state;
    case "reset":
      return INITIAL_ROUTE_LOADING_STATE;
  }
}

export function shouldAnimateRouteLoading(reducedMotion: boolean): boolean {
  return !reducedMotion;
}

export interface NavigationLinkCandidate {
  href: string;
  currentHref: string;
  button?: number;
  metaKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  defaultPrevented?: boolean;
  target?: string | null;
  rel?: string | null;
  download?: boolean;
  noRouteLoading?: boolean;
}

const DOWNLOAD_EXTENSION = /\.(?:pdf|docx?|xlsx?|pptx?|zip|rar|7z|mp3|m4a|wav|mp4|m4v|webm|mov|csv)(?:$|\/)/i;

export function shouldStartRouteLoading(
  candidate: NavigationLinkCandidate
): boolean {
  if (
    candidate.defaultPrevented ||
    candidate.download ||
    candidate.noRouteLoading ||
    candidate.button !== undefined && candidate.button !== 0 ||
    candidate.metaKey ||
    candidate.ctrlKey ||
    candidate.shiftKey ||
    candidate.altKey ||
    (candidate.target && candidate.target.toLowerCase() !== "_self") ||
    candidate.rel?.toLowerCase().split(/\s+/).includes("external")
  ) {
    return false;
  }

  try {
    const current = new URL(candidate.currentHref);
    const target = new URL(candidate.href, current.href);
    if (
      target.origin !== current.origin ||
      (target.protocol !== "http:" && target.protocol !== "https:")
    ) {
      return false;
    }

    // A URL that only changes the fragment is an in-page anchor, not a route.
    if (
      target.pathname === current.pathname &&
      target.search === current.search
    ) {
      return false;
    }

    // Ignore conventional file downloads and resource download endpoints even
    // if an anchor was not given a native `download` attribute.
    if (
      /(?:^|\/)download(?:\/|$)/i.test(target.pathname) ||
      DOWNLOAD_EXTENSION.test(target.pathname)
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}
