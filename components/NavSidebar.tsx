"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function IconPlus({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function IconRadar({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
      <line x1="2" y1="12" x2="6" y2="12" />
      <line x1="18" y1="12" x2="22" y2="12" />
      <line x1="12" y1="2" x2="12" y2="6" />
      <line x1="12" y1="18" x2="12" y2="22" />
    </svg>
  );
}

function IconHome({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" />
      <path d="M9 21V12h6v9" />
    </svg>
  );
}

function IconBookmark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function IconLibrary({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  );
}

export function NavSidebar() {
  const pathname = usePathname();

  const navLinks = [
    {
      href: "/",
      icon: IconHome,
      label: "Home",
      active: pathname === "/",
    },
    {
      href: "/radar",
      icon: IconRadar,
      label: "Radar",
      active: pathname.startsWith("/radar"),
    },
    {
      href: "/library",
      icon: IconLibrary,
      label: "Library",
      active:
        pathname.startsWith("/library") || pathname.startsWith("/research"),
    },
    {
      href: "/watchlist",
      icon: IconBookmark,
      label: "Watchlist",
      active: pathname.startsWith("/watchlist"),
    },
  ];

  return (
    <nav className="fixed left-0 top-0 bottom-0 w-14 flex flex-col items-center pt-5 pb-6 bg-[#0a0a0f] border-r border-zinc-700/50 z-40">
      {/* Logo dot */}
      <div className="w-2 h-2 rounded-full bg-emerald-400 mb-4" />

      {/* New thesis — action CTA, no active state */}
      <Link href="/" title="New thesis">
        <span className="flex items-center justify-center w-10 h-10 rounded-xl mb-3 border border-zinc-700 text-zinc-500 hover:text-zinc-200 hover:border-zinc-500 hover:bg-zinc-900/60 transition-colors">
          <IconPlus />
        </span>
      </Link>

      {/* Divider */}
      <div className="w-5 border-t border-zinc-700/60 mb-3" />

      {/* Nav icons */}
      <div className="flex flex-col items-center gap-1">
        {navLinks.map(({ href, icon: Icon, label, active }) => (
          <Link key={href} href={href} title={label}>
            <span
              className={`flex items-center justify-center w-10 h-10 rounded-xl transition-colors ${
                active
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-600 hover:text-zinc-300 hover:bg-zinc-900/60"
              }`}
            >
              <Icon />
            </span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
