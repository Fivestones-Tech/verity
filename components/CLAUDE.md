# components/ — UI rules

Read `docs/10-design-system.md` and `docs/16-screen-specs.md` first.

- Use only the design tokens in `docs/10` (CSS variables / Tailwind theme). No new colours, fonts or radii.
- Numbers, scores, timestamps → mono font with tabular-nums. Radius 3px for cards, pill for buttons only.
- Brick colour = "needs attention" topic indicator only; never a generic error colour.
- Every component handles loading, empty, error and populated states.
- Mobile-first; 44px minimum touch targets; visible gold focus ring; respect `prefers-reduced-motion`.
- Primitives go in `ui/`; feature components in `student/`, `institution/`, `shared/`. Props typed, no `any`.
- Components never contain security logic. Permission checks happen server-side.
- Reuse `ReadinessCard` for any readiness display; do not rebuild it.
