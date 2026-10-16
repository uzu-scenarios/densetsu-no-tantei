import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  // .svelte 内の <script lang="ts"> を svelte-check が型検査できるようにする (play と同じ構成)。
  preprocess: vitePreprocess(),
};
