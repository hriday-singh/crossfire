import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const customTwMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "headline-sm",
            "headline-md",
            "headline-lg",
            "code-sm",
            "code-md",
            "code-lg",
            "body-xs",
            "body-sm",
            "body-md",
            "label-mono",
          ],
        },
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return customTwMerge(clsx(inputs));
}

