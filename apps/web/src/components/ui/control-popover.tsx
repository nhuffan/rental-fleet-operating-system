"use client";
import { useCallback, useEffect, useRef, useState } from "react";

// Popups belong to the nearest modal's top layer. A body portal is inert behind showModal().
export function useControlPopover(width = 300) {
  const root = useRef<HTMLSpanElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [position, setPosition] = useState({
    left: 16,
    top: 16,
    width,
    maxHeight: 400,
  });
  const updatePosition = useCallback(() => {
    const rect = trigger.current?.getBoundingClientRect();
    if (!rect) return;
    const actualWidth = Math.min(
      Math.max(rect.width, width),
      360,
      window.innerWidth - 32,
    );
    const below = window.innerHeight - rect.bottom - 16;
    const above = rect.top - 16;
    const height = Math.min(440, Math.max(below, above));
    const placeAbove = below < 300 && above > below;
    setPosition({
      left: Math.max(
        16,
        Math.min(rect.left, window.innerWidth - actualWidth - 16),
      ),
      top: placeAbove ? Math.max(16, rect.top - height - 6) : rect.bottom + 6,
      width: actualWidth,
      maxHeight: Math.max(100, placeAbove ? height : below),
    });
  }, [width]);
  function show() {
    if (trigger.current?.matches(":disabled")) return;
    setHost(root.current?.closest("dialog") ?? document.body);
    updatePosition();
    setOpen(true);
  }
  const close = useCallback((returnFocus = false) => {
    setOpen(false);
    if (returnFocus) trigger.current?.focus();
  }, []);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (
        !root.current?.contains(event.target as Node) &&
        !popup.current?.contains(event.target as Node)
      )
        setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);
  return { root, trigger, popup, open, host, position, show, close };
}
