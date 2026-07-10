/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        fiori: {
          blue: '#171717', // Drevo Black
          'blue-dark': '#000000', // Drevo True Black
          green: '#30914C',
          red: '#BB0000',
          orange: '#E76500',
          yellow: '#C87B00',
          gray: '#32363A',
          'gray-light': '#F5F6F7',
          'gray-mid': '#89919A',
          border: '#D9D9D9',
          white: '#FFFFFF',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      boxShadow: {
        fiori: '0 0 0 1px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.06)',
      },
    },
  },
  plugins: [],
}

