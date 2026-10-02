# Avenza Frontend Architecture & Design System (Phase 4)

## 1. Overview
Avenza's visual identity embodies **Minimal, Technical, Premium, Intelligent, and Calm**.
Phase 4 establishes the production-grade visual foundation, design tokens, typography, true light and dark themes, application shell, command palette, and reusable UI primitives.

In accordance with strict phase boundaries, Phase 4 includes **no fake data, mock metrics, or premature domain business logic**.

---

## 2. Color System & Design Tokens
All color styling flows through semantic CSS variables defined in `apps/web/src/index.css` and extended in `apps/web/tailwind.config.js`. Raw hex codes are never scattered across ad-hoc component styles.

### Avenza Palette
| Theme | Role | Hex Code | Semantic Token |
|---|---|---|---|
| **Light** | Navy | `#2F4156` | `--primary` |
| **Light** | Teal | `#567C8D` | `--secondary`, `--accent`, `--focus-ring` |
| **Light** | Pale Blue | `#C8D9E6` | `--border` |
| **Light** | Beige | `#F5EFEB` | `--background` |
| **Light** | White | `#FFFFFF` | `--surface` |
| **Light** | Primary Text | `#172536` | `--foreground` |
| **Dark** | Background | `#101820` | `--background` |
| **Dark** | Surface | `#172330` | `--surface` |
| **Dark** | Surface 2 | `#20303D` | `--surface-2` |
| **Dark** | Teal | `#6F9BAD` | `--primary`, `--focus-ring` |
| **Dark** | Pale Blue | `#C8D9E6` | `--accent` |
| **Dark** | Primary Text | `#F5F7FA` | `--foreground` |
| **Dark** | Muted Text | `#AAB8C2` | `--muted-foreground` |

### Functional State Tokens
- `--success`: Emerald (`#2A7B54` Light / `#3E9A68` Dark)
- `--warning`: Amber (`#B26A18` Light / `#DE9B35` Dark)
- `--danger`: Crimson (`#BA3A3A` Light / `#E05656` Dark)
- `--info`: Ocean (`#2F6182` Light / `#6F9BAD` Dark)

---

## 3. Typography Scale & Fonts
- **Primary Interface**: Inter (`font-sans`) — headings, navigation, labels, body, buttons, and form inputs.
- **Technical & Numeric**: JetBrains Mono (`font-mono`) — identifiers, timestamps, metrics, code, badges, keyboard shortcuts.
- **Density & Restraint**: Typography is tuned for high information density without visual clutter.

---

## 4. Geometry & Spacing Philosophy
- Small radius: `4–6px` (`rounded-sm`, `rounded`)
- Medium radius: `6–8px` (`rounded-md`, `rounded-lg`)
- Large radius: `8–12px` (`rounded-xl`, `rounded-2xl`)
- Overly circular cards and bubbly geometry are avoided in favor of precise, subtle borders (`border-border`, `border-border-subtle`).

---

## 5. Theme System
Implemented in `apps/web/src/lib/theme.tsx`:
- **Modes**: `light`, `dark`, and `system` (matches OS preference via `prefers-color-scheme`).
- **Persistence**: Preference is saved under `avenza-theme` in `localStorage`.
- **True Dark Mode**: Dark mode is independently designed with a dedicated surface hierarchy (`#101820` &rarr; `#172330` &rarr; `#20303D`) rather than naive color inversion.

---

## 6. Application Shell Architecture
Located in `apps/web/src/components/shell/`:
```
--------------------------------------------------
| Sidebar | Topbar                               |
| (64px   |--------------------------------------|
| /240px) | Breadcrumbs / Page Context           |
|         |                                      |
|         | Main Content Viewport (<main>)       |
|         |                                      |
--------------------------------------------------
```
- **Desktop Sidebar**: Fixed sidebar with width `240px` (expanded) or `64px` (collapsed). Preference is persisted in `localStorage` under `avenza-sidebar-collapsed`.
- **Mobile Drawer**: Slide-out drawer sheet with backdrop overlay on screens `< 1024px`. Automatically closes upon route navigation.
- **Topbar**: Sticky topbar housing the mobile drawer toggle, breadcrumb trail, command palette trigger (`⌘K`), theme switcher, and Clerk user account button.
- **Breadcrumbs**: Reusable component supporting explicit items or automatic pathname derivation with mobile truncation.

---

## 7. Command Palette Foundation
- **Shortcut**: `Cmd + K` (macOS) or `Ctrl + K` (Windows/Linux).
- **Extensible Registry**: Grouped by `Navigation`, `Preferences`, and `Development`.
- **Safe Operations**: Initial operations are strictly safe UI actions (navigating routes, switching theme, toggling sidebar).
- **Keyboard Traversal**: Arrow Up / Down navigation, Enter to execute, Escape to dismiss, combobox ARIA roles.

---

## 8. UI Primitives Library
Located in `apps/web/src/components/ui/` with zero business logic:
- **Buttons**: `Button`, `IconButton` with variants (`primary`, `secondary`, `outline`, `ghost`, `danger`, `link`), sizes (`sm`, `md`, `lg`, `icon`), and loading spinner state.
- **Forms**: `Input`, `Textarea`, `Select`, `Checkbox`, `Radio`, `Switch`, `Label` with full `aria-invalid`, `aria-describedby`, error messages, and disabled states.
- **Surfaces**: `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`.
- **Data Display**: `Stat`, `Badge`, `Progress` (determinate and indeterminate), `Table`, `Tabs`, `Pagination`, `Timeline`, `ActivityFeed`.
- **Feedback**: `Alert`, `Spinner`, `Skeleton`, `EmptyState`, `ErrorState` with retry callback, `ToastProvider` / `useToast`.
- **Overlays**: `Modal` (with focus trap and Escape handler), `ConfirmationDialog`, `Tooltip`.

---

## 9. Routes & Development Showcase
All navigation items route to real, type-safe views:
- `/overview`: Preserves Phase 3 authenticated Clerk session & Fastify profile resolution (`/api/v1/auth/me`).
- `/settings`: Appearance settings, profile information, and future connected accounts section.
- `/design-system`: Visual QA showcase for inspecting all tokens, typography, buttons, forms, tables, modals, alerts, and theme switching.
- `/today`, `/academics/*`, `/dsa`, `/projects`, `/career`, `/goals`, `/calendar`, `/planner`, `/analytics`, `/weekly-review`, `/ai-coach`: Safe placeholder views clearly indicating future implementation phases with zero fabricated data.

---

## 10. Accessibility (a11y)
- Visible focus rings with `--focus-ring` token.
- `role="dialog"`, `role="combobox"`, `role="alert"`, `role="status"`, `role="tablist"`, `role="progressbar"`.
- Focus trap and focus restoration on modals and command palette.
- Semantic HTML elements (`<header>`, `<aside>`, `<nav>`, `<main>`, `<table>`).
- Respects `prefers-reduced-motion` media queries globally.
