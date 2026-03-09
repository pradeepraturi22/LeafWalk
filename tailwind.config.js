/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        playfair: ['var(--font-playfair)'],
        poppins: ['var(--font-poppins)']
      },
      colors: {
        luxury: {
          gold: '#C6A15B',
          dark: '#0B0B0B',
          soft: '#1A1A1A'
        }
      }
    }
  },
  plugins: []
}
