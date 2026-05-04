# Garsonista kiosk design

Visual tokens match the legacy web kiosk (`www/css/main.css`, `head.css`). The single source of truth in React Native is `src/theme/kiosk.ts` — import `theme` from `@theme/kiosk` (see also `src/theme/index.ts`).

**Palette (summary):** page greys `#EFEFEF` / `#EBEBEB`, white surfaces, accent `#FF8127`, secondary accent `#FF6400`, login submit `#333333`, text blacks/greys per reference CSS, price chip `#F1F5F9` on `#000`.

Do not add parallel styling systems; extend `kiosk.ts` if you need new tokens.
