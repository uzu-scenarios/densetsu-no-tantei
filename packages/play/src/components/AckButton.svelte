<!--
  「済」の表明 (読み終えた・飛ばすに同意・結末へ進む)。 押すたびに付け外しし、 全員がそろうと
  サーバーが次へ進める。 出すかどうかはサーバーと同じ canAck で決める。
-->
<script lang="ts">
import { send } from '../runtime/bridge';
import { canAck } from '../scenario/progress';
import Button from './Button.svelte';
import { view } from './view-context.svelte';

let {
  label,
  ackedLabel,
  testid,
  variant = 'secondary',
}: {
  label: string;
  ackedLabel: string;
  testid: string;
  variant?: 'primary' | 'secondary';
} = $props();

const shown = $derived(Boolean(view.selfRoleId && view.phase && canAck(view.phase)));
</script>

{#if shown}
  <Button {variant} pressed={view.selfAcked} {testid} onclick={() => send('phase.ack', { acked: !view.selfAcked })}>
    {view.selfAcked ? ackedLabel : label}
  </Button>
{/if}
