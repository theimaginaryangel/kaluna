# Handoff Report: Kaluna Design System & Motion Specification

## 1. Observation

- **Target Directory**: `d:\New folder (6)\kaluna\kaluna\.agents\teamwork_preview_explorer_m1_3`
- **Output Artifact**: `.agents/teamwork_preview_explorer_m1_3/design_system_spec.md`
- **Existing Frontend Codebase State**: Inspected `d:\New folder (6)\kaluna\kaluna\frontend` directory using `list_dir`, which returned `Empty directory`. Frontend implementation will be initialized based on the defined specs.
- **Project Context**: `PROJECT.md` documents Kaluna as a Serverless Ticketing Platform with endpoints for events, registrations, check-in, and analytics.

---

## 2. Logic Chain

1. **Tailwind CSS Theme Configuration**:
   - Primary requirement: Establish custom colors, utilities, and custom easings for Kaluna.
   - Solution: Formulated a complete `tailwind.config.js` theme extension featuring `kaluna.pink` (`#FF2D87`), dark mode surface colors (`#090A0F`, `#141622`, `#1B1E2E`, `#272B40`), custom transition timing functions (`apple-spring` and `material-bouncy`), and custom shimmer/ripple keyframes. Added custom CSS utility rules for focus rings and shimmer skeletons in `@layer utilities`.

2. **Accent Color Governance Rules (`#FF2D87`)**:
   - Primary requirement: Strictly forbid static text or static background usage of hot pink (`#FF2D87`); restrict usage strictly to interactive and motion states.
   - Solution: Detailed a strict governance matrix categorizing static vs interactive states. Standardized rule: `#FF2D87` is allowed ONLY on hovers (`hover:text-[#FF2D87]`, `hover:border-[#FF2D87]`), focus-visible rings (`focus-visible:ring-2 focus-visible:ring-[#FF2D87]`), active press states, click ripples (`rgba(255, 45, 135, 0.25)` expansion wave), SVG icon state toggles, and pink shimmer skeleton animations.

3. **Motion Specifications & Variants**:
   - Primary requirement: Define Framer Motion variants and CSS keyframes for Apple-style spring easing, Material-style bouncy elevation, and Pink shimmer skeletons.
   - Solution:
     - *Apple-style spring easing (`cubic-bezier(0.25, 0.1, 0.25, 1)`)*: Defined `pageRevealVariants`, `staggerContainerVariants`, `staggerItemVariants`, and `modalSpringVariants` for fluid route/container reveals.
     - *Material-style bouncy elevation (`cubic-bezier(0.34, 1.56, 0.64, 1)`)*: Defined `buttonBouncyVariants`, `cardElevationVariants`, and `rippleVariants` for elastic press and hover elevation.
     - *Pink shimmer loading skeletons*: Created `PinkShimmerSkeleton` React component with a continuous `translateX` motion sweep utilizing a `#FF2D87` gradient overlay.

---

## 3. Caveats

- The `frontend` directory is currently empty. The proposed Tailwind CSS configuration and Framer Motion components are ready for copy-paste deployment once the React / Next.js frontend scaffold is initialized.
- High-contrast compliance for accessibility (WCAG AA) relies on combining `#FF2D87` hover outlines with high-contrast text (`text-slate-100` / `text-white`) on dark backgrounds (`#090A0F` / `#141622`).

---

## 4. Conclusion

The Design System and Motion Specification for Kaluna is fully formulated and documented in `.agents/teamwork_preview_explorer_m1_3/design_system_spec.md`. It provides complete theme configuration, strict governance for `#FF2D87` hot pink accent color, and reusable Framer Motion variants for Apple-style spring transitions, Material-style bouncy elevation, and pink shimmer skeletons.

---

## 5. Verification Method

To independently verify the design system specification:

1. **Inspect Specification File**:
   - Read `.agents/teamwork_preview_explorer_m1_3/design_system_spec.md` to verify all 4 required sections (Tailwind config, Governance rules, Framer Motion variants, Component examples) are present.
2. **Check Accent Governance Rules**:
   - Verify that `#FF2D87` is explicitly restricted from static text/background usage and reserved strictly for `hover`, `focus-visible`, `active`, `ripple`, `SVG fill`, and `shimmer` states.
3. **Check Motion Easings**:
   - Verify presence of Apple-style spring easing: `cubic-bezier(0.25, 0.1, 0.25, 1)`.
   - Verify presence of Material-style bouncy elevation: `cubic-bezier(0.34, 1.56, 0.64, 1)`.
   - Verify presence of pink shimmer skeleton gradient sweep featuring `#FF2D87`.
