<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let thresholdValue = $state((data.project.autoApprovalThreshold ?? 20000) / 100);

	const assignedWorkerIds = $derived(new Set(data.assignedWorkerIds));
	const assignedProductIds = $derived(new Set(data.assignedProductIds));

	// Role-based visibility
	const isProjectManager = data.userRole === 'project_manager';
	const isProcurement = data.userRole === 'manager';

	let productSearch = $state('');

	// Filter products by search
	const filteredProducts = $derived.by(() => {
		const searchLower = productSearch.toLowerCase();
		return data.allProducts.filter(
			({ product }) =>
				product.name.toLowerCase().includes(searchLower) ||
				product.sku.toLowerCase().includes(searchLower)
		);
	});

	// Group filtered products by category
	const productsByCategory = $derived.by(() => {
		const groups: Record<string, typeof data.allProducts> = {};

		for (const item of filteredProducts) {
			const categoryId = item.category?.id ?? '_uncategorized';
			if (!groups[categoryId]) {
				groups[categoryId] = [];
			}
			groups[categoryId].push(item);
		}

		// Sort by category order
		return data.categories
			.map((cat) => ({
				category: cat,
				products: groups[cat.id] ?? []
			}))
			.filter((g) => g.products.length > 0)
			.concat(
				groups['_uncategorized']?.length > 0
					? [{ category: null, products: groups['_uncategorized'] }]
					: []
			);
	});

	// Count assigned products per category
	function countAssignedInCategory(products: typeof data.allProducts): number {
		return products.filter(({ product }) => assignedProductIds.has(product.id)).length;
	}
</script>

<svelte:head>
	<title>{data.project.name} - ComStruct</title>
</svelte:head>

<div class="space-y-6">
	<div class="mb-6">
		<a href="/manager/projects" class="text-blue-600 hover:underline text-sm">&larr; Back to Projects</a>
	</div>

	<div class="bg-white rounded-lg shadow p-6">
		<h2 class="text-2xl font-bold text-gray-900">{data.project.name}</h2>
		{#if data.project.address}
			<p class="mt-1 text-gray-500">{data.project.address}</p>
		{/if}
		<p class="mt-2 text-sm text-gray-400">
			Created {data.project.createdAt.toLocaleDateString()}
		</p>
	</div>

	<!-- Order Settings -->
	<div class="bg-white rounded-lg shadow p-6">
		<h3 class="text-lg font-semibold text-gray-900 mb-4">Order Settings</h3>
		<form method="post" action="?/updateThreshold" use:enhance class="flex items-end gap-4">
			<div class="flex-1 max-w-xs">
				<label for="threshold" class="block text-sm font-medium text-gray-700 mb-1">
					Auto-Approval Threshold (CHF)
				</label>
				<input
					type="number"
					id="threshold"
					name="threshold"
					min="0"
					step="0.01"
					bind:value={thresholdValue}
					class="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
				/>
				<p class="mt-1 text-xs text-gray-500">
					Worker orders below this amount are automatically approved.
				</p>
			</div>
			<button
				type="submit"
				class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
			>
				Save
			</button>
		</form>
		{#if form?.thresholdUpdated}
			<p class="mt-2 text-sm text-green-600">Threshold updated successfully.</p>
		{/if}
	</div>

	<!-- Preferred Suppliers - Only visible to Project Managers -->
	{#if isProjectManager}
		<div class="bg-white rounded-lg shadow p-6">
			<h3 class="text-lg font-semibold text-gray-900 mb-2">Preferred Suppliers</h3>
			<p class="text-sm text-gray-500 mb-4">
				Rank your preferred suppliers for this project. Orders will prioritize suppliers based on this ranking.
			</p>

			{#if data.projectSuppliers.length > 0}
				<div class="space-y-2 mb-4">
					{#each data.projectSuppliers as ps, index (ps.supplier.id)}
						<div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
							<span class="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
								{ps.preferenceRank}
							</span>
							<span class="flex-1 font-medium text-gray-900">{ps.supplier.name}</span>
							<div class="flex gap-1 shrink-0">
								<form method="post" action="?/moveSupplierUp" use:enhance>
									<input type="hidden" name="supplierId" value={ps.supplier.id} />
									<button
										type="submit"
										disabled={index === 0}
										class="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
										title="Move up"
									>
										<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
										</svg>
									</button>
								</form>
								<form method="post" action="?/moveSupplierDown" use:enhance>
									<input type="hidden" name="supplierId" value={ps.supplier.id} />
									<button
										type="submit"
										disabled={index === data.projectSuppliers.length - 1}
										class="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
										title="Move down"
									>
										<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
										</svg>
									</button>
								</form>
								<form method="post" action="?/removeProjectSupplier" use:enhance>
									<input type="hidden" name="supplierId" value={ps.supplier.id} />
									<button
										type="submit"
										class="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-100 rounded transition-colors"
										title="Remove"
									>
										<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
										</svg>
									</button>
								</form>
							</div>
						</div>
					{/each}
				</div>
			{:else}
				<p class="text-gray-500 text-sm mb-4">No preferred suppliers set for this project yet.</p>
			{/if}

			{#if data.availableSuppliers.length > 0}
				<form method="post" action="?/addProjectSupplier" use:enhance class="flex gap-2">
					<select
						name="supplierId"
						class="flex-1 rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
					>
						<option value="">Select a supplier to add...</option>
						{#each data.availableSuppliers as supplier (supplier.id)}
							<option value={supplier.id}>{supplier.name}</option>
						{/each}
					</select>
					<button
						type="submit"
						class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
					>
						Add
					</button>
				</form>
			{:else if data.projectSuppliers.length > 0}
				<p class="text-gray-500 text-sm">All available suppliers have been added.</p>
			{:else}
				<p class="text-gray-500 text-sm">No suppliers available. Contact procurement to add suppliers.</p>
			{/if}
		</div>
	{/if}

	<div class="bg-white rounded-lg shadow p-6">
		<h3 class="text-lg font-semibold text-gray-900 mb-4">Assigned Workers</h3>

		{#if data.allWorkers.length === 0}
			<p class="text-gray-500 text-sm">No workers registered yet. Workers need to register first.</p>
		{:else}
			<div class="space-y-2">
				{#each data.allWorkers as worker (worker.id)}
					{@const isAssigned = assignedWorkerIds.has(worker.id)}
					<div class="flex items-center justify-between py-2 px-3 rounded-md {isAssigned ? 'bg-green-50' : 'bg-gray-50'}">
						<div class="flex items-center gap-3">
							<span class="w-2 h-2 rounded-full {isAssigned ? 'bg-green-500' : 'bg-gray-300'}"></span>
							<span class="font-medium text-gray-900">{worker.username}</span>
							{#if isAssigned}
								<span class="text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded">Assigned</span>
							{/if}
						</div>
						<form method="post" action={isAssigned ? '?/unassign' : '?/assign'} use:enhance>
							<input type="hidden" name="workerId" value={worker.id} />
							<button
								type="submit"
								class="text-sm px-3 py-1 rounded {isAssigned
									? 'bg-red-100 text-red-700 hover:bg-red-200'
									: 'bg-blue-100 text-blue-700 hover:bg-blue-200'} transition-colors"
							>
								{isAssigned ? 'Remove' : 'Assign'}
							</button>
						</form>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<div class="bg-white rounded-lg shadow p-6">
		<div class="flex items-center justify-between mb-4">
			<h3 class="text-lg font-semibold text-gray-900">Assigned Products</h3>
			<div class="flex items-center gap-4">
				<span class="text-sm text-gray-500">
					{data.assignedProductIds.length} of {data.allProducts.length} products assigned
				</span>
				<a
					href="/manager/projects/{data.project.id}/assign-products"
					class="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
				>
					Extended View
				</a>
			</div>
		</div>

		{#if data.allProducts.length === 0}
			<p class="text-gray-500 text-sm">No products available. <a href="/manager/products/upload" class="text-blue-600 hover:underline">Upload products</a> first.</p>
		{:else}
			<div class="mb-4">
				<input
					type="text"
					bind:value={productSearch}
					placeholder="Search products by name or SKU..."
					class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
				/>
			</div>

			<div class="space-y-4 max-h-96 overflow-y-auto">
				{#each productsByCategory as group (group.category?.id ?? 'uncategorized')}
					<div class="border border-gray-200 rounded-lg">
						<div class="bg-gray-50 px-4 py-2 border-b border-gray-200">
							<div class="flex items-center justify-between">
								<span class="font-medium text-gray-700">
									{group.category?.name ?? 'Uncategorized'}
								</span>
								<span class="text-xs text-gray-500">
									{countAssignedInCategory(group.products)} / {group.products.length} assigned
								</span>
							</div>
						</div>
						<div class="divide-y divide-gray-100">
							{#each group.products as { product, category } (product.id)}
								{@const isAssigned = assignedProductIds.has(product.id)}
								<div class="flex items-center justify-between px-4 py-2 hover:bg-gray-50">
									<div class="flex-1 min-w-0">
										<div class="flex items-center gap-2">
											<span class="font-medium text-gray-900 truncate">{product.name}</span>
											{#if isAssigned}
												<span class="text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded shrink-0">Assigned</span>
											{/if}
										</div>
										<div class="text-sm text-gray-500">
											{product.sku} &bull; CHF {(product.pricePerUnit / 100).toFixed(2)} / {product.unit}
										</div>
									</div>
									<form method="post" action={isAssigned ? '?/unassignProduct' : '?/assignProduct'} use:enhance class="shrink-0 ml-4">
										<input type="hidden" name="productId" value={product.id} />
										<button
											type="submit"
											class="text-sm px-3 py-1 rounded {isAssigned
												? 'bg-red-100 text-red-700 hover:bg-red-200'
												: 'bg-blue-100 text-blue-700 hover:bg-blue-200'} transition-colors"
										>
											{isAssigned ? 'Remove' : 'Assign'}
										</button>
									</form>
								</div>
							{/each}
						</div>
					</div>
				{/each}

				{#if productsByCategory.length === 0 && productSearch}
					<p class="text-gray-500 text-sm text-center py-4">No products match your search.</p>
				{/if}
			</div>
		{/if}
	</div>
</div>
