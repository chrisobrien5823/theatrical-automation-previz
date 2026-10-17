import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build`        -> dist/        (static site for GitHub Pages, with service worker)
// `npm run build:single` -> dist-single/ (one self-contained index.html for USB / file:// backup)
export default defineConfig(({ mode }) => {
  const single = mode === 'single';
  return {
    base: './',
    plugins: single ? [viteSingleFile()] : [],
    define: {
      __SINGLE_FILE__: JSON.stringify(single),
    },
    build: {
      outDir: single ? 'dist-single' : 'dist',
      chunkSizeWarningLimit: 700, // Three.js alone is ~500 kB; one chunk is fine for this app

      // The single-file build inlines show.json via import, so public/ is not needed there.
      copyPublicDir: !single,
    },
    test: {
      include: ['tests/**/*.test.js'],
    },
  };
});
