# CampusBites Mobile Design System

**Version:** 1.0.0  
**Platform:** Android / Mobile  
**Minimum target:** API 17+  
**Primary typeface:** Inter (bundled app font)  
**Design direction:** Bright, airy, Google-inspired university cafeteria ordering experience

---

## 1. Purpose

This design system defines the visual foundations and reusable UI tokens for CampusBites.

The system is intentionally split into **primitive tokens** and **semantic tokens** so the application can support future theme switching without rewriting component styles.

Core principles:

- White and very light surfaces dominate the interface.
- Bright blue is reserved for actions, active states, progress and meaningful emphasis.
- Primary text is a soft grey-black rather than pure black.
- Borders and elevation are subtle.
- Rounded surfaces and generous spacing create a calm, modern experience.
- Food imagery remains realistic and visually dominant.
- Components should feel lightweight, fast and easy to scan.
- The visual language should feel like a university product, not a generic food-delivery clone.

These principles are based on the supplied CampusBites screen direction: bright blue primary accent, white dominant surfaces, subtle blue-tinted surfaces, soft neutral grey, greyish-black typography, rounded cards, light borders, minimal shadows and generous whitespace. fileciteturn0file0L38-L101

---

# 2. Token Architecture

Use three token layers.

```text
PRIMITIVE TOKENS
    ↓
SEMANTIC TOKENS
    ↓
COMPONENT TOKENS
```

### Primitive tokens

Raw values that describe the palette, spacing scale, radii, type scale and elevations.

Example:

```text
color.blue.500 = #0A8CFF
space.4 = 16dp
radius.lg = 18dp
```

### Semantic tokens

Meaning-based values used by screens and components.

Example:

```text
color.action.primary = color.blue.500
color.text.primary = color.neutral.900
color.surface.default = color.white.500
```

Components should use semantic tokens instead of primitive values.

### Component tokens

Specific values for buttons, cards, inputs, navigation, chips, food cards and other reusable components.

Example:

```text
button.primary.background = color.action.primary
button.primary.cornerRadius = radius.lg
```

This structure allows a future light/dark theme or branded university theme to replace semantic mappings without changing component code.

---

# 3. Color Foundations

## 3.1 Brand blue

CampusBites uses one recognizable bright blue family. Keep the hue consistent across the whole application.

**Primary brand blue:** `#0A8CFF`

This is the main action color used in the generated visual language: bright, clean and highly visible on white without becoming neon.

| Token | Hex | Primary use |
|---|---|---|
| `blue.50` | `#F1F8FF` | Very subtle blue surfaces |
| `blue.100` | `#E4F2FF` | Selected backgrounds, soft highlights |
| `blue.200` | `#CBE5FF` | Soft borders and focus backgrounds |
| `blue.300` | `#9CCFFF` | Secondary accents |
| `blue.400` | `#5FB1FF` | Hover/pressed-prep states |
| `blue.500` | `#0A8CFF` | Primary action / active state |
| `blue.600` | `#087BD9` | Pressed/strong action state |
| `blue.700` | `#0A63B2` | High-contrast blue text on light surfaces |
| `blue.800` | `#084F8F` | Rare high-contrast usage |
| `blue.900` | `#063A69` | Do not use as a primary surface |

### Blue usage rule

Use `blue.500` for:

- Primary buttons
- Active bottom navigation
- Active category chips
- Selected controls
- Progress indicators
- Important links
- Add-to-cart controls
- Order state emphasis
- Small visual accents

Do **not** use blue on every title, card, icon or border.

---

## 3.2 Neutral palette

Avoid pure black for interface text. Use soft grey-black tones.

| Token | Hex | Use |
|---|---|---|
| `neutral.0` | `#FFFFFF` | Main background, cards |
| `neutral.25` | `#FCFDFE` | Elevated white surfaces |
| `neutral.50` | `#F8FAFC` | Page sections |
| `neutral.100` | `#F2F5F8` | Soft secondary surfaces |
| `neutral.150` | `#E9EEF3` | Dividers / subtle filled controls |
| `neutral.200` | `#DDE4EA` | Default borders |
| `neutral.300` | `#C7D0D9` | Stronger borders / disabled outlines |
| `neutral.400` | `#98A3AF` | Placeholder / tertiary text |
| `neutral.500` | `#737E8B` | Secondary text |
| `neutral.600` | `#5B6673` | Supporting text |
| `neutral.700` | `#404B57` | Strong secondary text |
| `neutral.800` | `#2B3440` | Heading/support contrast |
| `neutral.900` | `#1F2933` | Primary text |
| `neutral.950` | `#171D24` | Maximum text contrast; use sparingly |

### Recommended text hierarchy

```text
Primary text      → neutral.900
Secondary text    → neutral.600
Tertiary text     → neutral.500
Placeholder       → neutral.400
Disabled text     → neutral.300 / neutral.400
```

Never use `#000000` for normal UI text.

---

## 3.3 System status colors

Status colors remain restrained so blue stays the main brand identity.

### Success

```text
success.50  = #F0FBF4
success.100 = #DCF6E4
success.500 = #22A559
success.700 = #187A43
```

Used for:

- Open cafeteria
- Ready for pickup
- Confirmed states
- Successful payment

### Warning

```text
warning.50  = #FFF9EC
warning.100 = #FFF0C9
warning.500 = #D99A00
warning.700 = #946900
```

Used for:

- Delayed preparation
- Limited availability
- Attention-needed states

### Error

```text
error.50  = #FFF4F4
error.100 = #FFDCDC
error.500 = #D94A4A
error.700 = #A73232
```

Used for:

- Invalid form values
- Failed payment
- Cancelled order
- Destructive actions

### Informational

```text
info.50  = #F1F8FF
info.100 = #E4F2FF
info.500 = #0A8CFF
info.700 = #0A63B2
```

The info family intentionally maps closely to the brand blue.

---

# 4. Semantic Color Tokens

Components and screens should reference these names.

## Light theme

```text
color.background.app             = neutral.50
color.background.default         = neutral.0
color.background.secondary       = neutral.50
color.background.tertiary        = neutral.100

color.surface.default            = neutral.0
color.surface.raised             = neutral.25
color.surface.subtle             = blue.50
color.surface.selected           = blue.100
color.surface.disabled           = neutral.100

color.text.primary               = neutral.900
color.text.secondary             = neutral.600
color.text.tertiary              = neutral.500
color.text.placeholder           = neutral.400
color.text.disabled              = neutral.400
color.text.inverse               = neutral.0

color.border.default             = neutral.200
color.border.subtle              = neutral.150
color.border.strong              = neutral.300
color.border.focus               = blue.500
color.border.selected            = blue.300

color.action.primary             = blue.500
color.action.primaryPressed      = blue.600
color.action.primaryText        = neutral.0
color.action.secondary           = blue.100
color.action.secondaryText       = blue.700
color.action.link                = blue.600
color.action.disabled            = neutral.200
color.action.disabledText        = neutral.400

color.icon.primary               = neutral.700
color.icon.secondary             = neutral.500
color.icon.tertiary              = neutral.400
color.icon.active                = blue.500
color.icon.disabled              = neutral.300
color.icon.inverse               = neutral.0

color.status.success             = success.500
color.status.warning             = warning.500
color.status.error               = error.500
color.status.info                = info.500
```

## Theme switching rule

Screens should reference semantic tokens only:

```text
Correct:
background = color.surface.default

Avoid:
background = #FFFFFF
```

When implementing themes, only the semantic mapping should change.

---

# 5. Typography

## 5.1 Font family

Primary font:

```text
Inter
```

For Android API 17 compatibility, package Inter inside the application rather than depending on a device-installed font.

Fallback chain:

```text
Inter → sans-serif → system sans-serif
```

The design language supports Google Sans-like proportions, but Inter should be the consistent bundled product font.

---

## 5.2 Font weights

```text
Regular      = 400
Medium       = 500
SemiBold     = 600
Bold         = 700
```

Use weight 700 selectively. Avoid making every label bold.

---

## 5.3 Type scale

All measurements below are Android `sp` values.

| Style | Size | Weight | Line height | Typical use |
|---|---:|---:|---:|---|
| `display.lg` | 32sp | 700 | 40sp | Rare hero heading |
| `display.md` | 28sp | 700 | 36sp | Major screen heading |
| `heading.xl` | 24sp | 700 | 32sp | Primary page title |
| `heading.lg` | 22sp | 700 | 28sp | Feature heading |
| `heading.md` | 20sp | 700 | 26sp | Section heading |
| `title.lg` | 18sp | 600 | 24sp | Card / cafeteria title |
| `title.md` | 16sp | 600 | 22sp | Component title |
| `body.lg` | 16sp | 400 | 24sp | Main body copy |
| `body.md` | 14sp | 400 | 20sp | Supporting text |
| `body.sm` | 13sp | 400 | 18sp | Compact descriptions |
| `label.lg` | 14sp | 600 | 20sp | Buttons / important labels |
| `label.md` | 13sp | 600 | 18sp | Chips / tabs |
| `label.sm` | 12sp | 600 | 16sp | Small metadata |
| `caption` | 11sp | 500 | 16sp | Rare tertiary information |
| `price.lg` | 20sp | 700 | 26sp | Food price |
| `price.md` | 16sp | 700 | 22sp | Compact food price |

### Typography rules

- Use sentence case, not unnecessary all-caps.
- Keep headings short.
- Use `heading.xl` or `heading.lg` for major screen titles.
- Use `heading.md` for sections such as “Campus cafeterias” and “Popular near you”.
- Use `body.md` for supporting descriptions.
- Never shrink primary content below 14sp.
- Keep text contrast high enough for readability on mobile screens.

---

# 6. Spacing Scale

Use an 4dp base rhythm.

| Token | Value |
|---|---:|
| `space.0` | 0dp |
| `space.1` | 4dp |
| `space.2` | 8dp |
| `space.3` | 12dp |
| `space.4` | 16dp |
| `space.5` | 20dp |
| `space.6` | 24dp |
| `space.7` | 28dp |
| `space.8` | 32dp |
| `space.10` | 40dp |
| `space.12` | 48dp |
| `space.14` | 56dp |
| `space.16` | 64dp |
| `space.20` | 80dp |
| `space.24` | 96dp |

### Common screen spacing

```text
Screen horizontal padding       = 20dp
Compact horizontal padding      = 16dp
Large section gap               = 28dp
Section title → content         = 12dp
Card internal padding           = 16dp
Form field vertical gap         = 14dp
Button internal horizontal      = 20dp
Bottom navigation height        = 72dp + safe area handling
```

Avoid arbitrary spacing such as 13dp, 19dp or 27dp unless a component specifically requires it.

---

# 7. Corner Radius

Use a restrained rounded language.

| Token | Value | Use |
|---|---:|---|
| `radius.none` | 0dp | Rare utility cases |
| `radius.xs` | 6dp | Small badges |
| `radius.sm` | 10dp | Compact controls |
| `radius.md` | 14dp | Inputs / smaller cards |
| `radius.lg` | 18dp | Main cards / buttons |
| `radius.xl` | 22dp | Large feature surfaces |
| `radius.2xl` | 28dp | Hero containers |
| `radius.full` | 999dp | Pills / circular controls |

Primary production default:

```text
Cards          = 18dp
Buttons        = 18dp
Inputs         = 16dp
Chips          = full
Bottom sheet   = 24dp top corners
Circular icon  = full
```

---

# 8. Borders

Borders should create structure without visually dominating the interface.

```text
border.width.none    = 0dp
border.width.thin    = 1dp
border.width.focus   = 2dp
```

Recommended mapping:

```text
Default card border      = color.border.subtle
Input border             = color.border.default
Focused input border     = color.border.focus
Selected control border  = color.border.focus
Divider                  = color.border.subtle
```

Avoid thick permanent borders around every component.

---

# 9. Elevation & Shadows

Use elevation sparingly.

### Level 0

Flat surface.

```text
elevation.none = 0dp
```

### Level 1

For cards and compact controls.

```text
elevation.sm = 2dp
```

Visual intention:

```text
very soft
very low opacity
large blur
```

### Level 2

For floating buttons, sheets or strongly elevated elements.

```text
elevation.md = 4dp
```

### Level 3

For modals / dialogs.

```text
elevation.lg = 8dp
```

Do not use heavy shadows on ordinary food or cafeteria cards.

---

# 10. Icon System

Use one consistent line-icon family across the application.

Preferred characteristics:

- Rounded line endings
- Simple geometry
- Minimal internal detail
- Consistent stroke weight
- Visually similar optical size across icons

Recommended icon sizes:

| Token | Size |
|---|---:|
| `icon.xs` | 14dp |
| `icon.sm` | 18dp |
| `icon.md` | 20dp |
| `icon.lg` | 24dp |
| `icon.xl` | 28dp |
| `icon.2xl` | 32dp |
| `icon.hero` | 40dp |

Default UI icon:

```text
24dp
```

Default stroke:

```text
1.75–2.0dp
```

### Semantic icon colors

```text
Primary icon      = color.icon.primary
Secondary icon    = color.icon.secondary
Active icon       = color.icon.active
Disabled icon     = color.icon.disabled
Status icon       = color.status.*
```

Do not color icons blue merely because they are present. Blue indicates activity or meaningful action.

---

# 11. Buttons

## Primary button

Used for:

- Sign in
- Next
- Add to cart
- Continue to checkout
- Confirm order
- Pay

```text
height              = 52dp
min width           = 120dp
corner radius       = 18dp
horizontal padding  = 20dp
text size           = 14sp
text weight         = 600
background          = color.action.primary
text color          = color.action.primaryText
```

### Primary states

```text
Default     = blue.500
Pressed     = blue.600
Disabled    = neutral.200
Focus       = blue.500 + 2dp focus ring where needed
```

## Secondary button

Use for lower-priority actions.

```text
height              = 48dp
background          = blue.100
text                = blue.700
border              = transparent
corner radius       = 16dp
```

## Text button

Used for:

- Skip
- Forgot password?
- View all
- Need help?

```text
height = 44dp minimum touch target
text   = color.action.link
```

---

# 12. Input Fields

Use generous touch targets and clear focus states.

```text
height                 = 52dp
corner radius          = 16dp
horizontal padding     = 16dp
text size              = 16sp
label size             = 14sp
border                 = 1dp
background             = neutral.0
```

### Input states

```text
Default
background = color.surface.default
border     = color.border.default
text       = color.text.primary

Focused
border     = color.border.focus
background = color.surface.default

Error
border     = color.status.error
helper     = color.status.error

Disabled
background = color.surface.disabled
text       = color.text.disabled
border     = color.border.subtle
```

Minimum touch target:

```text
44dp × 44dp
```

Prefer 48dp+ where space allows.

---

# 13. Search Bar

The home screen search field should feel lighter than a standard form field.

```text
height             = 52dp
corner radius      = 18dp
background         = neutral.50
border             = neutral.150
icon               = 24dp
icon color         = neutral.500
placeholder       = neutral.500
horizontal padding = 16dp
```

Example:

```text
Search meals, cafeterias...
```

---

# 14. Chips & Category Tabs

Selected category:

```text
background = blue.100
text       = blue.700
height     = 36dp
radius     = full
padding-x  = 14dp
text       = 13sp / 600
```

Unselected category:

```text
background = transparent
text       = neutral.700
border     = transparent
```

Use a clear difference between selected and unselected states without overusing borders.

---

# 15. Cards

## Standard card

```text
background      = color.surface.default
border          = color.border.subtle
corner radius   = 18dp
elevation       = elevation.sm
padding         = 16dp
```

## Blue-tinted information card

```text
background      = blue.50
border          = blue.200
corner radius   = 18dp
```

Use for:

- Estimated ready time
- Ordering guidance
- Helpful information
- Lightweight status content

## Food card

Food cards should prioritize the photograph and a fast information scan.

```text
image corner radius        = 14dp
card radius                = 18dp
image ratio                = approximately 1.0–1.3 depending on layout
name                       = title.md
supporting text            = body.sm
price                      = price.md
add button                 = 40–44dp circular
```

---

# 16. Cafeteria Cards

Cafeteria cards are a core CampusBites pattern.

Required information priority:

1. Cafeteria image
2. Cafeteria name
3. Open / closed status
4. Distance
5. Estimated preparation time
6. Supporting description

Recommended card dimensions for horizontal carousel:

```text
width  = 245–270dp
radius = 18dp
```

Recommended image height:

```text
150–170dp
```

Status badge:

```text
Open background = success.50
Open icon/text  = success.700
```

Closed:

```text
background = neutral.100
text       = neutral.600
```

---

# 17. Food Details Pattern

Food details should feel visual first, configuration second.

Recommended order:

```text
Hero food image
↓
Food name + price
↓
Cafeteria context
↓
Description
↓
Preparation time
↓
Customization
↓
Special instructions
↓
Sticky add-to-cart action
```

Use a large hero photograph with realistic lighting and minimal artificial effects.

Sticky action area:

```text
background = color.surface.default
border top = color.border.subtle
padding    = 12dp 16dp + bottom safe-area inset
```

---

# 18. Selection Controls

For portion sizes, extras and meal preferences.

### Radio / single selection

```text
outer size        = 20dp
selected fill     = blue.500
selected ring     = blue.500
unselected border = neutral.300
```

### Checkbox / multi-selection

```text
size              = 20dp
selected          = blue.500
checkmark         = neutral.0
unselected border = neutral.300
```

Selected containers may use:

```text
background = blue.50
border     = blue.300
```

---

# 19. Quantity Controls

Used in cart and order editing.

```text
height            = 40–44dp
minimum width     = 96dp
corner radius     = 14dp
background        = neutral.0
border            = neutral.200
minus/plus icon   = blue.500
number            = neutral.900
```

Buttons must meet at least a 44dp touch target even when the visible icon is smaller.

---

# 20. Bottom Navigation

Primary destinations:

```text
Home
Orders
Favorites
Profile
```

### Navigation dimensions

```text
container height = 72dp
icon size        = 24dp
label size       = 12sp
label weight     = 500
```

Active item:

```text
icon  = blue.500
label = blue.600
```

Inactive item:

```text
icon  = neutral.500
label = neutral.500
```

Container:

```text
background = neutral.0
border top = neutral.150
```

Avoid a heavy floating-navigation appearance. Keep it integrated into the app shell.

---

# 21. Order Tracking

Order tracking should emphasize reassurance, not visual complexity.

Four standard states:

```text
Order placed
Confirmed
Preparing
Ready for pickup
```

Progress token rules:

```text
Completed = blue.500 or blue.300 depending on context
Current   = blue.500
Upcoming  = neutral.300
Connector = blue.300 when completed, neutral.200 otherwise
```

Current-state title:

```text
heading.lg
color.text.primary
```

Supporting state text:

```text
body.md
color.text.secondary
```

Estimated time:

```text
price-like emphasis
20–24sp
weight 700
color blue.600
```

The map preview should remain subtle and functional rather than becoming a visual centerpiece.

---

# 22. Status Badges

### Open

```text
background = success.50
text       = success.700
icon       = success.500
```

### Closed

```text
background = neutral.100
text       = neutral.600
icon       = neutral.400
```

### Preparing

```text
background = blue.100
text       = blue.700
icon       = blue.500
```

### Ready

```text
background = success.100
text       = success.700
icon       = success.500
```

---

# 23. Images & Photography

Food photography is a major part of the interface.

Use:

- Realistic food
- Natural lighting
- Clean composition
- Appetizing texture
- Moderate contrast
- Minimal clutter
- Consistent image treatment across cards

Avoid:

- Cartoon food
- Artificial 3D food
- Overly saturated imagery
- Heavy filters
- Busy restaurant advertising styles

Image containers should use the same radius language as surrounding cards.

Recommended image overlay:

```text
none by default
```

Use overlays only when required for readability over an image.

---

# 24. Layout Rules

## Smartphone page margins

Default:

```text
16–20dp
```

Preferred:

```text
20dp
```

For very dense content:

```text
16dp
```

## Content rhythm

Use repeated vertical rhythm:

```text
Screen edge
20dp
Title
8–12dp
Supporting text
20–24dp
Section heading
12dp
Content
24–32dp
Next section
```

Do not stack many components with identical visual weight.

---

# 25. Android API 17 Compatibility

The design system is intentionally compatible with API 17 while retaining a modern visual result.

### Dimensions

Use Android `dp` for layout and `sp` for text.

```text
All layout dimensions → dp
All text sizes        → sp
```

Do not hardcode pixels.

### Fonts

Bundle Inter in the APK as a local font resource. Do not rely on the device having Inter installed.

### Minimum touch targets

Use at least:

```text
44dp × 44dp
```

for interactive controls. 48dp is preferred for primary controls.

### Layouts

Favor compatibility-friendly Android layouts/components and avoid assuming newer platform-only behavior.

Recommended approach:

```text
dp-based spacing
sp-based typography
vector icons where supported by project configuration
compatibility support libraries where needed
local bundled fonts
```

Do not design around edge-to-edge system APIs that are unavailable on API 17.

For older devices, keep content inside the system window and explicitly account for the status/navigation bar regions.

---

# 26. Responsive Mobile Rules

The reference designs are portrait mobile screens, but components should scale gracefully.

### Narrow phones

For widths around 320–360dp:

- Keep horizontal padding at 16dp.
- Reduce multi-column content to one column.
- Allow food descriptions to wrap to 2–3 lines.
- Use horizontal scrolling for category/cafeteria carousels.
- Never squeeze important information to fit one line.

### Standard phones

For widths around 360–430dp:

- Use 20dp page padding.
- Use full-width primary actions.
- Use 2-column metadata where appropriate.
- Use 1-column order item lists.

### Larger screens

For larger Android devices:

- Cap reading width where practical.
- Keep important content centered.
- Avoid simply stretching every card to fill the entire width.

---

# 27. Motion & Interaction

Motion should communicate state, not decoration.

Recommended timing:

```text
micro interaction      = 120–160ms
standard transition    = 180–240ms
larger screen motion   = 240–320ms
```

Use:

- Soft scale or opacity feedback for buttons
- Small state transitions for selected chips
- Progress animation for order tracking
- Subtle confirmation motion after adding to cart

Avoid:

- Large bouncing animations
- Decorative looping motion
- Long loading transitions
- Heavy parallax

The product should feel fast.

---

# 28. Accessibility

Accessibility is part of the design system, not an afterthought.

### Color

Never rely on color alone to communicate state.

Examples:

```text
Open → green + text label
Preparing → blue + text label
Error → red + error icon/text
```

### Typography

Respect Android font scaling.

Avoid placing essential content inside fixed-height containers that cannot grow when font size increases.

### Touch

Minimum interactive target:

```text
44dp × 44dp
```

### Content

Use clear, direct labels:

```text
Add to cart
Continue to checkout
Preparing your order
Ready for pickup
```

Avoid unclear icon-only controls unless the meaning is universally recognizable or accompanied by accessibility content descriptions.

---

# 29. Component Naming

Recommended component naming convention:

```text
CbButtonPrimary
CbButtonSecondary
CbTextButton
CbSearchBar
CbTextField
CbChip
CbCard
CbFoodCard
CbCafeteriaCard
CbPrice
CbStatusBadge
CbQuantityControl
CbBottomNavigation
CbOrderProgress
CbInfoCard
CbEmptyState
CbLoadingState
CbTopBar
CbSectionHeader
```

Prefix reusable components with `Cb` to clearly separate CampusBites UI from Android framework components.

---

# 30. Theme Architecture

## Theme-independent components

Every reusable component should consume semantic tokens.

Example pseudo-configuration:

```text
ButtonPrimary.background = theme.color.action.primary
ButtonPrimary.text       = theme.color.action.primaryText
ButtonPrimary.radius     = theme.radius.lg
ButtonPrimary.height     = theme.control.buttonHeight
```

## Theme object

Recommended structure:

```text
Theme
├── colors
│   ├── background
│   ├── surface
│   ├── text
│   ├── border
│   ├── action
│   ├── icon
│   └── status
├── typography
├── spacing
├── radius
├── elevation
├── icon
└── component
```

## Future themes

The initial release can ship with one theme:

```text
CampusBites Light
```

Future themes can include:

```text
CampusBites Dark
University Branded Light
University Branded Dark
High Contrast
```

The screen and component layouts should not need to change when themes are introduced.

---

# 31. Recommended Token File Structure

If implementing the design system in Android resources:

```text
res/
├── values/
│   ├── colors.xml
│   ├── dimens.xml
│   ├── strings.xml
│   ├── styles.xml
│   └── themes.xml
│
├── font/
│   └── inter_*.ttf
│
├── drawable/
│   └── vector icons / shape resources
│
├── values-night/
│   ├── colors.xml
│   ├── themes.xml
│   └── styles.xml
│
└── values-sw600dp/
    └── dimens.xml
```

Recommended semantic grouping inside resources:

```text
cb_color_background_*
cb_color_surface_*
cb_color_text_*
cb_color_border_*
cb_color_action_*
cb_color_icon_*
cb_color_status_*

cb_space_*
cb_radius_*
cb_elevation_*
cb_text_*
cb_icon_*
cb_component_*
```

---

# 32. Starter Semantic Token Map

Use this as the initial source of truth.

```text
// COLORS
color.background.app          = #F8FAFC
color.background.default     = #FFFFFF
color.background.secondary   = #F8FAFC
color.background.tertiary    = #F2F5F8

color.surface.default        = #FFFFFF
color.surface.raised         = #FCFDFE
color.surface.subtle         = #F1F8FF
color.surface.selected       = #E4F2FF

color.text.primary           = #1F2933
color.text.secondary         = #5B6673
color.text.tertiary          = #737E8B
color.text.placeholder       = #98A3AF
color.text.inverse           = #FFFFFF

color.border.default         = #DDE4EA
color.border.subtle          = #E9EEF3
color.border.strong          = #C7D0D9
color.border.focus           = #0A8CFF

color.action.primary         = #0A8CFF
color.action.primaryPressed  = #087BD9
color.action.secondary       = #E4F2FF
color.action.link            = #087BD9

color.icon.primary           = #404B57
color.icon.secondary         = #737E8B
color.icon.active            = #0A8CFF
color.icon.disabled          = #C7D0D9

color.status.success         = #22A559
color.status.warning         = #D99A00
color.status.error           = #D94A4A
color.status.info            = #0A8CFF

// TYPOGRAPHY
font.family.primary          = Inter
font.weight.regular          = 400
font.weight.medium           = 500
font.weight.semibold         = 600
font.weight.bold             = 700

// LAYOUT
screen.padding.horizontal    = 20dp
screen.padding.compact       = 16dp
card.padding                 = 16dp
section.gap                  = 28dp
content.gap                  = 12dp

// RADII
radius.card                  = 18dp
radius.button                = 18dp
radius.input                 = 16dp
radius.chip                  = 999dp
radius.sheet                 = 24dp

// CONTROLS
control.button.height        = 52dp
control.input.height         = 52dp
control.iconButton.size      = 44dp
control.touch.min            = 44dp

// NAVIGATION
navigation.bottom.height     = 72dp
navigation.icon.size         = 24dp
navigation.label.size        = 12sp
```

---

# 33. Do / Don't

## Do

- Use white as the dominant visual field.
- Use the bright blue strategically.
- Use neutral grey-black for the majority of text.
- Keep cards rounded and lightweight.
- Keep screens easy to scan with strong hierarchy.
- Use realistic food photography.
- Make order status immediately understandable.
- Keep primary actions visually dominant.
- Maintain consistent 4dp spacing rhythm.
- Build all components on semantic theme tokens.

## Don't

- Do not use pure black as the default text color.
- Do not make every icon blue.
- Do not use strong blue backgrounds behind large amounts of text.
- Do not add glassmorphism.
- Do not use neon blue.
- Do not create heavy shadows.
- Do not fill screens with decorative graphics.
- Do not imitate a generic restaurant-delivery marketplace.
- Do not hardcode colors directly inside individual components.
- Do not hardcode pixel measurements.

---

# 34. Visual Quality Checklist

Before approving a screen, verify:

```text
[ ] White/light surface hierarchy is clear
[ ] Primary blue is used intentionally
[ ] No pure black UI text
[ ] Typography follows the defined scale
[ ] Spacing follows the 4dp rhythm
[ ] Main cards use approximately 18dp radius
[ ] Interactive controls meet 44dp minimum touch targets
[ ] Borders are subtle
[ ] Shadows are restrained
[ ] Icons use one consistent line style
[ ] Food imagery is realistic
[ ] Important actions are visually dominant
[ ] Screen remains readable on smaller phones
[ ] Components use semantic theme tokens
[ ] No component directly hardcodes brand colors
[ ] Future dark/theme switching will only require semantic remapping
```

---

# 35. Source Screen Set

The design system supports the current core journey:

1. Splash / Brand
2. Onboarding
3. Student Login
4. Home / Discover
5. Cafeteria Selection / Menu
6. Food Item Details
7. Cart
8. Checkout / Payment
9. Order Confirmed
10. Live Order Tracking
11. Pickup / Ready
12. My Orders
13. Order Details / Receipt
14. Favorites
15. Student Profile
16. Notifications
17. Help / Support

This ordering flow follows the supplied project specification and can be expanded as the product grows. fileciteturn0file0L5-L23

---

# 36. Final Design Principle

**CampusBites should feel like a calm, modern campus utility that happens to make food ordering extremely convenient.**

The design should communicate:

```text
FAST
CLEAR
TRUSTWORTHY
CAMPUS-FIRST
FRIENDLY
MODERN
```

The strongest visual signature is:

```text
WHITE + BRIGHT CAMPUSBites BLUE + SOFT GREY-BLACK TEXT
+ LIGHT BLUE SURFACES + SUBTLE BORDERS + 18DP ROUNDED SURFACES
```
