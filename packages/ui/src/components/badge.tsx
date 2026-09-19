import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "cn";

const badgeVariants = cva(
  "inline-flex w-fit items-center gap-1 rounded-full border px-2 py-1 text-xs leading-none font-semibold",
  {
    variants: {
      variant: {
        neutral: "border-border bg-muted text-muted-foreground",
        critical: "border-severity-critical/35 bg-severity-critical/10 text-severity-critical",
        high: "border-severity-high/35 bg-severity-high/10 text-severity-high",
        medium: "border-severity-medium/35 bg-severity-medium/10 text-severity-medium",
        low: "border-severity-low/35 bg-severity-low/10 text-severity-low",
        fact: "border-evidence-fact/35 bg-evidence-fact/10 text-evidence-fact",
        heuristic: "border-evidence-heuristic/35 bg-evidence-heuristic/10 text-evidence-heuristic",
        recommendation:
          "border-evidence-recommendation/35 bg-evidence-recommendation/10 text-evidence-recommendation",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  },
);

type BadgeProps = ComponentProps<"span"> & VariantProps<typeof badgeVariants>;

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
export type { BadgeProps };
