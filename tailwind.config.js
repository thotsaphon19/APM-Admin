/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Sarabun', 'Prompt', 'sans-serif'] },
    },
  },
  safelist: [
    'bg-indigo-50', 'bg-indigo-100', 'bg-indigo-200',
    'bg-white', 'bg-slate-50',
    'border-indigo-100', 'border-indigo-200', 'border-indigo-300',
    'text-indigo-600', 'text-indigo-700',
    'hover:bg-indigo-50', 'hover:bg-white',
    'bg-indigo-50/50',
  ],
  plugins: [],
}
