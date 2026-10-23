import { tigerSvg, type MarkVariant } from "@/components/brand/tigerSvg";

const MARKUP: Record<MarkVariant, string> = { hero: tigerSvg("hero"), nav: tigerSvg("nav") };

/** The animated winged-tiger mark. The markup is generated from fixed shapes, never from user input. */
export function WingedTiger({ variant, className = "" }: { variant: MarkVariant; className?: string }) {
  return <span className={`block [&>svg]:block [&>svg]:h-auto [&>svg]:w-full ${className}`} dangerouslySetInnerHTML={{ __html: MARKUP[variant] }} />;
}
