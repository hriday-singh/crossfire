import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium font-mono transition-colors focus:outline-none focus:ring-1 focus:ring-ring select-none",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-zinc-900 text-white shadow-sm hover:bg-zinc-800",
        secondary:
          "border-transparent bg-zinc-100 text-zinc-900 hover:bg-zinc-200",
        destructive:
          "border-rose-200 bg-rose-50 text-rose-800 shadow-sm hover:bg-rose-100",
        outline: "text-zinc-900 border-zinc-200",
        survived: "bg-emerald-50 text-emerald-800 border-emerald-200/80",
        weakened: "bg-amber-50 text-amber-800 border-amber-200/80",
        broken: "bg-rose-50 text-rose-800 border-rose-200/80",
        unresolved: "bg-indigo-50 text-indigo-800 border-indigo-200/80",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
