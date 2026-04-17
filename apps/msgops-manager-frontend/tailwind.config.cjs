const foundation = require('./foundation/index.cjs');

/** @type {import('tailwindcss').Config} */
module.exports = {
  prefix: 'tw-',
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    colors: { ...foundation.colors },
    fontFamily: {
      sans: ['Inter', 'sans-serif'],
      serif: ['Merriweather', 'serif'],
    },
    extend: {
      gridTemplateColumns: {
        content: 'min-content auto',
      },
      spacing: {
        '8xl': '96rem',
        '9xl': '128rem',
      },
      borderRadius: {
        '4xl': '2rem',
      },
      width: {
        68: '17rem',
      },
      flex: {
        base: '0 0 auto',
        secondary: '1 0 auto',
      },
    },
  },

  plugins: [],
};
