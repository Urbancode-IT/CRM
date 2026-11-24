/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Manrope', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Fraunces', 'ui-serif', 'Georgia', 'serif'],
      },
      colors: {
        // Marsala defaults (hex) — theme customize still overrides via --brand-* CSS vars
        brand: {
          50: 'rgb(var(--brand-50, 250 246 245) / <alpha-value>)',
          100: 'rgb(var(--brand-100, 243 233 232) / <alpha-value>)',
          200: 'rgb(var(--brand-200, 228 205 203) / <alpha-value>)',
          300: 'rgb(var(--brand-300, 205 160 157) / <alpha-value>)',
          400: 'rgb(var(--brand-400, 181 117 113) / <alpha-value>)',
          500: 'rgb(var(--brand-500, 164 92 88) / <alpha-value>)',
          600: 'rgb(var(--brand-600, 150 79 76) / <alpha-value>)',
          700: 'rgb(var(--brand-700, 122 63 61) / <alpha-value>)',
          800: 'rgb(var(--brand-800, 92 47 46) / <alpha-value>)',
          900: 'rgb(var(--brand-900, 63 32 31) / <alpha-value>)',
        },
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(-50%) translateY(0)' },
          '50%': { transform: 'translateY(-50%) translateY(-8px)' },
        },
      },
      animation: {
        'fade-up': 'fadeUp 0.7s ease-out both',
        'fade-up-delay': 'fadeUp 0.7s ease-out 0.12s both',
        'fade-up-delay-2': 'fadeUp 0.7s ease-out 0.24s both',
        float: 'float 6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
