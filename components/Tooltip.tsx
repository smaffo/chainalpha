"use client";

import React from "react";

// Tooltip wraps any inline element and shows an explanatory popover on hover.
// Uses named group (group/tip) so it doesn't conflict with parent group classes.
// Enter delay: 200ms. Exit: immediate. Pure CSS — no JS timers.
export function Tooltip({
  children,
  content,
  wrapperClass,
}: {
  children: React.ReactNode;
  content: string;
  wrapperClass?: string;
}) {
  return (
    <span className={`relative group/tip inline-flex ${wrapperClass ?? ""}`}>
      {children}
      {/* Tooltip bubble */}
      <span
        className="
          absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50
          pointer-events-none select-none
          opacity-0 group-hover/tip:opacity-100
          transition-opacity duration-150 delay-0 group-hover/tip:delay-200
        "
      >
        <span className="block w-max max-w-[280px] rounded-lg border border-zinc-700/60 bg-[#1a1a2e] px-3 py-2 text-xs text-zinc-300 leading-relaxed shadow-xl shadow-black/60">
          {content}
        </span>
        {/* Arrow pointing down toward the trigger */}
        <span className="absolute left-1/2 top-full -translate-x-1/2 border-[5px] border-transparent border-t-[#1a1a2e]" />
      </span>
    </span>
  );
}
