/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: "#12304A",
          dark: "#0F2438",
          orange: "#D9481E",
          teal: "#176B72",
          canvas: "#F8FAFC",
        },
      },
    },
  },
  plugins: [],
};
