# Company Lookup Branding Guidelines

Our goal is a "Swiss Modern" aesthetic—a minimalist, typography-first design that honors the heritage of Swiss graphic design (International Typographic Style) while feeling like a fast, contemporary SaaS product.

## 1. Design Philosophy

- **Functionalism First:** The data is the hero. Design serves the readability and scanability of company information.
- **The Grid:** Everything should align to a strict, consistent grid system. No "floating" elements.
- **Asymmetry:** Use white space and alignment (left-aligned) to create visual interest rather than decorative elements.
- **Objectivity:** No heavy shadows, gradients, or rounded corners (use tight radii like `4px` or `8px` at most).

## 2. Typography

We use **Geist** (Sans & Mono) as our primary typeface.

- **Headers (Sans):** Bold, high contrast, tight tracking.
- **Body (Sans):** Clean, generous line height (`leading-relaxed`) for purpose/activity texts.
- **Technical Data (Mono):** UIDs (`CHE-123.456.789`), dates, and numeric values should use `Geist Mono` for perfect alignment.

## 3. Color Palette

A high-contrast monochromatic base with a single, deliberate accent.

| Category | Light Mode | Dark Mode | Usage |
| :--- | :--- | :--- | :--- |
| **Background** | `white` (`#FFFFFF`) | `black` (`#000000`) | Main page surface |
| **Surface** | `zinc-50` | `zinc-950` | Cards and section fills |
| **Border** | `zinc-200` | `zinc-800` | 1px dividers and outlines |
| **Text (Primary)** | `zinc-950` | `zinc-50` | Headings and core data |
| **Text (Secondary)** | `zinc-500` | `zinc-400` | Labels and metadata |
| **Accent (Swiss Red)**| `red-600` | `red-500` | Primary buttons, active state dots |

## 4. UI Components

- **Inputs:** Large, borderless or bottom-bordered for the main search. High focus on the "Command-K" pattern.
- **Badges:** Small, uppercase labels with low-opacity background fills (e.g., `bg-red-500/10 text-red-600`).
- **Cards:** Minimal padding (`p-6`), no drop-shadows. Use thin borders or a subtle background shift to separate them.
- **Icons:** Use thin-stroke icons (e.g., Lucide or similar) in `16px` or `20px` sizes.

## 5. Interactions

- **Transitions:** Fast and crisp. No bouncy or slow animations. Use `duration-150` or `duration-200`.
- **States:** Hover states should be a subtle background fill change (e.g., `hover:bg-zinc-100`).
- **Empty States:** Clear, centered, and typography-focused. No large illustrations; use simple text and maybe a single icon.

## 6. Notifications (Toasts)

- **Position:** Bottom-right corner.
- **Design:** Minimalist cards with a simple colored indicator dot/square. No heavy icons.
- **Color Coding:**
  - **Success:** Emerald indicator, white/black background.
  - **Error:** Red indicator, white/black background.
  - **Info:** Zinc indicator, white/black background.
- **Behavior:** Auto-dismiss after 5 seconds. Provide a clear "Close" text button.
- **Typography:** Bold, uppercase text for the message to maintain the "Swiss Modern" technical feel.
