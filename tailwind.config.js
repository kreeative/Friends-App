/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Archivo', 'Helvetica Neue', 'Arial', 'sans-serif'],
        body: ['Inter', 'Helvetica Neue', 'Arial', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        ink: '#000000',
        paper: '#ffffff',
        hair: 'rgba(255,255,255,0.14)',
        hairStrong: 'rgba(255,255,255,0.28)',
        dim: 'rgba(255,255,255,0.55)',
        dimmer: 'rgba(255,255,255,0.34)',
      },
      borderRadius: { none: '0px' },
    },
  },
  plugins: [],
}
