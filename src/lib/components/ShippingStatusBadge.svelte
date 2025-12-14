<script lang="ts">
	import { getShippingStatusColor, getShippingStatusLabel, type ShippingStatus } from '$lib/utils/shipping';

	interface Props {
		status: ShippingStatus;
		deliveryDate?: Date | string | null;
		compact?: boolean;
	}

	let { status, deliveryDate = null, compact = false }: Props = $props();

	function formatDeliveryDate(date: Date | string | null): string {
		if (!date) return '';
		return new Date(date).toLocaleDateString('de-CH', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric'
		});
	}
</script>

{#if status}
	<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium {getShippingStatusColor(status)}">
		{#if status === 'awaiting'}
			<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
			</svg>
		{:else if status === 'confirmed'}
			<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
			</svg>
		{:else if status === 'partial'}
			<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
			</svg>
		{:else if status === 'rejected'}
			<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
			</svg>
		{/if}
		<span>{getShippingStatusLabel(status)}</span>
		{#if !compact && deliveryDate && status === 'confirmed'}
			<span class="text-xs opacity-75">({formatDeliveryDate(deliveryDate)})</span>
		{/if}
	</span>
	{#if compact && deliveryDate && status === 'confirmed'}
		<span class="text-xs text-gray-500 ml-1">{formatDeliveryDate(deliveryDate)}</span>
	{/if}
{/if}
