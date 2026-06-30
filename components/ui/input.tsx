import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-12 w-full rounded-2xl border border-[#e7e1ee] bg-white/80 px-4 text-sm text-[#16131d] outline-none transition placeholder:text-[#9a93a4] focus:border-[#b7a7ff] focus:ring-4 focus:ring-[#7c5cff]/10",
        className,
      )}
      {...props}
    />
  ),
);

Input.displayName = "Input";

export { Input };
