<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let isDeleting = $state(false);

	// Role-based visibility
	const isProcurement = data.user?.role === 'manager';

	function formatPrice(cents: number): string {
		return (cents / 100).toFixed(2);
	}

	function confirmDeleteAll(event: Event) {
		if (!confirm(`Are you sure you want to delete all ${data.products.length} products? This cannot be undone.`)) {
			event.preventDefault();
		}
	}
</script>

<svelte:head>
	<title>Products - ComStruct</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex justify-between items-center">
		<h2 class="text-2xl font-bold text-gray-900">Products</h2>
		{#if isProcurement}
			<div class="flex gap-2">
				{#if data.products.length > 0}
					<form method="post" action="?/deleteAll" use:enhance={() => {
						isDeleting = true;
						return async ({ update }) => {
							await update();
							isDeleting = false;
						};
					}} onsubmit={confirmDeleteAll}>
						<button
							type="submit"
							disabled={isDeleting}
							class="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50"
						>
							{isDeleting ? 'Deleting...' : 'Delete All'}
						</button>
					</form>
				{/if}
				<a
					href="/manager/products/upload"
					class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
				>
					Import Products
				</a>
			</div>
		{/if}
	</div>

	{#if data.suppliers.length === 0}
		<div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
			<p class="text-yellow-800">
				You need to <a href="/manager/suppliers/new" class="underline font-medium">add a supplier</a> before you can import products.
			</p>
		</div>
	{/if}

	{#if data.products.length === 0}
		<div class="bg-white rounded-lg shadow p-6 text-center">
			<p class="text-gray-500">No products yet. Import products from Excel, CSV, or PDF files.</p>
		</div>
	{:else}
		<div class="bg-white rounded-lg shadow overflow-hidden">
			<table class="min-w-full divide-y divide-gray-200">
				<thead class="bg-gray-50">
					<tr>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
							SKU
						</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
							Name
						</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
							Type
						</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
							Category
						</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
							Supplier
						</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
							Unit
						</th>
						<th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
							Price
						</th>
					</tr>
				</thead>
				<tbody class="bg-white divide-y divide-gray-200">
					{#each data.products as row (row.product.id)}
						<tr class="hover:bg-gray-50 {isProcurement ? 'cursor-pointer' : ''}" onclick={() => isProcurement && (window.location.href = `/manager/products/${row.product.id}`)}>
							<td class="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500">
								{row.product.sku}
							</td>
							<td class="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
								{row.product.name}
							</td>
							<td class="px-6 py-4 whitespace-nowrap">
								<span class="px-2 py-1 text-xs font-medium rounded-full {row.product.materialType === 'a_material' ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'}">
									{row.product.materialType === 'a_material' ? 'A-Material' : 'C-Material'}
								</span>
							</td>
							<td class="px-6 py-4 whitespace-nowrap text-gray-500">
								{row.category?.name || '-'}
							</td>
							<td class="px-6 py-4 whitespace-nowrap text-gray-500">
								{row.supplier?.name || '-'}
							</td>
							<td class="px-6 py-4 whitespace-nowrap text-gray-500">
								{row.product.unit}
							</td>
							<td class="px-6 py-4 whitespace-nowrap text-right text-gray-900">
								CHF {formatPrice(row.product.pricePerUnit)}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="text-sm text-gray-500">{data.products.length} products</p>
	{/if}
</div>
