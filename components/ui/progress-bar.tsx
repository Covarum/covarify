import { cn } from "@/lib/utils";

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  const safeValue = Math.min(100, Math.max(0, value));

  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-[#ebe5f2]", className)}>
      <div
        className="h-full rounded-full bg-[#7c5cff] transition-all duration-500 ease-out"
        style={{ width: `${safeValue}%` }}
      />
    </div>
  );
}
