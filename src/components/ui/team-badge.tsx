"use client";

import { getTeam } from "@/lib/utils";

type Size = "sm" | "md" | "lg";

interface TeamBadgeProps {
  abbr: string;
  size?: Size;
  selected?: boolean;
  onClick?: () => void;
  showName?: boolean;
}

const sizeStyles: Record<Size, { circle: string; text: string; label: string }> = {
  sm: { circle: "w-8 h-8 text-xs",   text: "font-bold", label: "text-xs" },
  md: { circle: "w-12 h-12 text-sm", text: "font-bold", label: "text-xs" },
  lg: { circle: "w-16 h-16 text-base",text: "font-bold", label: "text-sm" },
};

export function TeamBadge({ abbr, size = "md", selected = false, onClick, showName = true }: TeamBadgeProps) {
  const team = getTeam(abbr);
  const styles = sizeStyles[size];
  const mascot = team.name.split(" ").at(-1) ?? team.name;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-1 transition-all duration-200 ${onClick ? "cursor-pointer" : "cursor-default"} ${selected ? "scale-110" : "hover:scale-105"}`}
    >
      <div
        className={`${styles.circle} ${styles.text} rounded-full flex items-center justify-center text-white shadow-lg transition-all duration-200 ${selected ? "ring-2 ring-white ring-offset-2 ring-offset-slate-900" : ""}`}
        style={{ backgroundColor: team.color, borderBottom: `3px solid ${team.color2}` }}
      >
        {team.abbreviation}
      </div>
      {showName && (
        <span className={`${styles.label} font-medium ${selected ? "text-white" : "text-slate-400"}`}>
          {mascot}
        </span>
      )}
    </button>
  );
}
