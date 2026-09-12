import { extendTailwindMerge } from "tailwind-merge";

// Plain tailwind-merge only recognizes Tailwind's built-in class values, so our custom
// theme utilities (rounded-card, shadow-card) don't get deduped against their standard
// counterparts (rounded-full, shadow-none, ...) without registering them here — without
// this, a later conflicting class silently loses or wins by accident of generation order
// instead of by the last one specified, which is what every caller actually expects.
export const cn = extendTailwindMerge({
  extend: {
    classGroups: {
      rounded: ["rounded-card"],
      shadow: ["shadow-card"],
    },
  },
});
