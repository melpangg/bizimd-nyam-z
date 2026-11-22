"use client";

import { useEffect, useRef } from "react";
import { welcomeHeartsEvent } from "@/lib/welcome-hearts";

const emojis = ["💗", "💕", "💖", "❤️", "🍓", "🍒", "🌸", "🌷", "🌼", "🌺", "✨", "🦋"];
const maxActiveEmojis = 100;
const welcomeHearts = ["💗", "💕", "💖", "❤️", "💞", "💓"];
const welcomeHeartCount = 28;

export default function ClickEmojis() {
  const layerRef = useRef<HTMLDivElement>(null);
  const welcomeLayerRef = useRef<HTMLDivElement>(null);
  const timersRef = useRef(new Set<number>());
  const welcomeTimersRef = useRef(new Set<number>());
  const welcomeIntervalRef = useRef<number | null>(null);
  const welcomeRunActiveRef = useRef(false);

  useEffect(() => {
    const currentLayer = layerRef.current;
    const currentWelcomeLayer = welcomeLayerRef.current;
    if (!currentLayer || !currentWelcomeLayer) return;
    const layer: HTMLDivElement = currentLayer;
    const welcomeLayer: HTMLDivElement = currentWelcomeLayer;
    const timers = timersRef.current;
    const welcomeTimers = welcomeTimersRef.current;

    function handleClick(event: MouseEvent) {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      const count = 5 + Math.floor(Math.random() * 6);
      while (layer.childElementCount + count > maxActiveEmojis) {
        layer.firstElementChild?.remove();
      }

      const fragment = document.createDocumentFragment();
      for (let index = 0; index < count; index += 1) {
        const particle = document.createElement("span");
        const duration = 1500 + Math.random() * 1000;
        const delay = Math.random() * 100;
        particle.className = "click-emoji";
        particle.textContent = emojis[Math.floor(Math.random() * emojis.length)];
        particle.style.left = `${event.clientX}px`;
        particle.style.top = `${event.clientY}px`;
        particle.style.setProperty("--emoji-size", `${18 + Math.random() * 14}px`);
        particle.style.setProperty("--drift-x", `${Math.round(Math.random() * 150 - 75)}px`);
        particle.style.setProperty("--drift-y", `${-90 - Math.round(Math.random() * 100)}px`);
        particle.style.setProperty("--rotation", `${Math.round(Math.random() * 100 - 50)}deg`);
        particle.style.setProperty("--duration", `${duration}ms`);
        particle.style.setProperty("--delay", `${delay}ms`);
        fragment.appendChild(particle);

        const timer = window.setTimeout(() => {
          particle.remove();
          timers.delete(timer);
        }, duration + delay + 120);
        timers.add(timer);
      }
      layer.appendChild(fragment);
    }

    function handleWelcomeHearts() {
      if (
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
        || welcomeRunActiveRef.current
      ) return;

      welcomeRunActiveRef.current = true;
      let spawned = 0;
      let active = 0;

      function spawnHeart() {
        const particle = document.createElement("span");
        const duration = 8000 + Math.random() * 4500;
        const size = 16 + Math.random() * 16;
        const sway = 18 + Math.random() * 30;
        const drift = Math.round(Math.random() * 100 - 50);
        const rotation = Math.round(Math.random() * 36 - 18);
        particle.className = "welcome-heart";
        particle.textContent = welcomeHearts[Math.floor(Math.random() * welcomeHearts.length)];
        particle.setAttribute("aria-hidden", "true");
        particle.style.left = `${Math.random() * 100}%`;
        particle.style.bottom = `${-size}px`;
        particle.style.setProperty("--heart-size", `${size}px`);
        particle.style.setProperty("--heart-duration", `${duration}ms`);
        particle.style.setProperty("--heart-sway-left", `${-sway}px`);
        particle.style.setProperty("--heart-sway-right", `${sway}px`);
        particle.style.setProperty("--heart-drift", `${drift}px`);
        particle.style.setProperty("--heart-rotation", `${rotation}deg`);
        particle.style.setProperty("--heart-opacity", `${0.3 + Math.random() * 0.25}`);
        welcomeLayer.appendChild(particle);
        spawned += 1;
        active += 1;

        const timer = window.setTimeout(() => {
          particle.remove();
          active -= 1;
          welcomeTimers.delete(timer);
          if (spawned === welcomeHeartCount && active === 0) {
            welcomeRunActiveRef.current = false;
          }
        }, duration + 100);
        welcomeTimers.add(timer);
      }

      spawnHeart();
      welcomeIntervalRef.current = window.setInterval(() => {
        if (spawned === welcomeHeartCount) {
          if (welcomeIntervalRef.current !== null) {
            window.clearInterval(welcomeIntervalRef.current);
            welcomeIntervalRef.current = null;
          }
          return;
        }
        spawnHeart();
      }, 320);
    }

    document.addEventListener("click", handleClick);
    document.addEventListener(welcomeHeartsEvent, handleWelcomeHearts);
    return () => {
      document.removeEventListener("click", handleClick);
      document.removeEventListener(welcomeHeartsEvent, handleWelcomeHearts);
      timers.forEach(timer => window.clearTimeout(timer));
      timers.clear();
      welcomeTimers.forEach(timer => window.clearTimeout(timer));
      welcomeTimers.clear();
      if (welcomeIntervalRef.current !== null) {
        window.clearInterval(welcomeIntervalRef.current);
        welcomeIntervalRef.current = null;
      }
      welcomeRunActiveRef.current = false;
      layer.replaceChildren();
      welcomeLayer.replaceChildren();
    };
  }, []);

  return (
    <>
      <div ref={welcomeLayerRef} className="welcome-heart-layer" aria-hidden="true" />
      <div ref={layerRef} className="click-emoji-layer" aria-hidden="true" />
    </>
  );
}
