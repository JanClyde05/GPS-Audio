# GuardianTrack — Bold Typography & Minimalist UI Design Specifications

This document defines the architectural rules, spatial mathematics, and typographic design system for the **GuardianTrack Parent Dashboard Web Application**.

---

## 1. Bold Typographic Hierarchy & Character

High-contrast typographic weights (`Bold 700` to `Black 900`) establishing confident structure without relying on decorative ornament or visual noise.

* **Primary Display Font:** `Plus Jakarta Sans` (Weights: `700 Bold`, `800 ExtraBold`, `900 Black`)
* **Telemetry & Monospace Font:** `JetBrains Mono` (Weights: `500 Medium`, `700 Bold`)
* **Tracking & Letter Spacing:** Headings use `tracking-tight` (`-0.025em`) for punchy visual authority.
* **Tabular Figures:** All numeric telemetry indicators (coordinates, battery percentage, signal %, timestamps) use monospace tabular alignment to prevent layout shifts.

---

## 2. Modular 8pt Grid & Spatial Mathematics

All container dimensions, gutters, and paddings adhere strictly to an 8-point base unit scale (`8px`, `16px`, `24px`, `32px`, `48px`).

* **Outer vs. Inner Padding:** Container outer padding (`≥20px`) always equals or exceeds child spacing (`8–16px`).
* **Nested Corner Radius Mathematics:** `Inner Radius = Outer Radius - Container Padding` to eliminate visual corner collision.
* **Responsive Grid Layout:**
  - **Mobile:** Single-column fluid layout (`< 1024px`).
  - **Desktop:** Unnested 2-column bento modular layout (`lg:grid-cols-12`). Left stage (7 cols for map), right column (5 cols for audio incident stream).

---

## 3. Focused Monochromatic Palette & Contrast Control

Surfaces rely on calibrated monochromatic neutrals (`Slate/Zinc 50–950`) with strict **WCAG AA contrast (`≥ 4.5:1`)**.

* **Surface Base (Light):** `#FAFAFA`
* **Elevated Layer (Light):** `#F4F4F5`
* **Deep Canvas (Dark):** `#18181B`
* **Ink High Contrast (Dark):** `#09090B`
* **Accent Accents:**
  - `Emerald 500` (`#10B981`): Online connectivity & live status dot.
  - `Blue 500` (`#3B82F6`): Active live telemetry marker.
  - `Red 500` (`#EF4444`): Emergency audio alerts & critical incidents.

---

## 4. Anti-Slop Discipline & Negative Space

* **No Nested Containers:** Cards inside cards are strictly prohibited; hierarchy is built using subtle hairline borders (`1px solid var(--border)`) and clean typographic scale.
* **Zero Tacky Gimmicks:** Banned glowing drop shadows, cyan-on-dark text, and arbitrary neon borders.
* **Single-Line Atomic Badges:** Labels, chips, and telemetry metadata never wrap or truncate awkwardly inside pill containers.

---

## 5. Z-Index Stacking Context Hierarchy

To ensure the Leaflet map pane never overlaps modals, headers, audio cards, or toast notifications:

| Element | CSS Selector | Z-Index |
| :--- | :--- | :--- |
| **Leaflet Base Container** | `.leaflet-container` | `z-index: 1 !important` |
| **Leaflet Map Controls** | `.leaflet-pane`, `.leaflet-control` | `z-index: 10 !important` |
| **Header Toolbar** | `#app-header` | `z-index: 50 !important` |
| **Toast Notifications** | `.toast-container` | `z-index: 9990 !important` |
| **Audio / Incident Modals** | `.modal`, `[role="dialog"]` | `z-index: 9999 !important` |
