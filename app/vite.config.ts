import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'
import viteWesl from "wesl-plugin/vite"
import { staticBuildExtension } from "wesl-plugin"

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    svelte(), 
    tailwindcss(), 
    viteWesl({ weslToml: './src/shaders/wesl.toml', extensions: [staticBuildExtension]})
  ],
})
