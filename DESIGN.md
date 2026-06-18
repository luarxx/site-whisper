# Whisper Control Dashboard — Design Language

**Generated from source**: 2026-06-17  
**Stack**: React 19 + TypeScript + Tailwind CSS v3  
**Runtime**: Vite + Zustand (state)

---

## 1. Brand Colors

### Primary — `brand`

```ts
brand: {
  50:  '#eef9ff',   // background sutil de destaque
  100: '#d9f0ff',   // hover / selected bg leve
  200: '#bce5ff',   // bordas de foco, rings
  300: '#8ed4ff',   // hover mais forte
  400: '#59baff',   // focus ring
  500: '#329cff',   // ícones, destaques
  600: '#1c7ef5',   // PRIMARY — botões, links, checboxes
  700: '#1668e1',   // hover de botão primary
  800: '#1855b6',   // active de botão primary
  900: '#1a4990',   // títulos fortes (raramente usado)
  950: '#142c58',   // extremo (não usado no UI atual)
}
```

**Uso**: `bg-brand-{n}`, `text-brand-{n}`, `ring-brand-{n}`, `border-brand-{n}`, `accent-brand-600`.

---

### Surface — Dark Theme (terminal)

```ts
surface: {
  0:   '#0b1020',   // fundo principal do terminal
  50:  '#0f152a',
  100: '#131a33',
  200: '#1a223e',
  300: '#222c4d',
  400: '#2e3a5f',
  500: '#3b4773',   // bordas ou linhas no terminal
}
```

**Uso**: Exclusivo do `LogViewer` (`bg-surface-0`).

---

### Semantic Aliases (via Tailwind defaults)

| Token | Cor | Uso |
|-------|-----|-----|
| `emerald-*` | green | Sucesso, online, copiado |
| `rose-*` | red | Erro, perigo, offline |
| `amber-*` | amber | Aviso, conectando |
| `sky-*` | sky | Log level INFO |
| `slate-*` | gray-blue | Neutro, fundos, bordas, texto |
| `white` | `#fff` | Cards, inputs, sidebar |
| `slate-50` | `#f8fafc` | Fundo da página |

---

## 2. Typography

### Font Stack

```css
/* Sans (corpo) */
font-family: 'Inter', ui-sans-serif, system-ui, -apple-system,
             'Segoe UI', Roboto, sans-serif;

/* Mono (código, valores, logs) */
font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular,
             Menlo, monospace;
```

### Type Scale (Tailwind defaults)

| Class | Size | Weight | Tracking | Uso |
|-------|------|--------|----------|-----|
| `text-[10px]` | 10px | — | `tracking-widest` | Labels de terminal |
| `text-xs` | 12px | `font-medium` ou `font-semibold` | `uppercase tracking-wide` | Labels de Field, badges, hints |
| `text-sm` | 14px | `font-medium` ou `font-semibold` | — | Corpo, títulos de Card, botões |
| `text-base` | 16px | — | — | Botões lg |
| `text-2xl` | 24px | `font-semibold` | `tracking-tight` | Page heading |
| `text-3xl` | 30px | `font-semibold` | `tracking-tight` | Page heading (sm+) |

### Line Heights

| Class | Value | Uso |
|-------|-------|-----|
| `leading-relaxed` | 1.625 | Parágrafos, logs |
| `leading-snug` | ~1.375 | (implícito em buttons) |

---

## 3. Spacing Scale

Usa a escala padrão do Tailwind: `0.25rem` increments.

| Class | rem | px | Uso |
|-------|-----|----|-----|
| `gap-1` | 0.25 | 4 | Grid/ flex mínimo |
| `gap-1.5` | 0.375 | 6 | Badge gap, Field gap |
| `gap-2` | 0.5 | 8 | Button gap, grupos |
| `gap-3` | 0.75 | 12 | Ícone + texto, file info |
| `gap-4` | 1 | 16 | Seções, header gap |
| `gap-5` | 1.25 | 20 | Grid de ConfigForm |
| `space-y-4` | 1 | 16 | Seções verticais |
| `space-y-6` | 1.5 | 24 | Entre cards |
| `px-4` / `py-6` | — | — | Padding lateral / vertical da sidebar |
| `p-3` | 0.75 | 12 | Padding de file info bar |
| `p-4` | 1 | 16 | Padding de options panel |
| `p-5` | 1.25 | 20 | Padding de Card body |

---

## 4. Border Radius

| Class | Value | Uso |
|-------|-------|-----|
| `rounded-lg` | 0.5rem (8px) | Button sm, badge, nav icon |
| `rounded-xl` | 0.75rem (12px) | Button md/lg, Card, input, Select, sidebar |
| `rounded-2xl` | 1rem (16px) | Card, drop zone, options panel |
| `rounded-full` | 9999px | Badge, dot, thumb do slider |

---

## 5. Shadows

```css
/* Botões, inputs, ícones pequenos */
shadow-soft: '0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.06)'

/* Cards, toasts, sidebar */
shadow-card: '0 4px 24px -8px rgba(15,23,42,0.08), 0 2px 6px -2px rgba(15,23,42,0.04)'

/* Focus ring de inputs */
shadow-glow: '0 0 0 4px rgba(50,156,255,0.18)'
```

---

## 6. Animations

| Name | Duration | Easing | Iteration | Uso |
|------|----------|--------|-----------|-----|
| `pulse-soft` | 2s | ease-in-out | infinite | Badge dot (status online) |
| `fade-in` | 0.25s | ease-out | 1 | Cards, toasts, options, file info |
| `blink` | 1.1s | steps(1) | infinite | Cursor no LogViewer |
| `ping` | 1s | (default) | infinite | Badge dot outer ring |
| `spin` | 1s | linear | infinite | Loading spinner no Button |
| `transition-transform duration-300` | 0.3s | — | — | Sidebar mobile slide |

### Keyframes

```css
@keyframes pulse-soft {
  0%, 100% { opacity: 1 }
  50%      { opacity: 0.55 }
}

@keyframes fade-in {
  from { opacity: 0; transform: translateY(4px) }
  to   { opacity: 1; transform: translateY(0) }
}

@keyframes blink {
  0%, 49%  { opacity: 1 }
  50%, 100% { opacity: 0 }
}
```

---

## 7. Component Design Tokens

### Button

| Variant | bg | text | border | hover | active | disabled |
|---------|----|------|--------|-------|--------|----------|
| `primary` | `brand-600` | `white` | — | `brand-700` | `brand-800` | `brand-300` |
| `secondary` | `white` | `slate-700` | `slate-200` | `slate-50` | `slate-100` | `opacity-60` |
| `ghost` | `transparent` | `slate-600` | — | `slate-100` | `slate-200` | `opacity-60` |
| `danger` | `rose-600` | `white` | — | `rose-700` | `rose-800` | `rose-300` |

Spinner: `h-4 w-4 border-2 border-current border-t-transparent animate-spin rounded-full`

### Card

- Container: `rounded-2xl border border-slate-200/80 bg-white`
- Header: `border-b border-slate-100 px-5 py-4`
- Icon circle: `flex h-10 w-10 rounded-xl bg-brand-50 text-brand-600`
- Title: `text-sm font-semibold text-slate-900`
- Description: `text-xs text-slate-500`
- Body: `p-5` (opcional via `padded` prop)

### Badge

| Tone | bg | text | ring | dot |
|------|----|------|------|-----|
| `success` | `emerald-50` | `emerald-700` | `emerald-200` | `emerald-500` |
| `danger` | `rose-50` | `rose-700` | `rose-200` | `rose-500` |
| `warning` | `amber-50` | `amber-700` | `amber-200` | `amber-500` |
| `info` | `brand-50` | `brand-700` | `brand-200` | `brand-500` |
| `neutral` | `slate-100` | `slate-700` | `slate-200` | `slate-500` |

### Field

- Label: `text-xs font-medium uppercase tracking-wide text-slate-600`
- Hint: `text-xs text-slate-500`
- Error: `text-xs font-medium text-rose-600`
- Container: `space-y-1.5`

### Input / Select

- Base: `h-10 w-full rounded-xl border border-slate-200 bg-white text-sm shadow-soft transition-all`
- Hover: `hover:border-slate-300`
- Focus: `focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100`
- Disabled: `disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400`

### Slider

- Track: `h-2 w-full rounded-full bg-slate-200`
- Thumb (WebKit): `h-4 w-4 rounded-full bg-brand-600 shadow-soft hover:scale-110`
- Thumb (Moz): `h-4 w-4 rounded-full border-0 bg-brand-600`
- Fill gradient: `linear-gradient(to right, brand-600 X%, slate-200 X%, slate-200 100%)`
- Label: `flex items-center justify-between text-xs`
- Min/Max: `text-[10px] font-mono text-slate-400`

### Toaster

- Container: `fixed bottom-4 right-4 z-50 max-w-sm`
- Toast: `rounded-xl border bg-white px-4 py-3 shadow-card animate-fade-in`
- Icons: success = `CheckCircle2 emerald-500`, error = `AlertCircle rose-500`, info = `Info brand-500`
- Border: success = `emerald-200`, error = `rose-200`, info = `brand-200`

---

## 8. Layout

### Sidebar

- **Desktop**: `w-72`, static, `border-r border-slate-200 bg-white`
- **Mobile**: fixed slide-out, hamburger toggle, `backdrop-blur-sm` overlay
- **Transition**: `translate-x` com `duration-300`
- **Nav item active**: `bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100`
- **Nav icon active**: `bg-brand-600 text-white shadow-soft`

### Page Layout

- **Shell**: `flex h-full min-h-screen bg-slate-50`
- **Main**: `flex-1 overflow-y-auto`
- **Content**: `max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8`
- **Page header**: `flex flex-col gap-1 pt-10 lg:pt-0`

---

## 9. Responsive Breakpoints

| Prefix | Min-width | Comportamento |
|--------|-----------|---------------|
| `sm` | 640px | Side-by-side input+button, grid columns |
| `md` | 768px | Grid de 2 colunas para ConfigForm |
| `lg` | 1024px | Sidebar estática visível, sem hamburger |

---

## 10. Icon Library

**Lucide React** — todos os ícones:

| Componente | Ícones |
|-----------|--------|
| Sidebar | `Activity`, `AudioWaveform`, `Sliders`, `Terminal`, `Mic`, `Github`, `Menu`, `X` |
| StatusCard | `Globe`, `RefreshCw` |
| AudioUploader | `Upload`, `FileAudio`, `X`, `Copy`, `Check`, `Loader2`, `Square`, `AlertTriangle`, `RotateCcw`, `Sparkles`, `Settings2`, `Languages`, `Grid3X3`, `Brain`, `ChevronDown`, `ChevronUp` |
| ConfigForm | `Save`, `RotateCcw`, `Sliders`, `Cpu`, `Languages`, `Zap`, `Brain` |
| LogViewer | `Terminal`, `RefreshCw`, `Pause`, `Play`, `Trash2` |
| Toaster | `CheckCircle2`, `AlertCircle`, `Info`, `X` |
| Button | spinner CSS puro (sem ícone) |

All icons: `h-4 w-4` (sm), `h-5 w-5` (md) com exceção do botão clear de log (`h-3.5 w-3.5`).

---

## 11. Focus & Accessibility

- **Focus ring**: `focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2` em buttons
- **Input focus**: `focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100`
- **Skip links**: Não implementados
- **aria-labels**: Sidebar hamburger dinâmico, botão fechar toast, botão remover arquivo

---

## 12. Global Styles

- `html, body, #root`: `height: 100%`
- `body`: `text-rendering: optimizeLegibility`, `-webkit-font-smoothing: antialiased`
- Scrollbar: 10px, `slate-300` thumb, `rounded-full`, hover `slate-400`
- Utility `.scrollbar-thin`: 6px scrollbar width

---

## 13. Dependencies

| Package | Versão | Uso |
|---------|--------|-----|
| `react` | ^19 | UI framework |
| `typescript` | ^5.7 | Types |
| `tailwindcss` | ^3.4 | CSS utility framework |
| `@tailwindcss/vite` | ^4 | Vite plugin |
| `zustand` | ^5 | State management |
| `axios` | ^1.7 | HTTP client |
| `lucide-react` | ^0.487 | Icon set |
| `clsx` | ^2.1 | Class conditional |
| `tailwind-merge` | ^3.0 | Class conflict resolution |

---

*Generated from source code. Update this file whenever visual tokens change.*
