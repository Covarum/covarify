import { Eyebrow, Subheading } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

export function SectionHeader({
  eyebrow,
  title,
  body,
  className,
}: {
  eyebrow?: string;
  title: string;
  body?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mx-auto max-w-3xl text-center", className)}>
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <h2 className="mt-3 font-serif text-4xl font-semibold leading-tight text-[#16131d] sm:text-5xl">{title}</h2>
      {body ? <Subheading className="mt-5">{body}</Subheading> : null}
    </header>
  );
}
