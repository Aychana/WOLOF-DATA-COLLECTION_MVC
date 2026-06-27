---
name: Wolof Voice Archive
colors:
  surface: '#f9faf7'
  surface-dim: '#d9dad8'
  surface-bright: '#f9faf7'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f4f1'
  surface-container: '#edeeeb'
  surface-container-high: '#e7e8e6'
  surface-container-highest: '#e2e3e0'
  on-surface: '#191c1b'
  on-surface-variant: '#42474d'
  inverse-surface: '#2e312f'
  inverse-on-surface: '#f0f1ee'
  outline: '#73777d'
  outline-variant: '#c2c7cd'
  surface-tint: '#43617b'
  primary: '#00243b'
  on-primary: '#ffffff'
  primary-container: '#1a3a52'
  on-primary-container: '#85a4c0'
  inverse-primary: '#abcae8'
  secondary: '#006c49'
  on-secondary: '#ffffff'
  secondary-container: '#6cf8bb'
  on-secondary-container: '#00714d'
  tertiary: '#331d00'
  on-tertiary: '#ffffff'
  tertiary-container: '#503000'
  on-tertiary-container: '#df8f00'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#cce5ff'
  primary-fixed-dim: '#abcae8'
  on-primary-fixed: '#001e31'
  on-primary-fixed-variant: '#2b4a62'
  secondary-fixed: '#6ffbbe'
  secondary-fixed-dim: '#4edea3'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#ffddb8'
  tertiary-fixed-dim: '#ffb95f'
  on-tertiary-fixed: '#2a1700'
  on-tertiary-fixed-variant: '#653e00'
  background: '#f9faf7'
  on-background: '#191c1b'
  surface-variant: '#e2e3e0'
typography:
  display-lg:
    fontFamily: Be Vietnam Pro
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Be Vietnam Pro
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
  headline-lg-mobile:
    fontFamily: Be Vietnam Pro
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
  headline-md:
    fontFamily: Be Vietnam Pro
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  container-margin: 16px
  gutter: 16px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 24px
  section-gap: 40px
---

## Brand & Style

This design system is built on the concept of **"The Digital Baobab"**—a central, warm, and communal space for gathering oral wisdom. It balances the technical precision required for high-quality audio data collection with the vibrant, organic warmth of Wolof culture. 

The aesthetic is **Modern-Organic**. It utilizes clean, functional layouts to ensure accessibility for a wide range of users (from tech-savvy youth to community elders), while integrating subtle rhythmic patterns and a sun-drenched palette to evoke a sense of pride and collaboration. The emotional response should be one of trust, inclusivity, and rhythmic energy.

## Colors

The palette is rooted in a deep **Indigo Navy**, representing the depth of language and the authority of the data being collected. This is energized by **Emerald Green** (growth and community) and **Saffron Yellow** (warmth and sunlight), which act as functional accents for recording states and success messages.

To ensure WCAG AA compliance, text is kept to a high-contrast **Charcoal**. The background uses an **Off-White** finish to reduce eye strain during long recording sessions, providing a softer canvas than pure white.

## Typography

The typographic strategy pairs **Be Vietnam Pro** for headlines and **Inter** for functional text. 

Be Vietnam Pro offers a friendly, contemporary character with open apertures that feel welcoming and legible. It is used for all "human-centric" moments—greetings, prompts, and titles. Inter is utilized for the "utility-centric" moments—audio metadata, settings, and data inputs—ensuring maximum legibility and a systematic feel. 

Large display sizes include a slight negative letter spacing to create a tighter, more modern editorial look for mobile headers.

## Layout & Spacing

This design system follows a **Mobile-First Fluid Grid** philosophy. On mobile devices, it utilizes a 4-column structure with 16px side margins. On tablet and desktop, the content is contained within a max-width of 1200px to maintain readability.

The spacing rhythm is strictly based on an **8px linear scale**. Use `stack-md` (16px) for standard grouping of elements like input labels and fields, and `section-gap` (40px) to separate distinct functional areas of the app, such as the recording interface from the history list.

## Elevation & Depth

To maintain an organic and accessible feel, the design system avoids heavy shadows. Instead, it uses **Tonal Layering** combined with high-diffusion, low-opacity shadows. 

Depth is primarily communicated through surface color changes. The base layer is the Off-White background; interactive cards sit one level above with a subtle `#1a3a52` (Indigo) tinted shadow at 4% opacity. 

When an element is "active" (e.g., a card being pressed), it loses its shadow and slightly scales down (0.98x), mimicking physical compression. Backdrop blurs (12px) are reserved for navigation bars and modal overlays to maintain context without clutter.

## Shapes

The shape language is **Rounded (Level 2)**. A standard radius of `0.5rem` (8px) is applied to buttons, input fields, and cards. This provides a soft, approachable feel that avoids the clinical sharpness of square corners while remaining more structured than a full "pill" shape.

Large containers like bottom sheets or prominent dashboard cards should utilize `rounded-xl` (24px) for their top corners to emphasize the "organic" and "modern" nature of the interface.

## Components

### Buttons
- **Primary:** Filled Indigo Navy (#1a3a52) with white text. 12px padding (vertical) and 24px (horizontal).
- **Secondary (Action):** Emerald Green (#10b981) for "Submit" or "Success" actions.
- **Recording Button:** A large, circular Saffron Yellow (#f59e0b) button. When active, it pulses with a 10% opacity Emerald Green ring to indicate capturing audio.

### Cards & Lists
- Cards use a 1px border (#e5e7eb) and a subtle shadow. 
- In list views, cards are separated by 12px to allow for organic background patterns to peek through the gutters.

### Input Fields
- 16px base font size to prevent iOS auto-zoom. 
- Borders are 1.5px thick for clear accessibility. The active state uses an Indigo Navy border with a 2px outer "focus ring" of 20% Indigo.

### Specialized Components
- **Waveform Visualizer:** Uses a dual-tone approach—Saffron for the background (unplayed) and Indigo for the active progress.
- **Progress Chips:** Small, rounded-full labels in Emerald Green with 10% opacity backgrounds to denote "Verified" or "Completed" recordings.
- **Organic Motifs:** Use light, SVG-based geometric patterns inspired by Wolof weaving (Thieboudienne-style geometry) at 3% opacity in the background of main dashboards.