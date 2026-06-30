import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex h-12 items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold transition duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#fbfaf8] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-[#7c5cff] text-white shadow-[0_16px_34px_rgba(124,92,255,0.28)] hover:bg-[#6c4ced]",
        secondary: "border border-[#e7e1ee] bg-white/70 text-[#262036] hover:bg-white",
        ghost: "text-[#4d31c7] hover:bg-[#ede7ff]",
      },
      size: {
        default: "h-12 px-6",
        sm: "h-10 px-4",
        lg: "h-14 px-8 text-base",
        icon: "h-11 w-11 px-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);

Button.displayName = "Button";

export { Button, buttonVariants };
