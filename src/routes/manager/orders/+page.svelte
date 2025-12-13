<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let expandedOrder = $state<string | null>(null);
	let rejectingOrder = $state<string | null>(null);
	let rejectReason = $state('');

	function formatPrice(cents: number): string {
		return (cents / 100).toFixed(2);
	}

	function formatDate(date: Date): string {
		return new Date(date).toLocaleString('en-CH', {
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

	function toggleExpand(orderId: string) {
		expandedOrder = expandedOrder === orderId ? null : orderId;
	}
</script>

<svelte:head>
	<title>Orders - ComStruct</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex justify-between items-center">
		<h2 class="text-2xl font-bold text-gray-900">Orders</h2>
		<div class="flex gap-2">
			<a
				href="?status=pending"
				class="px-3 py-1 rounded-md text-sm {data.statusFilter === 'pending'
					? 'bg-yellow-100 text-yellow-800 font-medium'
					: 'bg-gray-100 text-gray-600 hover:bg-gray-200'}"
			>
				Pending
			</a>
			<a
				href="?status=approved"
				class="px-3 py-1 rounded-md text-sm {data.statusFilter === 'approved'
					? 'bg-green-100 text-green-800 font-medium'
					: 'bg-gray-100 text-gray-600 hover:bg-gray-200'}"
			>
				Approved
			</a>
			<a
				href="?status=rejected"
				class="px-3 py-1 rounded-md text-sm {data.statusFilter === 'rejected'
					? 'bg-red-100 text-red-800 font-medium'
					: 'bg-gray-100 text-gray-600 hover:bg-gray-200'}"
			>
				Rejected
			</a>
			<a
				href="?status=all"
				class="px-3 py-1 rounded-md text-sm {data.statusFilter === 'all'
					? 'bg-blue-100 text-blue-800 font-medium'
					: 'bg-gray-100 text-gray-600 hover:bg-gray-200'}"
			>
				All
			</a>
		</div>
	</div>

	{#if form?.success}
		<div class="bg-green-50 border border-green-200 rounded-lg p-4">
			<p class="text-green-800">
				Order {form.action === 'approved' ? 'approved' : 'rejected'} successfully.
			</p>
		</div>
	{/if}

	{#if data.orders.length === 0}
		<div class="bg-white rounded-lg shadow p-6 text-center">
			<p class="text-gray-500">No {data.statusFilter === 'all' ? '' : data.statusFilter} orders.</p>
		</div>
	{:else}
		<div class="space-y-4">
			{#each data.orders as order (order.order.id)}
				<div class="bg-white rounded-lg shadow overflow-hidden">
					<!-- Order Header -->
					<div
						class="p-4 cursor-pointer hover:bg-gray-50"
						onclick={() => toggleExpand(order.order.id)}
						onkeydown={(e) => e.key === 'Enter' && toggleExpand(order.order.id)}
						role="button"
						tabindex="0"
					>
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-4">
								<span class="px-2 py-1 rounded text-xs font-medium {getStatusColor(order.order.status)}">
									{order.order.status}
								</span>
								<div>
									<p class="font-medium text-gray-900">{order.project.name}</p>
									<p class="text-sm text-gray-500">by {order.worker.username}</p>
								</div>
							</div>
							<div class="text-right">
								<p class="font-bold text-gray-900">CHF {formatPrice(order.order.totalCents)}</p>
								<p class="text-xs text-gray-500">{formatDate(order.order.createdAt)}</p>
							</div>
						</div>
					</div>

					<!-- Expanded Details -->
					{#if expandedOrder === order.order.id}
						<div class="border-t bg-gray-50 p-4">
							<h4 class="font-medium text-gray-900 mb-3">Order Items</h4>
							<table class="min-w-full text-sm">
								<thead>
									<tr class="text-left text-gray-500">
										<th class="pb-2">Product</th>
										<th class="pb-2">SKU</th>
										<th class="pb-2 text-right">Qty</th>
										<th class="pb-2 text-right">Unit Price</th>
										<th class="pb-2 text-right">Total</th>
									</tr>
								</thead>
								<tbody class="divide-y divide-gray-200">
									{#each order.items as item (item.id)}
										<tr>
											<td class="py-2">{item.product.name}</td>
											<td class="py-2 text-gray-500">{item.product.sku}</td>
											<td class="py-2 text-right">{item.quantity}</td>
											<td class="py-2 text-right">CHF {formatPrice(item.pricePerUnit)}</td>
											<td class="py-2 text-right font-medium">CHF {formatPrice(item.totalCents)}</td>
										</tr>
									{/each}
								</tbody>
								<tfoot>
									<tr class="border-t">
										<td colspan="4" class="py-2 text-right font-medium">Total:</td>
										<td class="py-2 text-right font-bold">CHF {formatPrice(order.order.totalCents)}</td>
									</tr>
								</tfoot>
							</table>

							{#if order.order.status === 'pending'}
								<!-- Approval Actions -->
								<div class="mt-4 pt-4 border-t flex gap-3">
									{#if rejectingOrder === order.order.id}
										<form method="post" action="?/reject" use:enhance class="flex-1 flex gap-2">
											<input type="hidden" name="orderId" value={order.order.id} />
											<input
												type="text"
												name="reason"
												placeholder="Rejection reason (optional)"
												class="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
												bind:value={rejectReason}
											/>
											<button
												type="submit"
												class="bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-700"
											>
												Confirm Reject
											</button>
											<button
												type="button"
												class="bg-gray-100 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-200"
												onclick={() => {
													rejectingOrder = null;
													rejectReason = '';
												}}
											>
												Cancel
											</button>
										</form>
									{:else}
										<form method="post" action="?/approve" use:enhance>
											<input type="hidden" name="orderId" value={order.order.id} />
											<button
												type="submit"
												class="bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700"
											>
												Approve
											</button>
										</form>
										<button
											type="button"
											class="bg-red-100 text-red-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-red-200"
											onclick={() => (rejectingOrder = order.order.id)}
										>
											Reject
										</button>
									{/if}
								</div>
							{:else if order.order.status === 'rejected' && order.order.rejectionReason}
								<div class="mt-4 pt-4 border-t">
									<p class="text-sm text-gray-500">
										<strong>Rejection reason:</strong> {order.order.rejectionReason}
									</p>
								</div>
							{/if}
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>
