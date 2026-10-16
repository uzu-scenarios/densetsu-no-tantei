<!--
  議論や投票の最中に自分の手帳を読み返す。
-->
<script lang="ts">
import Dialog from './Dialog.svelte';
import HandoutBook from './HandoutBook.svelte';
import { localUi } from './local-ui.svelte';
import { view } from './view-context.svelte';
</script>

{#if view.selfRole}
  <Dialog title={`${view.selfRole.name}の手帳`} onclose={() => localUi.close()} wide>
    <div class="holder">
      <HandoutBook role={view.selfRole} />
    </div>
  </Dialog>
{/if}

<style>
  .holder {
    height: 60cqh;
    margin: -1em -1.3em -1.3em;
  }
</style>
