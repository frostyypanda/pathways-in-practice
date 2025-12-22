/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Chemistry-specific colors for precipitates
        precipitate: {
          white: '#ffffff',
          yellow: '#fde047',
          orange: '#fb923c',
          red: '#ef4444',
          brown: '#92400e',
          'red-brown': '#b45309',
          green: '#22c55e',
          blue: '#3b82f6',
          'prussian-blue': '#1e3a5f',
          black: '#171717',
          gray: '#9ca3af',
          violet: '#8b5cf6',
        },
        // pH indicator colors
        ph: {
          acidic: '#ef4444',
          neutral: '#22c55e',
          basic: '#4338ca',
        }
      }
    },
  },
  plugins: [],
}
