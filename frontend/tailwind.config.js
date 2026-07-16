/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef4ff',
          100: '#dce8ff',
          200: '#b8d0ff',
          300: '#8ab0ff',
          400: '#5c8bff',
          500: '#3766f5',
          600: '#2549d1',
          700: '#1e3aa8',
          800: '#1c3286',
          900: '#1b2c6b',
        },
      },
    },
  },
  plugins: [],
};
