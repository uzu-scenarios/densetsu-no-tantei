<!--
  画面の背景。 画面ごとに 1 つ持つ (画面をまたぐ 1 枚に書かない)。 SafeArea の外まで塗る。
  差し替えは重ねてからフェードする。
-->
<script lang="ts">
import { cssUrl } from '../platform/asset-url';

let { assetId, veil = 0.35 }: { assetId: string | null | undefined; veil?: number } = $props();
</script>

{#key assetId}
  <div class="backdrop" style:--image={cssUrl(assetId)} style:--veil={veil}></div>
{/key}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: var(--z-backdrop);
    background-image:
      linear-gradient(rgba(var(--cloth-rgb), var(--veil)), rgba(var(--cloth-rgb), var(--veil))),
      var(--image);
    background-size: cover;
    background-position: center;
    animation: fade var(--dur-story) ease both;
  }

  @keyframes fade {
    from {
      opacity: 0;
    }
  }
</style>
