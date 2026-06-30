import * as React from "react";
import { motion } from "framer-motion";
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
}: React.ComponentProps<typeof motion.button> & { selected?: boolean }) {
  return (
    <motion.button
      type="button"
      aria-pressed={selected}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.985 }}
      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "min-h-28 rounded-[26px] border bg-white/76 p-5 text-left text-sm font-medium text-[#262036] shadow-[0_8px_24px_rgba(54,36,99,0.06)] outline-none transition-colors duration-200 hover:border-[#c8baff] hover:bg-white hover:shadow-[0_16px_40px_rgba(54,36,99,0.1)] focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[#fbfaf8]",
        selected
          ? "border-[#7c5cff] bg-[#f6f2ff] text-[#2d1c78] shadow-[0_18px_42px_rgba(124,92,255,0.15)]"
          : "border-[#e9e2f0]",
        className,
      )}
      {...props}
    />
  );
}
