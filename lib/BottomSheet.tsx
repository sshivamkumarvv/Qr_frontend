"use client";

import React, { useEffect, useLayoutEffect, useRef, useState, useCallback } from "react";

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxHeight?: string;
  zIndex?: number;
  showHandle?: boolean;
}

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

const CLOSE_ANIM_MS = 280;
// Drag distance (px) that triggers dismiss
const DRAG_CLOSE_DISTANCE = 70;
// Flick speed (px/ms) that triggers dismiss even on a short flick
const DRAG_CLOSE_VELOCITY = 0.32;
// Maximum rubber-band upward stretch (px) past resting top
const MAX_OVERDRAG_UP = 28;

/**
 * Gorhom-style High Performance Bottom Sheet
 * Features:
 * - Direct DOM manipulation on transforms for 60/120fps stutter-free physics
 * - Dynamic velocity & flick decay calculation
 * - Natural upward rubber-band damping
 * - Scrollable content coordination (pulling down when content scrollTop === 0 drags sheet)
 * - Backdrop interpolation linked directly to drag offset
 * - iOS & Android body scroll lock with exact scroll position preservation
 */
export default function BottomSheet({
  isOpen,
  onClose,
  title,
  subtitle,
  headerRight,
  children,
  footer,
  maxHeight = "92dvh",
  zIndex = 70,
  showHandle = true,
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const dragHandleRef = useRef<HTMLDivElement>(null);
  const scrollContentRef = useRef<HTMLDivElement>(null);

  const [mounted, setMounted] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);
  const [isDraggingState, setIsDraggingState] = useState(false);

  // Drag bookkeeping in refs for 60fps direct DOM styling
  const dragging = useRef(false);
  const startY = useRef(0);
  const currentY = useRef(0);
  const history = useRef<{ y: number; t: number }[]>([]);
  const sheetHeight = useRef(0);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  // Track if drag originated from scrollable content at top
  const isContentDrag = useRef(false);

  const applyTransform = useCallback((y: number, withTransition: boolean, customDuration?: number) => {
    const el = sheetRef.current;
    if (el) {
      const duration = customDuration ?? CLOSE_ANIM_MS;
      el.style.transition = withTransition
        ? `transform ${duration}ms cubic-bezier(0.22, 1, 0.36, 1)`
        : "none";
      el.style.transform = `translate3d(0, ${y}px, 0)`;
    }

    const bd = backdropRef.current;
    if (bd) {
      const h = sheetHeight.current || 600;
      const opacity = Math.max(0, Math.min(1, 1 - y / (h * 0.75)));
      const duration = customDuration ?? CLOSE_ANIM_MS;
      bd.style.transition = withTransition ? `opacity ${duration}ms ease` : "none";
      bd.style.opacity = String(opacity);
    }
  }, []);

  const measure = useCallback(() => {
    if (sheetRef.current) {
      sheetHeight.current = sheetRef.current.getBoundingClientRect().height;
    }
  }, []);

  // Open lifecycle
  useEffect(() => {
    if (isOpen && !mounted) {
      restoreFocusRef.current = document.activeElement as HTMLElement | null;
      setIsClosing(false);
      setMounted(true);
    }
  }, [isOpen, mounted]);

  // Position off-screen before first paint to prevent visual jumps
  useIsomorphicLayoutEffect(() => {
    if (!mounted) return;
    measure();
    const startPos = sheetHeight.current || 600;
    currentY.current = startPos;
    applyTransform(startPos, false);
  }, [mounted, measure, applyTransform]);

  // Animate in smoothly on next frame
  useEffect(() => {
    if (!mounted) return;
    const raf = requestAnimationFrame(() => {
      currentY.current = 0;
      applyTransform(0, true);
    });
    return () => cancelAnimationFrame(raf);
  }, [mounted, applyTransform]);

  useEffect(() => {
    if (!mounted) return;
    const ro = new ResizeObserver(measure);
    if (sheetRef.current) ro.observe(sheetRef.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [mounted, measure]);

  // Close lifecycle
  const finishClose = useCallback(() => {
    setMounted(false);
    setIsClosing(false);
    onClose();
    if (restoreFocusRef.current && typeof restoreFocusRef.current.focus === "function") {
      restoreFocusRef.current.focus({ preventScroll: true });
    }
  }, [onClose]);

  const animateClose = useCallback(
    (velocity = 0) => {
      if (isClosing) return;
      setIsClosing(true);

      const h = sheetHeight.current || 600;
      const target = h + 100;
      // Snappier duration for fast flicks
      const duration = Math.max(160, Math.min(CLOSE_ANIM_MS, CLOSE_ANIM_MS - velocity * 130));

      applyTransform(target, true, duration);
      currentY.current = target;
      window.setTimeout(finishClose, duration);
    },
    [isClosing, finishClose, applyTransform]
  );

  const snapOpen = useCallback(() => {
    currentY.current = 0;
    applyTransform(0, true);
  }, [applyTransform]);

  // Drive closing if parent sets isOpen = false
  useEffect(() => {
    if (!isOpen && mounted && !isClosing) {
      animateClose();
    }
  }, [isOpen, mounted, isClosing, animateClose]);

  // Escape key handler
  useEffect(() => {
    if (!mounted) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") animateClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mounted, animateClose]);

  // Prevent background wheel and touch gestures while sheet is open without touching body/docEl overflow (which unpins position:sticky elements)
  useEffect(() => {
    if (!mounted) return;

    const preventBackgroundScroll = (e: TouchEvent | WheelEvent) => {
      // Allow scrolling inside sheet's scrollable content
      if (scrollContentRef.current && scrollContentRef.current.contains(e.target as Node)) {
        return;
      }
      if (e.cancelable) {
        e.preventDefault();
      }
    };

    window.addEventListener("wheel", preventBackgroundScroll, { passive: false });
    window.addEventListener("touchmove", preventBackgroundScroll, { passive: false });

    return () => {
      window.removeEventListener("wheel", preventBackgroundScroll);
      window.removeEventListener("touchmove", preventBackgroundScroll);
    };
  }, [mounted]);

  // --- Gesture Handling (Gorhom mechanics) ---
  const startDrag = useCallback((clientY: number) => {
    dragging.current = true;
    startY.current = clientY - currentY.current;
    history.current = [{ y: clientY, t: performance.now() }];
    setIsDraggingState(true);

    if (sheetRef.current) sheetRef.current.style.transition = "none";
    if (backdropRef.current) backdropRef.current.style.transition = "none";
  }, []);

  const endDrag = useCallback(
    () => {
      if (!dragging.current) return;
      dragging.current = false;
      setIsDraggingState(false);
      isContentDrag.current = false;

      // Velocity in px/ms (positive = moving down toward close)
      const pts = history.current;
      let velocity = 0;
      if (pts.length >= 2) {
        const first = pts[0];
        const last = pts[pts.length - 1];
        const dt = last.t - first.t || 1;
        velocity = (last.y - first.y) / dt;
      }

      const y = currentY.current;
      const shouldClose = y > DRAG_CLOSE_DISTANCE || velocity > DRAG_CLOSE_VELOCITY;

      if (shouldClose) {
        animateClose(Math.max(0, velocity));
      } else {
        snapOpen();
      }
    },
    [animateClose, snapOpen]
  );

  const onHeaderPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    try {
      (e.currentTarget as HTMLElement)?.setPointerCapture?.(e.pointerId);
    } catch (_) {}
    isContentDrag.current = false;
    startDrag(e.clientY);
  }, [startDrag]);

  // Window-level pointer tracking for 100% reliable tracking even during fast movement
  useEffect(() => {
    if (!mounted) return;

    const handlePointerMove = (e: PointerEvent) => {
      if (!dragging.current) return;
      if (e.cancelable) e.preventDefault();
      let y = e.clientY - startY.current;

      if (y < 0) {
        // Asymptotic rubber-band curve when dragging upward
        y = -MAX_OVERDRAG_UP * (1 - Math.exp(y / 60));
      }

      currentY.current = y;
      applyTransform(y, false);

      history.current.push({ y: e.clientY, t: performance.now() });
      if (history.current.length > 6) history.current.shift();
    };

    const handlePointerUp = () => {
      if (dragging.current) {
        endDrag();
      }
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: false });
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [mounted, applyTransform, endDrag]);

  // Gorhom-style content scroll coordination via non-passive native listener:
  // When user is scrolled to top (scrollTop <= 0) and swipes downward, drag the sheet down
  const touchStartY = useRef(0);
  useEffect(() => {
    const el = scrollContentRef.current;
    if (!el || !mounted) return;

    const onTouchStart = (e: TouchEvent) => {
      touchStartY.current = e.touches[0].clientY;
    };

    const onTouchMove = (e: TouchEvent) => {
      const currentTouchY = e.touches[0].clientY;
      const deltaY = currentTouchY - touchStartY.current;

      // Pulling downwards at the very top of content
      if (el.scrollTop <= 0 && deltaY > 4 && !dragging.current) {
        isContentDrag.current = true;
        startDrag(currentTouchY);
        if (e.cancelable) e.preventDefault();
      } else if (dragging.current) {
        // Prevent native content scrolling while sheet is dragging (safe in non-passive listener)
        if (e.cancelable) e.preventDefault();
        let y = currentTouchY - startY.current;
        if (y < 0) {
          y = -MAX_OVERDRAG_UP * (1 - Math.exp(y / 60));
        }
        currentY.current = y;
        applyTransform(y, false);

        history.current.push({ y: currentTouchY, t: performance.now() });
        if (history.current.length > 6) history.current.shift();
      }
    };

    const onTouchEnd = () => {
      if (dragging.current) {
        endDrag();
      }
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [mounted, startDrag, endDrag, applyTransform]);

  if (!mounted) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        ref={backdropRef}
        onClick={() => animateClose()}
        style={{
          position: "fixed",
          inset: 0,
          zIndex,
          background: "var(--backdrop)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          opacity: 0,
          touchAction: "none",
        }}
        aria-hidden="true"
      />

      {/* Sheet Container */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: zIndex + 1,
          maxHeight,
          background: "var(--bg-card)",
          borderRadius: "28px 28px 0 0",
          border: "1px solid var(--border)",
          borderBottom: "none",
          boxShadow: "0 -10px 40px rgba(0, 0, 0, 0.28), 0 -2px 10px var(--accent-glow)",
          display: "flex",
          flexDirection: "column",
          willChange: "transform",
          touchAction: "none",
          overscrollBehavior: "contain",
        }}
      >
        {/* Drag Handle & Header (Interactive Drag Zone) */}
        <div
          ref={dragHandleRef}
          onPointerDown={onHeaderPointerDown}
          style={{
            cursor: isDraggingState ? "grabbing" : "grab",
            paddingTop: showHandle ? "12px" : "16px",
            paddingBottom: "12px",
            paddingLeft: "20px",
            paddingRight: "20px",
            flexShrink: 0,
            userSelect: "none",
            WebkitUserSelect: "none",
            touchAction: "none",
          }}
        >
          {showHandle && (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                paddingBottom: title ? "12px" : "4px",
              }}
            >
              <div
                style={{
                  width: isDraggingState ? "58px" : "44px",
                  height: "5px",
                  borderRadius: "3px",
                  background: isDraggingState
                    ? "var(--accent)"
                    : "var(--border)",
                  transition: "background 0.2s ease, width 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)",
                  boxShadow: isDraggingState ? "0 0 12px var(--accent-glow)" : "none",
                }}
              />
            </div>
          )}

          {(title || headerRight) && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                {typeof title === "string" ? (
                  <h2
                    style={{
                      fontSize: "1.2rem",
                      fontWeight: 800,
                      color: "var(--text-primary)",
                      letterSpacing: "-0.01em",
                      margin: 0,
                    }}
                  >
                    {title}
                  </h2>
                ) : (
                  title
                )}
                {subtitle && (
                  <div
                    style={{
                      fontSize: "0.8rem",
                      color: "var(--text-secondary)",
                      marginTop: "3px",
                    }}
                  >
                    {subtitle}
                  </div>
                )}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                {headerRight}
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => animateClose()}
                  className="tap-scale"
                  style={{
                    width: "34px",
                    height: "34px",
                    borderRadius: "50%",
                    background: "var(--tag-bg)",
                    border: "none",
                    color: "var(--text-secondary)",
                    cursor: "pointer",
                    fontSize: "14px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.15s ease",
                  }}
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Scrollable Content Body with Top-Scroll Coordination */}
        <div
          ref={scrollContentRef}
          style={{
            flex: 1,
            overflowY: "auto",
            WebkitOverflowScrolling: "touch",
            padding: "0 20px 16px",
            touchAction: "pan-y",
            overscrollBehavior: "contain",
          }}
        >
          {children}
        </div>

        {/* Optional Sticky Footer */}
        {footer && (
          <div
            style={{
              flexShrink: 0,
              padding: "14px 20px max(16px, env(safe-area-inset-bottom))",
              borderTop: "1px solid var(--border)",
              background: "var(--bg-card)",
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </>
  );
}