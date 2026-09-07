/** @type {import('tailwindcss').Config} */
export default {
    content: ['./index.html', './src/**/*.{ts,tsx}'],
    theme: {
      extend: {
        colors: {
          brand: {
            DEFAULT: '#FFD600',
            50: '#FFFDE7',
            100: '#FFF9C4',
            400: '#FFEE58',
            500: '#FFD600',
            600: '#FBC02D',
            dark: '#0f172a',
          },
        },
      },
    },
    plugins: [],
  };