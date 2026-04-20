import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { inspectAttr } from 'kimi-plugin-inspect-react'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [inspectAttr(), react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    target: 'esnext',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
      },
    },
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-ui': ['@radix-ui/react-accordion', '@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-navigation-menu', '@radix-ui/react-popover', '@radix-ui/react-scroll-area', '@radix-ui/react-select', '@radix-ui/react-tabs', 'sonner'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-utils': ['lucide-react', 'date-fns', 'clsx', 'tailwind-merge'],
          // Route-based chunks
          'marketplace': ['./src/pages/Marketplace.tsx'],
          'profile': ['./src/pages/Profile.tsx'],
          'vendors': ['./src/pages/Vendors.tsx'],
          'messages': ['./src/pages/Messages.tsx'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
});
