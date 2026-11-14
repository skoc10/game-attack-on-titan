import { defineConfig } from 'vite';

// Göreli taban: derleme hem alan adının kökünde hem de GitHub Pages'in
// /depo-adı/ alt yolunda aynı dosyalarla çalışır.
export default defineConfig({
  base: './',
});
