import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-[28px] border border-white/70 bg-white/78 shadow-[var(--shadow)] backdrop-blur-xl", className)}
      {...props}
    />
  );
}

export function SelectableCard({
  selected,
  className,
  ...props
}: React.HTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "min-h-24 rounded-3xl border bg-white/70 p-5 text-left text-sm font-medium text-[#262036] shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-[#c8baff] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        selected ? "border-[#7c5cff] bg-[#f5f1ff] text-[#2d1c78] shadow-[0_14px_34px_rgba(124,92,255,0.16)]" : "border-[#e9e2f0]",
        className,
      )}
      {...props}
    />
  );
}
