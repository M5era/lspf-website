// Motion system — reveals are pure CSS now (global.css), this file only
// handles smooth scroll (Lenis) and per-image fade-ins. With JS disabled
// or reduced-motion enabled, everything still renders fine — the CSS
// animations have a prefers-reduced-motion fallback that disables them.

import { gsap } from "gsap";
import Lenis from "lenis";

const prefersReduced = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
).matches;

let lenis: Lenis | null = null;

function initSmoothScroll() {
  if (prefersReduced || lenis) return;
  lenis = new Lenis({ lerp: 0.12 });
  gsap.ticker.add((time) => lenis?.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}

function initImageFades() {
  const images = document.querySelectorAll<HTMLImageElement>("img.fade-in");
  images.forEach((img) => {
    if (img.complete) {
      img.classList.add("loaded");
    } else {
      img.addEventListener("load", () => img.classList.add("loaded"), {
        once: true,
      });
      img.addEventListener("error", () => img.classList.add("loaded"), {
        once: true,
      });
    }
  });
}

function init() {
  if ("scrollRestoration" in history) {
    history.scrollRestoration = "manual";
  }
  initSmoothScroll();
  initImageFades();
}

document.addEventListener("astro:page-load", init);
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}

// Reset scroll position when swapping pages under View Transitions.
document.addEventListener("astro:after-swap", () => {
  lenis?.scrollTo(0, { immediate: true });
  window.scrollTo(0, 0);
});
