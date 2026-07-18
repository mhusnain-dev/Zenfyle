"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { ChevronDown, Menu, Search, X } from "lucide-react";
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  toolsByCategory,
  type ToolCategory,
} from "@/lib/registry";
import { ToolCard } from "@/components/ui/ToolCard";

/*
 * Header & navigation — specs.md Section 3, built exactly as described.
 *
 * Desktop: 5 tabs open one shared mega-menu panel anchored below the full
 * header (3.3). 120ms open delay / 200ms close grace via timers (3.2). A
 * single underline element slides between tabs via transform (3.2). Badges
 * stagger-fade 15ms apart on open, once per open, disabled under
 * prefers-reduced-motion (3.4). Escape closes and refocuses the trigger;
 * triggers are <button> with aria-expanded/aria-controls (3.6).
 *
 * Mobile (<768px): hamburger → slide-in drawer, accordion per category,
 * closes on outside tap / X / link tap (3.5).
 *
 * v1.2.0 palette: gradient #102A43→#0C2036, nav #CBD5E1, hover --signal.
 */

const OPEN_DELAY_MS = 120;
const CLOSE_GRACE_MS = 200;

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void) {
  const mq = window.matchMedia(REDUCED_MOTION_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION_QUERY).matches,
    () => false,
  );
}

export function Header() {
  const [openTab, setOpenTab] = useState<ToolCategory | null>(null);
  const [underline, setUnderline] = useState<{ left: number; width: number } | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [expandedRow, setExpandedRow] = useState<ToolCategory | null>(null);
  const reducedMotion = useReducedMotion();

  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tabRefs = useRef<Map<ToolCategory, HTMLButtonElement>>(new Map());
  const navRef = useRef<HTMLElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const clearTimers = () => {
    if (openTimer.current) clearTimeout(openTimer.current);
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };

  const moveUnderline = useCallback((tab: ToolCategory) => {
    const el = tabRefs.current.get(tab);
    const nav = navRef.current;
    if (!el || !nav) return;
    const navBox = nav.getBoundingClientRect();
    const box = el.getBoundingClientRect();
    setUnderline({ left: box.left - navBox.left, width: box.width });
  }, []);

  const scheduleOpen = (tab: ToolCategory) => {
    clearTimers();
    moveUnderline(tab);
    // 120ms delay prevents flicker on fast pass-over (3.2); instant swap when
    // a panel is already open so moving across tabs feels continuous.
    if (openTab !== null) {
      setOpenTab(tab);
    } else {
      openTimer.current = setTimeout(() => setOpenTab(tab), OPEN_DELAY_MS);
    }
  };

  const scheduleClose = () => {
    clearTimers();
    closeTimer.current = setTimeout(() => {
      setOpenTab(null);
      setUnderline(null);
    }, CLOSE_GRACE_MS);
  };

  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };

  // Escape closes the dropdown and returns focus to the trigger tab (3.6).
  useEffect(() => {
    if (!openTab && !drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (openTab) {
        tabRefs.current.get(openTab)?.focus();
        setOpenTab(null);
        setUnderline(null);
      }
      setDrawerOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [openTab, drawerOpen]);

  // Drawer closes on tap outside (3.5).
  useEffect(() => {
    if (!drawerOpen) return;
    const onDown = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node))
        setDrawerOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [drawerOpen]);

  const openTools = openTab ? toolsByCategory(openTab) : [];

  return (
    <header className="sticky top-0 z-50 w-full bg-gradient-to-b from-ink to-ink-deep">
      {/* ── Desktop (>= 768px) ─────────────────────────────────────────── */}
      <div
        className="hidden h-[72px] items-center pl-6 md:flex"
        onMouseLeave={scheduleClose}
      >
        <Link href="/" className="font-display text-xl font-semibold text-nav-bright">
          Zenfyle
        </Link>
        <nav
          ref={navRef}
          aria-label="Tools"
          className="relative ml-[100px] flex h-full items-center gap-8 lg:ml-[180px]"
        >
          {CATEGORY_ORDER.map((category) => (
            <button
              key={category}
              ref={(el) => {
                if (el) tabRefs.current.set(category, el);
              }}
              type="button"
              aria-expanded={openTab === category}
              aria-controls={panelId}
              onMouseEnter={() => scheduleOpen(category)}
              onClick={() =>
                openTab === category
                  ? (setOpenTab(null), setUnderline(null))
                  : (moveUnderline(category), setOpenTab(category))
              }
              className={`flex h-full items-center font-display text-[15px] font-medium leading-none transition-colors ${
                openTab === category ? "text-signal" : "text-nav hover:text-signal"
              }`}
            >
              {category === openTab ? (
                <span className="flex items-center gap-1">
                  {CATEGORY_LABELS[category]}
                  <ChevronDown size={14} strokeWidth={2} aria-hidden />
                </span>
              ) : (
                CATEGORY_LABELS[category]
              )}
            </button>
          ))}
          {/* Single shared underline, slides between tabs via transform (3.2) */}
          <span
            aria-hidden
            className="absolute bottom-0 left-0 h-0.5 bg-signal transition-all duration-200 ease-out"
            style={
              underline
                ? { transform: `translateX(${underline.left}px)`, width: underline.width, opacity: 1 }
                : { opacity: 0, width: 0 }
            }
          />
        </nav>
        <div className="ml-auto flex items-center gap-6 pr-6">
          <button
            type="button"
            aria-label="Search tools"
            className="text-nav transition-colors hover:text-signal"
          >
            <Search size={20} strokeWidth={2} />
          </button>
          <Link
            href="/login"
            className="font-body text-[15px] font-medium text-nav transition-colors hover:text-nav-bright"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="rounded-card bg-signal px-4 py-2.5 font-body text-[15px] font-semibold text-white shadow-[0_4px_12px_rgba(255,107,53,0.28)] transition-all hover:bg-signal-hover hover:shadow-[0_6px_16px_rgba(255,107,53,0.36)]"
          >
            Sign up free
          </Link>
        </div>
      </div>

      {/* Mega-menu panel — one shared panel below the full header (3.3) */}
      <div
        id={panelId}
        role="region"
        aria-label={openTab ? `${CATEGORY_LABELS[openTab]} tools` : undefined}
        onMouseEnter={cancelClose}
        onMouseLeave={scheduleClose}
        className={`absolute left-1/2 top-full hidden w-full max-w-[920px] -translate-x-1/2 rounded-b-xl bg-paper-alt shadow-[0_12px_32px_rgba(0,0,0,0.18)] md:block ${
          openTab
            ? "animate-[menuIn_160ms_ease-out] opacity-100"
            : "pointer-events-none opacity-0"
        }`}
      >
        {openTab && (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-6 p-8">
            {openTools.map((tool, i) => (
              <ToolCard
                key={tool.slug}
                tool={tool}
                variant="grid"
                // 3.4: badges stagger-fade 15ms apart, opacity only, once per
                // open; disabled under prefers-reduced-motion.
                badgeStyle={
                  reducedMotion
                    ? undefined
                    : {
                        animation: `badgeIn 120ms ease-out ${i * 15}ms both`,
                      }
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Mobile (< 768px) ───────────────────────────────────────────── */}
      <div className="flex h-[60px] items-center justify-between px-4 md:hidden">
        <button
          type="button"
          aria-label="Open menu"
          aria-expanded={drawerOpen}
          onClick={() => setDrawerOpen(true)}
          className="flex h-11 w-11 items-center justify-center text-nav-bright"
        >
          <Menu size={24} strokeWidth={2} />
        </button>
        <Link href="/" className="font-display text-lg font-semibold text-nav-bright">
          Zenfyle
        </Link>
        <Link
          href="/signup"
          aria-label="Sign up"
          className="flex h-11 items-center rounded-card bg-signal px-3 font-body text-sm font-semibold text-white transition-colors hover:bg-signal-hover"
        >
          Sign up
        </Link>
      </div>

      {/* Drawer overlay + panel (3.5) */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 bg-ink-deep/60 md:hidden">
          <div
            ref={drawerRef}
            className="h-full w-full max-w-[280px] overflow-y-auto bg-gradient-to-b from-ink to-ink-deep max-[399px]:max-w-full"
          >
            <div className="flex h-[60px] items-center justify-between px-4">
              <span className="font-display text-lg font-semibold text-nav-bright">
                Zenfyle
              </span>
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setDrawerOpen(false)}
                className="flex h-11 w-11 items-center justify-center text-nav"
              >
                <X size={24} strokeWidth={2} />
              </button>
            </div>
            <nav aria-label="Tools">
              {CATEGORY_ORDER.map((category) => {
                const expanded = expandedRow === category;
                return (
                  <div key={category} className="border-b border-paper-alt/10">
                    <button
                      type="button"
                      aria-expanded={expanded}
                      onClick={() => setExpandedRow(expanded ? null : category)}
                      className="flex min-h-11 w-full items-center justify-between px-4 py-4 font-display text-[15px] font-medium text-nav"
                    >
                      {CATEGORY_LABELS[category]}
                      <ChevronDown
                        size={18}
                        strokeWidth={2}
                        aria-hidden
                        className={`transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
                      />
                    </button>
                    {expanded && (
                      <div className="bg-paper-alt px-4">
                        {toolsByCategory(category).map((tool) => (
                          <div
                            key={tool.slug}
                            className="border-b border-border/60 last:border-b-0"
                          >
                            <ToolCard tool={tool} variant="row" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}
