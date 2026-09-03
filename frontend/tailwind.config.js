/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
      },
      colors: {
        // Midnight navy palette
        navy: {
          950: '#04050E',
          900: '#090B1A',
          800: '#0D1020',
          700: '#111426',
          600: '#161B2E',
          500: '#1E2540',
          400: '#2A3354',
          300: '#3D4D6B',
          200: '#5B6B8A',
          100: '#8A9BB8',
          50:  '#C4CEDF',
        },
        // Yellow / golden accent
        accent: {
          50:  '#FFFBEB',
          100: '#FEF3C7',
          200: '#FDE68A',
          300: '#FCD34D',
          400: '#FBBF24',
          500: '#F5C518',
          600: '#D97706',
          700: '#B45309',
        },
        // Content backgrounds
        surface: {
          DEFAULT: '#FFFFFF',
          50:  '#F7F7F8',
          100: '#F3F4F6',
          200: '#E9EAEC',
        },
        // Keep primary alias for compatibility
        primary: {
          50:  '#FFFBEB',
          100: '#FEF3C7',
          200: '#FDE68A',
          300: '#FCD34D',
          400: '#FBBF24',
          500: '#F5C518',
          600: '#D97706',
          700: '#B45309',
          800: '#92400E',
          900: '#78350F',
        },
      },
      boxShadow: {
        card:  '0 2px 10px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)',
        'card-hover': '0 8px 24px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.06)',
        nav:   '0 4px 24px rgba(9,11,26,0.5)',
        modal: '0 20px 60px rgba(0,0,0,0.25)',
        input: '0 1px 3px rgba(0,0,0,0.06)',
      },
      backgroundImage: {
        'navy-gradient': 'linear-gradient(135deg, #090B1A 0%, #0D1020 50%, #111426 100%)',
        'navy-gradient-r': 'linear-gradient(to right, #090B1A, #0D1020)',
        'accent-gradient': 'linear-gradient(135deg, #F5C518 0%, #FBBF24 100%)',
      },
      borderRadius: {
        DEFAULT: '8px',
        sm: '6px',
        md: '10px',
        lg: '12px',
        xl: '16px',
        '2xl': '20px',
      },
    },
  },
  plugins: [],
}
