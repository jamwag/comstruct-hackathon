<script lang="ts">
	import type { PageData } from './$types';
	import { cart, type CartItem } from '$lib/stores/cart';
	import { selectedProjectId } from '$lib/stores/selectedProject';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { onMount, onDestroy, untrack } from 'svelte';

	let { data }: { data: PageData } = $props();

	// Get current project from store
	const currentProjectId = $derived($selectedProjectId);

	// Sync URL param with store on mount (for backward compatibility with direct links)
	onMount(() => {
		const urlProject = $page.url.searchParams.get('project');
		if (urlProject && urlProject !== currentProjectId) {
			selectedProjectId.set(urlProject);
		}
	});

	// Navigate when project changes in the store
	$effect(() => {
		if (currentProjectId && currentProjectId !== data.selectedProject?.id) {
			goto(`/worker/order?project=${currentProjectId}`, { replaceState: true });
		}
	});

	// Track quantities for adding to cart (initialized per product)
	let quantities = $state<Record<string, number>>({});

	// Initialize quantities when products change - use untrack to prevent infinite loop
	$effect(() => {
		// Track only data.products, not quantities
		const productIds = data.products.map((p) => p.id);
		untrack(() => {
			for (const id of productIds) {
				if (!(id in quantities)) {
					quantities[id] = 1;
				}
			}
		});
	});

	// Get cart items for display - use store subscription with cleanup
	let cartItems = $state<CartItem[]>([]);
	const unsubscribe = cart.subscribe((state) => {
		cartItems = state.items;
	});
	onDestroy(unsubscribe);

	function formatPrice(cents: number): string {
		return (cents / 100).toFixed(2);
	}

	function getCartTotal(): number {
		return cart.getTotal(cartItems);
	}

	function getCartItemCount(): number {
		return cart.getItemCount(cartItems);
	}

	function addToCart(product: (typeof data.products)[0]) {
		const qty = quantities[product.id] || 1;
		cart.addItem(
			{
				productId: product.id,
				name: product.name,
				sku: product.sku,
				pricePerUnit: product.pricePerUnit,
				unit: product.unit
			},
			qty
		);
		quantities[product.id] = 1; // Reset after adding
	}

	function buildUrl(params: Record<string, string | null>) {
		const url = new URL($page.url);
		for (const [key, value] of Object.entries(params)) {
			if (value === null) {
				url.searchParams.delete(key);
			} else {
				url.searchParams.set(key, value);
			}
		}
		return url.pathname + url.search;
	}
</script>

<svelte:head>
	<title>Order Products - ComStruct</title>
</svelte:head>

<div class="space-y-4">
	<!-- Header -->
	<div class="bg-white rounded-lg shadow p-4">
		<h2 class="text-xl font-bold text-gray-900">Order Site Supplies</h2>
		<p class="text-sm text-gray-500 mt-1">Everyday materials for your project</p>
		{#if data.selectedProject}
			<p class="text-xs text-gray-400 mt-1">Project: {data.selectedProject.name}</p>
		{/if}
	</div>

	{#if data.projects.length === 0}
		<!-- No project assigned -->
		<div class="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
			<p class="text-yellow-800 font-medium">You are not assigned to any project.</p>
			<p class="text-yellow-700 text-sm mt-1">Please contact your manager to be assigned to a project.</p>
		</div>
	{:else if !data.categoryId}
		<!-- Contextual hint -->
		<div class="flex items-center gap-2 text-sm text-blue-700 bg-blue-50 p-3 rounded-lg border border-blue-100">
			<svg class="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
				<path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
			</svg>
			<span>Browse everyday site supplies by category</span>
		</div>

		<!-- Step 1: Main Category Buttons -->
		<div class="grid grid-cols-2 gap-4">
			{#each data.mainCategories as category (category.id)}
				<a
					href={buildUrl({ category: category.id, sub: null })}
					class="aspect-square bg-blue-500 text-white rounded-xl flex flex-col items-center justify-center text-lg font-bold shadow-lg hover:bg-blue-600 active:scale-95 transition-all"
				>
					<span class="text-5xl mb-2">{category.icon}</span>
					<span class="text-center px-2">{category.name}</span>
					<span class="text-xs font-normal opacity-80 mt-1 px-2 text-center">{category.hint}</span>
				</a>
			{/each}
		</div>
	{:else if !data.subcategoryId}
		<!-- Step 2: Subcategory Buttons -->
		<div class="space-y-4">
			<a
				href={buildUrl({ category: null, sub: null })}
				class="inline-flex items-center text-blue-600 hover:underline"
			>
				<svg class="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
				</svg>
				Back to Categories
			</a>

			<h3 class="text-lg font-semibold text-gray-900">
				{data.selectedCategory?.name}
			</h3>

			<div class="grid grid-cols-2 gap-3">
				{#each data.subcategories as subcategory (subcategory.id)}
					<a
						href={buildUrl({ sub: subcategory.id })}
						class="bg-white border-2 border-blue-200 text-blue-800 rounded-lg p-4 text-center font-medium shadow hover:bg-blue-50 hover:border-blue-400 active:scale-95 transition-all"
					>
						{subcategory.name}
					</a>
				{/each}
			</div>
		</div>
	{:else}
		<!-- Step 3: Product List -->
		<div class="space-y-4">
			<div class="flex items-center gap-2">
				<a
					href={buildUrl({ sub: null })}
					class="inline-flex items-center text-blue-600 hover:underline"
				>
					<svg class="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
					</svg>
					Back
				</a>
				<span class="text-gray-400">|</span>
				<a
					href={buildUrl({ category: null, sub: null })}
					class="text-blue-600 hover:underline text-sm"
				>
					All Categories
				</a>
			</div>

			<h3 class="text-lg font-semibold text-gray-900">
				{data.selectedCategory?.name} &rsaquo; {data.selectedSubcategory?.name}
			</h3>

			{#if data.products.length === 0}
				<div class="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
					<svg class="w-12 h-12 text-yellow-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
					</svg>
					<p class="text-yellow-800 font-medium">No products available</p>
					<p class="text-yellow-700 text-sm mt-1">
						No products in this category are assigned to your project yet.
						Contact your manager to add products.
					</p>
				</div>
			{:else}
				<div class="space-y-3">
					{#each data.products as product (product.id)}
						<div class="bg-white rounded-lg shadow p-4">
							<div class="flex justify-between items-start">
								<div class="flex-1">
									<h4 class="font-medium text-gray-900">{product.name}</h4>
									<p class="text-sm text-gray-500">{product.sku}</p>
									{#if product.description}
										<p class="text-sm text-gray-600 mt-1">{product.description}</p>
									{/if}
								</div>
								<div class="text-right">
									<p class="font-bold text-blue-600">CHF {formatPrice(product.pricePerUnit)}</p>
									<p class="text-xs text-gray-500">per {product.unit}</p>
								</div>
							</div>
							<div class="mt-3 flex items-center gap-3">
								<div class="flex items-center border rounded-md">
									<button
										type="button"
										class="px-3 py-2 text-gray-600 hover:bg-gray-100"
										onclick={() => {
											if (quantities[product.id] > 1) {
												quantities[product.id]--;
											}
										}}
									>
										-
									</button>
									<input
										type="number"
										min="1"
										class="w-16 text-center border-x py-2"
										bind:value={quantities[product.id]}
									/>
									<button
										type="button"
										class="px-3 py-2 text-gray-600 hover:bg-gray-100"
										onclick={() => {
											quantities[product.id] = (quantities[product.id] || 1) + 1;
										}}
									>
										+
									</button>
								</div>
								<button
									type="button"
									class="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md font-medium hover:bg-blue-700 active:scale-95 transition-all"
									onclick={() => addToCart(product)}
								>
									Add to Cart
								</button>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}

	<!-- Floating Cart Summary (above bottom nav) -->
	{#if cartItems.length > 0}
		<div class="fixed bottom-16 left-0 right-0 bg-white border-t shadow-lg p-4 z-40">
			<div class="max-w-lg mx-auto flex items-center justify-between">
				<div>
					<p class="font-medium text-gray-900">{getCartItemCount()} items</p>
					<p class="text-lg font-bold text-blue-600">CHF {formatPrice(getCartTotal())}</p>
				</div>
				<a
					href="/worker/order/checkout?project={currentProjectId}"
					class="bg-green-600 text-white py-3 px-6 rounded-lg font-bold hover:bg-green-700 active:scale-95 transition-all"
				>
					Checkout
				</a>
			</div>
		</div>
		<!-- Spacer for floating cart + bottom nav -->
		<div class="h-32"></div>
	{/if}
</div>
