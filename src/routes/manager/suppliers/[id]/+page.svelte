<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let isEditing = $state(false);

	function formatPrice(cents: number): string {
		return (cents / 100).toFixed(2);
	}

	function confirmDeleteSupplier(event: Event) {
		if (!confirm(`Are you sure you want to delete "${data.supplier.name}" and all ${data.productCount} products from this supplier? This cannot be undone.`)) {
			event.preventDefault();
		}
	}

	function confirmDeleteProduct(event: Event, productName: string) {
		if (!confirm(`Are you sure you want to delete "${productName}"? This cannot be undone.`)) {
			event.preventDefault();
		}
	}
</script>

<svelte:head>
	<title>{data.supplier.name} - ComStruct</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-4">
			<a href="/manager/suppliers" class="text-gray-400 hover:text-gray-600">
				<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
				</svg>
			</a>
			<div>
				<h1 class="text-2xl font-bold text-gray-900">{data.supplier.name}</h1>
				<p class="text-sm text-gray-500">Supplier</p>
			</div>
		</div>
		<div class="flex items-center gap-2">
			<button
				type="button"
				class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
				onclick={() => (isEditing = !isEditing)}
			>
				{isEditing ? 'Cancel' : 'Edit Supplier'}
			</button>
			<form method="post" action="?/deleteSupplier" use:enhance onsubmit={confirmDeleteSupplier}>
				<button
					type="submit"
					class="px-4 py-2 text-sm font-medium text-red-700 bg-white border border-red-300 rounded-md hover:bg-red-50"
				>
					Delete Supplier
				</button>
			</form>
		</div>
	</div>

	<!-- Supplier Info / Edit Form -->
	<div class="bg-white rounded-lg shadow">
		{#if isEditing}
			<div class="p-6">
				<h2 class="text-lg font-semibold text-gray-900 mb-4">Edit Supplier</h2>
				<form method="post" action="?/update" use:enhance class="space-y-4">
					<div>
						<label for="name" class="block text-sm font-medium text-gray-700">Supplier Name</label>
						<input
							id="name"
							name="name"
							type="text"
							required
							value={data.supplier.name}
							class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
						/>
					</div>

					<div>
						<label for="contactEmail" class="block text-sm font-medium text-gray-700">Contact Email</label>
						<input
							id="contactEmail"
							name="contactEmail"
							type="email"
							value={data.supplier.contactEmail || ''}
							class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
						/>
					</div>

					<div>
						<label for="shopUrl" class="block text-sm font-medium text-gray-700">External Shop URL (PunchOut)</label>
						<input
							id="shopUrl"
							name="shopUrl"
							type="url"
							placeholder="https://supplier-shop.example.com"
							value={data.supplier.shopUrl || ''}
							class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
						/>
						<p class="mt-1 text-xs text-gray-500">
							The supplier's external catalog URL for PunchOut integration.
						</p>
					</div>

					<div>
						<label for="description" class="block text-sm font-medium text-gray-700">Voice Search Description</label>
						<textarea
							id="description"
							name="description"
							rows="2"
							placeholder="e.g., Order safety gloves, protective eyewear, and safety boots here"
							class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
						>{data.supplier.description || ''}</textarea>
						<p class="mt-1 text-xs text-gray-500">
							Used by voice assistant to suggest this supplier's external catalog for relevant searches.
						</p>
					</div>

					{#if form?.message}
						<p class="text-red-600 text-sm">{form.message}</p>
					{/if}

					<div class="flex gap-3 pt-2">
						<button
							type="submit"
							class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
						>
							Save Changes
						</button>
					</div>
				</form>
			</div>
		{:else}
			<div class="p-6">
				<dl class="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<div>
						<dt class="text-sm font-medium text-gray-500">Contact Email</dt>
						<dd class="mt-1 text-sm text-gray-900">
							{#if data.supplier.contactEmail}
								<a href="mailto:{data.supplier.contactEmail}" class="text-blue-600 hover:underline">
									{data.supplier.contactEmail}
								</a>
							{:else}
								<span class="text-gray-400">Not set</span>
							{/if}
						</dd>
					</div>
					<div>
						<dt class="text-sm font-medium text-gray-500">External Shop (PunchOut)</dt>
						<dd class="mt-1 text-sm text-gray-900">
							{#if data.supplier.shopUrl}
								<a href={data.supplier.shopUrl} target="_blank" rel="noopener" class="text-blue-600 hover:underline">
									{data.supplier.shopUrl}
								</a>
							{:else}
								<span class="text-gray-400">Not configured</span>
							{/if}
						</dd>
					</div>
					<div>
						<dt class="text-sm font-medium text-gray-500">Voice Search Description</dt>
						<dd class="mt-1 text-sm text-gray-900">
							{#if data.supplier.description}
								{data.supplier.description}
							{:else}
								<span class="text-gray-400">Not set</span>
							{/if}
						</dd>
					</div>
					<div>
						<dt class="text-sm font-medium text-gray-500">Created</dt>
						<dd class="mt-1 text-sm text-gray-900">
							{data.supplier.createdAt.toLocaleDateString()}
						</dd>
					</div>
				</dl>
			</div>
		{/if}
	</div>

	<!-- Products Section -->
	<div class="bg-white rounded-lg shadow">
		<div class="px-6 py-4 border-b flex items-center justify-between">
			<div>
				<h2 class="text-lg font-semibold text-gray-900">Products</h2>
				<p class="text-sm text-gray-500">{data.productCount} products from this supplier</p>
			</div>
			<a
				href="/manager/products/upload?supplier={data.supplier.id}"
				class="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2"
			>
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
				</svg>
				Import Products
			</a>
		</div>

		{#if data.products.length === 0}
			<div class="p-12 text-center">
				<svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
				</svg>
				<h3 class="mt-4 text-lg font-medium text-gray-900">No products yet</h3>
				<p class="mt-2 text-sm text-gray-500">
					Import products from this supplier's catalog to get started.
				</p>
				<a
					href="/manager/products/upload?supplier={data.supplier.id}"
					class="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
				>
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
					</svg>
					Import Products
				</a>
			</div>
		{:else}
			<div class="overflow-x-auto">
				<table class="min-w-full divide-y divide-gray-200">
					<thead class="bg-gray-50">
						<tr>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit</th>
							<th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
							<th class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
						</tr>
					</thead>
					<tbody class="bg-white divide-y divide-gray-200">
						{#each data.products as product (product.id)}
							<tr class="hover:bg-gray-50">
								<td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{product.sku}</td>
								<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{product.name}</td>
								<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{product.categoryName || '-'}</td>
								<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{product.unit}</td>
								<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">CHF {formatPrice(product.pricePerUnit)}</td>
								<td class="px-6 py-4 whitespace-nowrap text-center">
									<form method="post" action="?/deleteProduct" use:enhance onsubmit={(e) => confirmDeleteProduct(e, product.name)}>
										<input type="hidden" name="productId" value={product.id} />
										<button
											type="submit"
											class="text-red-600 hover:text-red-800 text-sm"
										>
											Delete
										</button>
									</form>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			{#if data.productCount > 100}
				<div class="px-6 py-3 bg-gray-50 border-t text-sm text-gray-500 text-center">
					Showing first 100 of {data.productCount} products.
					<a href="/manager/products?supplier={data.supplier.id}" class="text-blue-600 hover:underline">View all</a>
				</div>
			{/if}
		{/if}
	</div>
</div>
