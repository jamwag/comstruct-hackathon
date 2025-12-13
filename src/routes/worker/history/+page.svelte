<script lang="ts">
	import type { PageData } from './$types';
	import { selectedProjectId } from '$lib/stores/selectedProject';
	import { SvelteSet } from 'svelte/reactivity';

	let { data }: { data: PageData } = $props();

	// Get current project from store
	const currentProjectId = $derived($selectedProjectId);

	// Filter orders by selected project
	const filteredOrders = $derived(
		currentProjectId
			? data.orders.filter((o) => o.order.projectId === currentProjectId)
			: data.orders
	);

	// Track expanded orders
	let expandedOrders = new SvelteSet<string>();

	function toggleExpand(orderId: string) {
		if (expandedOrders.has(orderId)) {
			expandedOrders.delete(orderId);
		} else {
			expandedOrders.add(orderId);
		}
	}

	function formatPrice(cents: number): string {
		return (cents / 100).toFixed(2);
	}

	function formatDate(date: Date): string {
		return new Date(date).toLocaleDateString('en-CH', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function getStatusColor(status: string): string {
		switch (status) {
			case 'approved':
				return 'bg-green-100 text-green-800';
			case 'rejected':
				return 'bg-red-100 text-red-800';
			default:
				return 'bg-yellow-100 text-yellow-800';
		}
	}

	function getSupplierStatusColor(status: string): string {
		switch (status) {
			case 'confirmed':
				return 'bg-green-100 text-green-800';
			case 'rejected':
				return 'bg-red-100 text-red-800';
			case 'partial':
				return 'bg-yellow-100 text-yellow-800';
			default:
				return 'bg-gray-100 text-gray-800';
		}
	}

	function formatDeliveryDate(date: Date | null): string {
		if (!date) return '';
		return new Date(date).toLocaleDateString('de-CH', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric'
		});
	}
</script>

<svelte:head>
	<title>Order History - ComStruct</title>
</svelte:head>

<div class="space-y-4">
	<div class="bg-white rounded-lg shadow p-4">
		<h2 class="text-xl font-bold text-gray-900">Order History</h2>
		<p class="text-sm text-gray-500 mt-1">
			{#if currentProjectId}
				Showing orders for selected project
			{:else}
				Showing all orders
			{/if}
		</p>
	</div>

	{#if filteredOrders.length === 0}
		<div class="bg-gray-50 rounded-lg p-6 text-center">
			<svg
				class="w-12 h-12 text-gray-400 mx-auto mb-3"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
				/>
			</svg>
			<p class="text-gray-500">No orders yet for this project.</p>
		</div>
	{:else}
		<div class="space-y-3">
			{#each filteredOrders as { order, project, items, supplierResponses } (order.id)}
				<div class="bg-white rounded-lg shadow overflow-hidden">
					<!-- Order Header (clickable) -->
					<button
						type="button"
						class="w-full p-4 text-left hover:bg-gray-50 transition-colors"
						onclick={() => toggleExpand(order.id)}
					>
						<div class="flex items-center justify-between">
							<div class="flex-1">
								<div class="flex items-center gap-2 flex-wrap">
									<span class="font-medium text-gray-900">{project.name}</span>
									<span
										class="px-2 py-0.5 rounded text-xs font-medium {getStatusColor(order.status)}"
									>
										{order.status}
									</span>
									{#if order.priority === 'urgent'}
										<span class="px-2 py-0.5 rounded text-xs font-medium bg-red-500 text-white">
											Urgent
										</span>
									{/if}
								</div>
								<p class="text-sm text-gray-500 mt-1">{formatDate(order.createdAt)}</p>
								{#if order.notes}
									<p class="text-sm text-gray-600 mt-1 italic">"{order.notes}"</p>
								{/if}
							</div>
							<div class="flex items-center gap-3">
								<span class="font-bold text-gray-900">CHF {formatPrice(order.totalCents)}</span>
								<svg
									class="w-5 h-5 text-gray-400 transition-transform {expandedOrders.has(order.id)
										? 'rotate-180'
										: ''}"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M19 9l-7 7-7-7"
									/>
								</svg>
							</div>
						</div>
					</button>

					<!-- Expanded Order Details -->
					{#if expandedOrders.has(order.id)}
						<div class="border-t bg-gray-50 p-4">
							<h4 class="text-sm font-medium text-gray-700 mb-2">
								Order Items ({items.length})
							</h4>
							<div class="space-y-2">
								{#each items as item (item.id)}
									<div
										class="flex justify-between items-center py-2 px-3 bg-white rounded border"
									>
										<div>
											<span class="font-medium text-gray-900">{item.productName}</span>
											<span class="text-sm text-gray-500 ml-2">x{item.quantity}</span>
										</div>
										<span class="text-gray-700">CHF {formatPrice(item.totalCents)}</span>
									</div>
								{/each}
							</div>
							{#if order.status === 'rejected' && order.rejectionReason}
								<div class="mt-3 p-3 bg-red-50 rounded border border-red-200">
									<p class="text-sm text-red-700">
										<strong>Rejection reason:</strong>
										{order.rejectionReason}
									</p>
								</div>
							{/if}

							<!-- Supplier Responses -->
							{#if supplierResponses && supplierResponses.length > 0}
								<div class="mt-4">
									<h4 class="text-sm font-medium text-gray-700 mb-2">
										Supplier Responses ({supplierResponses.length})
									</h4>
									<div class="space-y-2">
										{#each supplierResponses as response (response.id)}
											<div class="p-3 bg-white rounded border">
												<div class="flex items-center justify-between">
													<span class="font-medium text-gray-900">{response.supplierName}</span>
													<span
														class="px-2 py-0.5 rounded text-xs font-medium capitalize {getSupplierStatusColor(response.status)}"
													>
														{response.status}
													</span>
												</div>
												{#if response.deliveryDate}
													<p class="text-sm text-gray-600 mt-1">
														Delivery: {formatDeliveryDate(response.deliveryDate)}
													</p>
												{/if}
												{#if response.message}
													<p class="text-sm text-gray-500 mt-1 italic">
														"{response.message}"
													</p>
												{/if}
											</div>
										{/each}
									</div>
								</div>
							{/if}
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>
