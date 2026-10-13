import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  INITIAL_ROUTE_LOADING_STATE,
  ROUTE_LOADING_TIMEOUT_MS,
  routeLoadingReducer,
  shouldAnimateRouteLoading,
  shouldStartRouteLoading,
} from "../src/lib/route-loading";

const currentHref = "https://course.example.test/dashboard?tab=one";

test("route loading starts for eligible same-origin navigation links", () => {
  assert.equal(
    shouldStartRouteLoading({
      href: "/course?tab=two",
      currentHref,
      button: 0,
    }),
    true
  );
  assert.equal(
    routeLoadingReducer(INITIAL_ROUTE_LOADING_STATE, { type: "start" }).progress,
    10
  );
});

test("route loading ignores external, download, anchor, and modified clicks", () => {
  const candidates = [
    { href: "https://external.example.test/course", currentHref, button: 0 },
    { href: "/api/resources/12/download", currentHref, button: 0 },
    { href: "/downloads/guide.pdf", currentHref, button: 0 },
    { href: "/dashboard?tab=one#outline", currentHref, button: 0 },
    { href: "/course", currentHref, button: 0, download: true },
    { href: "/course", currentHref, button: 0, ctrlKey: true },
    { href: "/course", currentHref, button: 0, target: "_blank" },
  ];

  for (const candidate of candidates) {
    assert.equal(shouldStartRouteLoading(candidate), false);
  }
});

test("route changes complete progress at 100 percent", () => {
  let state = routeLoadingReducer(INITIAL_ROUTE_LOADING_STATE, { type: "start" });
  state = routeLoadingReducer(state, { type: "tick" });
  assert.ok(state.progress > 10 && state.progress < 90);
  state = routeLoadingReducer(state, { type: "complete" });
  assert.equal(state.progress, 100);
  state = routeLoadingReducer(state, { type: "fade" });
  assert.equal(state.fading, true);
  state = routeLoadingReducer(state, { type: "reset" });
  assert.deepEqual(state, INITIAL_ROUTE_LOADING_STATE);
});

test("a finite timeout safeguards unfinished route transitions", () => {
  assert.equal(ROUTE_LOADING_TIMEOUT_MS, 15_000);
  assert.ok(Number.isFinite(ROUTE_LOADING_TIMEOUT_MS));
  const component = readFileSync(resolve("src/components/RouteLoadingBar.tsx"), "utf8");
  assert.match(component, /setTimeout\([\s\S]*?complete,[\s\S]*?ROUTE_LOADING_TIMEOUT_MS/);
});

test("reduced motion disables the moving progress animation", () => {
  assert.equal(shouldAnimateRouteLoading(true), false);
  assert.equal(shouldAnimateRouteLoading(false), true);
  const component = readFileSync(resolve("src/components/RouteLoadingBar.tsx"), "utf8");
  assert.match(component, /shouldAnimateRouteLoading\(prefersReducedMotion\)/);
  const css = readFileSync(resolve("src/app/globals.css"), "utf8");
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
});
