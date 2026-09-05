"use client";

import { useState } from "react";
import { useActiveGroup } from "@/lib/active-group";
import { brand } from "@/lib/brand";

// Sol ustteki takim kapsami secici. Ana sayfa ve Maclar sekmesinde ayni
// bilesen kullanilir; secim ortak context'te tutuldugu icin sekmeler arasi
// gecerken korunur.
export function TeamSwitcher({
  eyebrow = `${brand.nameUpper} · TAKIM`,
}: {
  eyebrow?: string;
}) {
  const { groups, activeGroup, isAll, setScope } = useActiveGroup();
  const [open, setOpen] = useState(false);

  const label = isAll ? "Tüm takımlar" : (activeGroup?.name ?? "Takım seç");

  return (
    <div>
      <span className="eyebrow">{eyebrow}</span>
      <button className="team-switch" onClick={() => setOpen((v) => !v)}>
        {label}
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <path d={open ? "m18 15-6-6-6 6" : "m6 9 6 6 6-6"} />
        </svg>
      </button>

      {open && (
        <div className="card card-raised" style={{ padding: 0, marginTop: 8 }}>
          <button
            className="switcher-row"
            onClick={() => {
              setScope(null);
              setOpen(false);
            }}
          >
            Tüm takımlar
            {isAll && <span className="pill pill-brand">Aktif</span>}
          </button>
          {groups.map((g) => (
            <button
              key={g.id}
              className="switcher-row"
              onClick={() => {
                setScope(g.id);
                setOpen(false);
              }}
            >
              {g.name}
              {g.id === activeGroup?.id && <span className="pill pill-brand">Aktif</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
