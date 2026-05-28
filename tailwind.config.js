/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./contexts/**/*.{js,ts,jsx,tsx}",
    "./utils/**/*.{js,ts,jsx,tsx}",
    "./data/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // ── Font families (Stitch semantic roles + legacy aliases) ────────────
      fontFamily: {
        // Stitch role names (used as font-display-hero, font-section-divider, etc.)
        'display-hero':        ['"Bebas Neue"', 'system-ui', 'sans-serif'],
        'display-hero-mobile': ['"Bebas Neue"', 'system-ui', 'sans-serif'],
        'headline-lg':         ['"Bebas Neue"', 'system-ui', 'sans-serif'],
        'section-divider':     ['"Barlow Condensed"', 'system-ui', 'sans-serif'],
        'nav-link':            ['"Barlow Condensed"', 'system-ui', 'sans-serif'],
        'body-md':             ['"DM Sans"', 'system-ui', 'sans-serif'],
        'stats-mono':          ['IBM Plex Mono', 'monospace'],
        // Legacy aliases kept for backward compat
        display:   ['"Bebas Neue"', 'system-ui', 'sans-serif'],
        condensed: ['"Barlow Condensed"', 'system-ui', 'sans-serif'],
        sans:      ['"DM Sans"', 'system-ui', 'sans-serif'],
        mono:      ['IBM Plex Mono', 'monospace'],
      },

      // ── Font sizes (Stitch typography scale with full settings) ───────────
      fontSize: {
        'display-hero':        ['96px',  { lineHeight: '1.0', letterSpacing: '0.15em', fontWeight: '400' }],
        'display-hero-mobile': ['56px',  { lineHeight: '1.0', letterSpacing: '0.15em', fontWeight: '400' }],
        'headline-lg':         ['48px',  { lineHeight: '1.1', letterSpacing: '0.1em',  fontWeight: '400' }],
        'section-divider':     ['14px',  { lineHeight: '1.2', letterSpacing: '0.2em',  fontWeight: '600' }],
        'body-md':             ['16px',  { lineHeight: '1.6', letterSpacing: '0.01em', fontWeight: '400' }],
        'nav-link':            ['12px',  { lineHeight: '1.0', letterSpacing: '0.15em', fontWeight: '500' }],
        'stats-mono':          ['14px',  { lineHeight: '1.0', letterSpacing: '0.05em', fontWeight: '500' }],
      },

      // ── Colors (full Stitch Material Design palette + legacy aliases) ─────
      colors: {
        // Surface scale
        'surface':                  '#131313',
        'surface-dim':              '#131313',
        'surface-bright':           '#3a3939',
        'surface-container-lowest': '#0e0e0e',
        'surface-container-low':    '#1c1b1b',
        'surface-container':        '#201f1f',
        'surface-container-high':   '#2a2a2a',
        'surface-container-highest':'#353534',
        'surface-variant':          '#353534',
        'surface-tint':             '#ffb4a7',
        'on-surface':               '#e5e2e1',
        'on-surface-variant':       '#eabcb4',
        'inverse-surface':          '#e5e2e1',
        'inverse-on-surface':       '#313030',
        // Outline
        'outline':         '#b08780',
        'outline-variant': '#5f3e39',
        // Primary (salmon/coral highlight + dark red CTA)
        'primary':                  '#ffb4a7',
        'on-primary':               '#670400',
        'primary-container':        '#ff553d',
        'on-primary-container':     '#5b0300',
        'inverse-primary':          '#be0e00',
        'primary-fixed':            '#ffdad4',
        'primary-fixed-dim':        '#ffb4a7',
        'on-primary-fixed':         '#400200',
        'on-primary-fixed-variant': '#910900',
        // Secondary (neutral gray)
        'secondary':                  '#c8c6c5',
        'on-secondary':               '#313030',
        'secondary-container':        '#4a4949',
        'on-secondary-container':     '#bab8b7',
        'secondary-fixed':            '#e5e2e1',
        'secondary-fixed-dim':        '#c8c6c5',
        'on-secondary-fixed':         '#1c1b1b',
        'on-secondary-fixed-variant': '#474646',
        // Tertiary (blue accent)
        'tertiary':                  '#abc7ff',
        'on-tertiary':               '#002f66',
        'tertiary-container':        '#438fff',
        'on-tertiary-container':     '#002959',
        'tertiary-fixed':            '#d7e2ff',
        'tertiary-fixed-dim':        '#abc7ff',
        'on-tertiary-fixed':         '#001b3f',
        'on-tertiary-fixed-variant': '#00458f',
        // Error
        'error':             '#ffb4ab',
        'on-error':          '#690005',
        'error-container':   '#93000a',
        'on-error-container':'#ffdad6',
        // Background
        'background':    '#131313',
        'on-background': '#e5e2e1',
        // Legacy aliases (updated to match Stitch color decisions)
        'f1-red':    '#ff1801', // F1 accent red (PRD: #ff1801)
        'f1-black':  '#0a0a0a', // Deepest background (unchanged)
        'f1-dark':   '#131313', // was #15151e — now matches Stitch surface
        'f1-carbon': '#141414', // was #1f1f25 — now matches Stitch card surface
        'paper':     '#f4f1ea', // Warm editorial cream (unchanged)
      },

      // ── Spacing (Stitch layout tokens) ────────────────────────────────────
      spacing: {
        'navbar-height':   '52px',
        'gutter':          '24px',
        'margin-mobile':   '16px',
        'margin-desktop':  '64px',
        'section-gap':     '80px',
      },

      // ── Border radius (Stitch: sharp edges, pill only for chips) ──────────
      borderRadius: {
        'DEFAULT': '0px',
        'lg':      '0px',
        'xl':      '0px',
        'full':    '9999px',
      },
    },
  },
  plugins: [],
}
