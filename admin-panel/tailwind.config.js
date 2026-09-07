/** @type {import('tailwindcss').Config} */
export default {
    content: ['./index.html', './src/**/*.{ts,tsx}'],
    theme: {
      extend: {
        colors: {
          admin: {
            DEFAULT: '#4F46E5', // Индиго
            50: '#EEF2FF',
            100: '#E0E7FF',
            500: '#6366F1',
            600: '#4F46E5',
            700: '#4338CA',
            800: '#3730A3',
            900: '#312E81',
            dark: '#0f172a',
          },
        },
      },
    },
    plugins: [],
  };