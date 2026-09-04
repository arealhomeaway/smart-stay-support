import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80",
        outline: "text-foreground",
        // Semantic tones — one meaning each, matching the shared palette in
        // src/lib/semantic.ts. Use these instead of hand-rolled className
        // overrides so a status badge always carries the same meaning.
        success: "border-sage/25 bg-sage/10 text-sage",
        warning: "border-amber/25 bg-amber/10 text-amber",
        danger: "border-coral/25 bg-coral/10 text-coral",
        info: "border-sky/25 bg-sky/10 text-sky",
        review: "border-lavender/25 bg-lavender/10 text-lavender",
        neutral: "border-cool-grey/25 bg-cool-grey/10 text-cool-grey",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
