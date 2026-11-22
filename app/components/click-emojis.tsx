"use client";

import { useEffect, useRef } from "react";

const emojis = ["💗", "💕", "💖", "❤️", "🍓", "🍒", "🌸", "🌷", "🌼", "🌺", "✨", "🦋"];
const maxActiveEmojis = 100;

export default function ClickEmojis() {
  const layerRef = useRef<HTMLDivElement>(null);
  const timersRef = useRef(new Set<number>());

  useEffect(() => {
    const currentLayer = layerRef.current;
    if (!currentLayer) return;
    const layer: HTMLDivElement = currentLayer;

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
          timersRef.current.delete(timer);
        }, duration + delay + 120);
        timersRef.current.add(timer);
      }
      layer.appendChild(fragment);
    }

    document.addEventListener("click", handleClick);
    return () => {
      document.removeEventListener("click", handleClick);
      timersRef.current.forEach(timer => window.clearTimeout(timer));
      timersRef.current.clear();
      layer.replaceChildren();
    };
  }, []);

  return <div ref={layerRef} className="click-emoji-layer" aria-hidden="true" />;
}
