import { cn } from "@/lib/utils";

export function Eyebrow({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-xs font-semibold uppercase tracking-normal text-[#7c5cff]", className)} {...props} />;
}

export function Heading({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h1
      className={cn(
        "font-serif text-5xl font-semibold leading-[1.02] text-[#16131d] sm:text-6xl lg:text-7xl",
        className,
      )}
      {...props}
    />
  );
}

export function Subheading({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-lg leading-8 text-[#5f586b] sm:text-xl", className)} {...props} />;
}
