import { cn } from "@/lib/utils";

export function PageLayout({
  children,
  className,
}: Readonly<{
  children: React.ReactNode;
  className?: string;
}>) {
  return <main className={cn("min-h-screen px-5 py-6 sm:px-8 lg:px-10", className)}>{children}</main>;
}
