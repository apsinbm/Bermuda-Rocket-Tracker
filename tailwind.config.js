/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  darkMode: 'class', // Enable class-based dark mode
  theme: {
    extend: {
      screens: {
        'xs': '375px', // Small phones
        'sm': '640px', // Large phones / small tablets
        'md': '768px', // Tablets
        'lg': '1024px', // Laptops
        'xl': '1280px', // Desktops
        '2xl': '1536px', // Large screens
        // Orientation-based breakpoints
        'landscape': {'raw': '(orientation: landscape)'},
        'portrait': {'raw': '(orientation: portrait)'},
        // Touch device detection
        'touch': {'raw': '(hover: none) and (pointer: coarse)'},
        'no-touch': {'raw': '(hover: hover) and (pointer: fine)'},
        // High DPI screens
        'retina': {'raw': '(min-resolution: 192dpi)'},
      },
      spacing: {
        'safe-top': 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-left': 'env(safe-area-inset-left)',
        'safe-right': 'env(safe-area-inset-right)',
      },
      minHeight: {
        'touch': '44px', // iOS recommended touch target
      },
      minWidth: {
        'touch': '44px',
      },
      fontFamily: {
        'system': [
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif'
        ]
      },
      colors: {
        // OLED-friendly deep blacks for dark mode
        'oled': '#000000',
        'near-black': '#0a0a0a',
      }
    },
  },
  plugins: [
    // Add custom utilities
    function({ addUtilities }) {
      const newUtilities = {
        '.touch-manipulation': {
          'touch-action': 'manipulation',
        },
        '.tap-highlight-transparent': {
          '-webkit-tap-highlight-color': 'transparent',
        },
        '.overflow-scrolling-touch': {
          '-webkit-overflow-scrolling': 'touch',
        },
        '.font-smoothing-antialiased': {
          '-webkit-font-smoothing': 'antialiased',
          '-moz-osx-font-smoothing': 'grayscale',
        },
        '.font-smoothing-subpixel': {
          '-webkit-font-smoothing': 'subpixel-antialiased',
          '-moz-osx-font-smoothing': 'auto',
        },
        '.backface-hidden': {
          'backface-visibility': 'hidden',
        },
        '.transform-gpu': {
          'transform': 'translateZ(0)',
        },
      }
      addUtilities(newUtilities)
    }
  ],
}