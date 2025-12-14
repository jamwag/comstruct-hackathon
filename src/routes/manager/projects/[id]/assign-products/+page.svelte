<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Selection state
	let selectedIds = $state<Set<string>>(new Set());

	// Derived: check if all visible products are selected
	const allSelected = $derived(
		data.products.length > 0 && data.products.every((p) => selectedIds.has(p.product.id))
	);

	// Derived: assigned product IDs as Set for quick lookup
	const assignedSet = $derived(new Set(data.assignedProductIds));

	// Filter form values (bound to inputs)
	let supplierValue = $state(data.filters.supplier || '');
	let categoryValue = $state(data.filters.category || '');
	let priceMinValue = $state(data.filters.priceMin || '');
	let priceMaxValue = $state(data.filters.priceMax || '');
	let searchValue = $state(data.filters.search || '');
	let assignedValue = $state(data.filters.assigned || 'all');

	// Toggle individual selection
	function toggleSelection(productId: string) {
		if (selectedIds.has(productId)) {
			selectedIds.delete(productId);
		} else {
			selectedIds.add(productId);
		}
		selectedIds = new Set(selectedIds); // Trigger reactivity
	}

	// Toggle all visible products
	function toggleAll() {
		if (allSelected) {
			selectedIds.clear();
		} else {
			for (const p of data.products) {
				selectedIds.add(p.product.id);
			}
		}
		selectedIds = new Set(selectedIds);
	}

	// Apply filters via URL params
	function applyFilters() {
		const params = new URLSearchParams();
		if (supplierValue) params.set('supplier', supplierValue);
		if (categoryValue) params.set('category', categoryValue);
		if (priceMinValue) params.set('priceMin', priceMinValue);
		if (priceMaxValue) params.set('priceMax', priceMaxValue);
		if (searchValue) params.set('search', searchValue);
		if (assignedValue && assignedValue !== 'all') params.set('assigned', assignedValue);

		const queryString = params.toString();
		goto(`?${queryString}`, { replaceState: true });
	}

	// Clear all filters
	function clearFilters() {
		supplierValue = '';
		categoryValue = '';
		priceMinValue = '';
		priceMaxValue = '';
		searchValue = '';
		assignedValue = 'all';
		goto('?', { replaceState: true });
	}

	// Check if any filters are active
	const hasActiveFilters = $derived(
		supplierValue || categoryValue || priceMinValue || priceMaxValue || searchValue || assignedValue !== 'all'
	);

	// Count selected assigned vs unassigned
	const selectedAssignedCount = $derived(
		[...selectedIds].filter((id) => assignedSet.has(id)).length
	);
	const selectedUnassignedCount = $derived(
		selectedIds.size - selectedAssignedCount
	);
</script>

<svelte:head>
	<title>Assign Products - {data.project.name} - ComStruct</title>
</svelte:head>

<div class="space-y-6">
	<div class="mb-6">
		<a href="/manager/products?project={data.project.id}" class="text-blue-600 hover:underline text-sm">
			&larr; Back to Assigned Products
		</a>
	</div>

	<div class="bg-white rounded-lg shadow p-6">
		<h2 class="text-2xl font-bold text-gray-900">Assign Products</h2>
		<p class="mt-1 text-gray-500">
			Select products to assign to <strong>{data.project.name}</strong>
		</p>
	</div>

	<!-- Filters -->
	<div class="bg-white rounded-lg shadow px-4 py-3">
		<div class="flex flex-wrap items-center gap-3">
			<select
				id="supplier"
				bind:value={supplierValue}
				class="px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
			>
				<option value="">All Suppliers</option>
				{#each data.suppliers as supplier (supplier.id)}
					<option value={supplier.id}>{supplier.name}</option>
				{/each}
			</select>

			<select
				id="category"
				bind:value={categoryValue}
				class="px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
			>
				<option value="">All Categories</option>
				{#each data.categories as category (category.id)}
					<option value={category.id}>{category.name}</option>
				{/each}
			</select>

			<input
				id="search"
				type="text"
				bind:value={searchValue}
				placeholder="Search name/SKU..."
				class="w-40 px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
			/>

			<div class="flex items-center gap-1 text-sm text-gray-600">
				<span>CHF</span>
				<input
					id="priceMin"
					type="number"
					step="0.01"
					min="0"
					bind:value={priceMinValue}
					placeholder="Min"
					class="w-20 px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
				/>
				<span>-</span>
				<input
					id="priceMax"
					type="number"
					step="0.01"
					min="0"
					bind:value={priceMaxValue}
					placeholder="Max"
					class="w-20 px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
				/>
			</div>

			<div class="flex items-center gap-2 text-sm">
				<label class="flex items-center gap-1 cursor-pointer">
					<input type="radio" name="assigned" value="all" bind:group={assignedValue} />
					<span>All</span>
				</label>
				<label class="flex items-center gap-1 cursor-pointer">
					<input type="radio" name="assigned" value="assigned" bind:group={assignedValue} />
					<span>Assigned</span>
				</label>
				<label class="flex items-center gap-1 cursor-pointer">
					<input type="radio" name="assigned" value="unassigned" bind:group={assignedValue} />
					<span>Unassigned</span>
				</label>
			</div>

			<div class="flex items-center gap-2 ml-auto">
				<button
					type="button"
					onclick={clearFilters}
					class="px-2 py-1.5 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50"
					disabled={!hasActiveFilters}
				>
					Clear
				</button>
				<button
					type="button"
					onclick={applyFilters}
					class="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
				>
					Apply
				</button>
			</div>
		</div>
	</div>

	<!-- Results -->
	<div class="bg-white rounded-lg shadow">
		<div class="px-6 py-4 border-b flex items-center justify-between">
			<div class="flex items-center gap-4">
				<h3 class="text-lg font-semibold text-gray-900">
					Results: {data.products.length} products
				</h3>
				{#if selectedIds.size > 0}
					<span class="text-sm text-gray-500">
						({selectedIds.size} selected: {selectedUnassignedCount} unassigned, {selectedAssignedCount} assigned)
					</span>
				{/if}
			</div>
			<div class="flex items-center gap-2">
				{#if selectedUnassignedCount > 0}
					<form method="post" action="?/assignBulk" use:enhance={() => {
						return async ({ update }) => {
							await update();
							selectedIds.clear();
							selectedIds = new Set(selectedIds);
						};
					}}>
						{#each [...selectedIds].filter(id => !assignedSet.has(id)) as id (id)}
							<input type="hidden" name="productId" value={id} />
						{/each}
						<button
							type="submit"
							class="px-3 py-1.5 bg-green-600 text-sm rounded-md hover:bg-green-700 transition-colors"
						>
							Assign Selected ({selectedUnassignedCount})
						</button>
					</form>
				{/if}
				{#if selectedAssignedCount > 0}
					<form method="post" action="?/unassignBulk" use:enhance={() => {
						return async ({ update }) => {
							await update();
							selectedIds.clear();
							selectedIds = new Set(selectedIds);
						};
					}}>
						{#each [...selectedIds].filter(id => assignedSet.has(id)) as id (id)}
							<input type="hidden" name="productId" value={id} />
						{/each}
						<button
							type="submit"
							class="px-3 py-1.5 bg-red-600 text-sm rounded-md hover:bg-red-700 transition-colors"
						>
							Remove Selected ({selectedAssignedCount})
						</button>
					</form>
				{/if}
			</div>
		</div>

		{#if data.products.length === 0}
			<div class="p-6 text-center text-gray-500">
				No products match your filters.
			</div>
		{:else}
			<div class="overflow-x-auto">
				<table class="w-full">
					<thead class="bg-gray-50 border-b">
						<tr>
							<th class="px-4 py-3 text-left">
								<input
									type="checkbox"
									checked={allSelected}
									onchange={toggleAll}
									class="rounded border-gray-300"
								/>
							</th>
							<th class="px-4 py-3 text-left text-sm font-medium text-gray-700">Product</th>
							<th class="px-4 py-3 text-left text-sm font-medium text-gray-700">SKU</th>
							<th class="px-4 py-3 text-left text-sm font-medium text-gray-700">Supplier</th>
							<th class="px-4 py-3 text-left text-sm font-medium text-gray-700">Category</th>
							<th class="px-4 py-3 text-right text-sm font-medium text-gray-700">Price</th>
							<th class="px-4 py-3 text-center text-sm font-medium text-gray-700">Status</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-100">
						{#each data.products as { product, supplier, category } (product.id)}
							{@const isAssigned = assignedSet.has(product.id)}
							{@const isSelected = selectedIds.has(product.id)}
							<tr
								class="hover:bg-gray-50 {isAssigned ? 'bg-green-50' : ''}"
								onclick={() => toggleSelection(product.id)}
							>
								<td class="px-4 py-3">
									<input
										type="checkbox"
										checked={isSelected}
										onchange={() => toggleSelection(product.id)}
										onclick={(e) => e.stopPropagation()}
										class="rounded border-gray-300"
									/>
								</td>
								<td class="px-4 py-3">
									<span class="font-medium text-gray-900">{product.name}</span>
								</td>
								<td class="px-4 py-3 text-sm text-gray-500">{product.sku}</td>
								<td class="px-4 py-3 text-sm text-gray-500">{supplier?.name ?? '-'}</td>
								<td class="px-4 py-3 text-sm text-gray-500">{category?.name ?? '-'}</td>
								<td class="px-4 py-3 text-sm text-gray-900 text-right">
									CHF {(product.pricePerUnit / 100).toFixed(2)}
								</td>
								<td class="px-4 py-3 text-center">
									{#if isAssigned}
										<span class="text-xs text-green-700 bg-green-100 px-2 py-1 rounded-full">Assigned</span>
									{:else}
										<span class="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">Not assigned</span>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>
</div>
