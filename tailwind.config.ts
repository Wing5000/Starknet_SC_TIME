import type { Config } from 'tailwindcss'
export default {
  darkMode: 'media',
  content: ['./index.html','./src/**/*.{ts,tsx}'],
  theme:{ extend:{ container:{ center:true, padding:'1rem' }, colors:{ accent:{ DEFAULT:'#0E7AFE', fg:'#0B5FCC' } } } },
  plugins: []
} satisfies Config
