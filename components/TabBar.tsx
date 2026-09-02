"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useActiveGroup } from "@/lib/active-group";

// Mobildeki alt bar ile ayni: 4 gercek sekme + rota olmayan "Daha Fazla"
// menusu. Mobil oncelikli oldugu icin ekranin altina sabitlenir.

const TABS = [
  { href: "/home", label: "Ana Sayfa", icon: HomeIcon },
  { href: "/groups", label: "Takımlarım", icon: UsersIcon },
  { href: "/matches", label: "Maçlar", icon: CalendarIcon },
  { href: "/profile", label: "Profil", icon: UserIcon },
];

const MORE_ITEMS = [
  { label: "Oylama", path: "vote" },
  { label: "Takım Oluştur", path: "teams" },
  { label: "Puan Detayları", path: "breakdown" },
];

export function TabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { activeGroup } = useActiveGroup();
  const [moreOpen, setMoreOpen] = useState(false);

  function goGroupRoute(path: string) {
    setMoreOpen(false);
    if (activeGroup) router.push(`/group/${activeGroup.id}/${path}`);
  }

  return (
    <>
      {moreOpen && (
        <div className="more-backdrop" onClick={() => setMoreOpen(false)}>
          <div className="more-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="more-header">DAHA FAZLA</div>
            {MORE_ITEMS.map((item) => (
              <button
                key={item.path}
                className="more-item"
                onClick={() => goGroupRoute(item.path)}
                disabled={!activeGroup}
              >
                {item.label}
              </button>
            ))}
            <button
              className="more-item"
              onClick={() => {
                setMoreOpen(false);
                if (activeGroup) router.push(`/group/${activeGroup.id}`);
              }}
              disabled={!activeGroup}
            >
              {activeGroup
                ? `Davet Kodu · ${activeGroup.invite_code}`
                : "Takım seçilmedi"}
            </button>
          </div>
        </div>
      )}

      <nav className="tabbar">
        <div className="tabbar-inner">
          {TABS.map((tab) => {
            const active = pathname === tab.href;
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`tab ${active ? "tab-active" : ""}`}
              >
                <Icon />
                <span>{tab.label}</span>
              </Link>
            );
          })}
          <button
            className={`tab ${moreOpen ? "tab-active" : ""}`}
            onClick={() => setMoreOpen((v) => !v)}
          >
            <MoreIcon />
            <span>Daha Fazla</span>
          </button>
        </div>
      </nav>
    </>
  );
}

// Tasarim sisteminin onerdigi ince cizgili (1.75px) ikon stili.
function svgProps() {
  return {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
}

function HomeIcon() {
  return (
    <svg {...svgProps()}>
      <path d="M3 10.5 12 3l9 7.5M5.5 9.5V21h13V9.5" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg {...svgProps()}>
      <path d="M15.5 20.5v-1.8a3.6 3.6 0 0 0-3.6-3.6H6.1a3.6 3.6 0 0 0-3.6 3.6v1.8M9 12.2a3.85 3.85 0 1 0 0-7.7 3.85 3.85 0 0 0 0 7.7M21.5 20.5v-1.8a3.6 3.6 0 0 0-2.7-3.48M16 4.7a3.85 3.85 0 0 1 0 7.46" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg {...svgProps()}>
      <path d="M4 6h16v15H4zM4 10.5h16M8.5 3v4M15.5 3v4M8.5 15h7" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg {...svgProps()}>
      <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8M4.5 21v-1.5a5 5 0 0 1 5-5h5a5 5 0 0 1 5 5V21" />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg {...svgProps()} strokeWidth={2.6}>
      <path d="M5.5 12h.01M12 12h.01M18.5 12h.01" />
    </svg>
  );
}
