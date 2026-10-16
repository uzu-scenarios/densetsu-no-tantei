import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  // .svelte 内の <script lang="ts"> を svelte-check が型検査できるようにする。
  // vite (dev/build) は vite-plugin-svelte が同じ preprocess を内蔵しているため
  // この config は svelte-check 専用。
  preprocess: vitePreprocess(),
};
