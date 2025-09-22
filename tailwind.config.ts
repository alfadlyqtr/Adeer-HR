import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          light: '#8A6FE6', // Purple/Violet
          primary: '#4D6BF1', // Blue
          white: '#FFFFFF',
          darkBlue: '#00008B',
          darkPurple: '#4B0082',
          black: '#000000',
        },
      },
      borderRadius: {
        lg: '12px',
      },
    },
  },
  plugins: [],
}
export default config
