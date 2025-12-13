<script lang="ts">
	import type { PageData } from './$types';
	import { cart, type CartItem } from '$lib/stores/cart';
	import { page } from '$app/stores';

	let { data }: { data: PageData } = $props();

	// Track quantities for adding to cart
	let quantities = $state<Record<string, number>>({});

	// Get cart items for display
	let cartItems = $state<CartItem[]>([]);
	cart.subscribe((items) => {
		cartItems = items;
	});

	$effect(() => {
		// Reset quantities when products change
		quantities = {};
		for (const product of data.products) {
			quantities[product.id] = 1;
		}
	});

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
	<!-- Header with project selector -->
	<div class="bg-white rounded-lg shadow p-4">
		<div class="flex items-center justify-between">
			<h2 class="text-xl font-bold text-gray-900">Order Products</h2>
			{#if data.projects.length > 1}
				<select
					class="rounded-md border border-gray-300 px-3 py-2 text-sm"
					value={data.selectedProject?.id || ''}
					onchange={(e) => {
						const url = new URL($page.url);
						url.searchParams.set('project', e.currentTarget.value);
						url.searchParams.delete('category');
						url.searchParams.delete('sub');
						window.location.href = url.toString();
					}}
				>
					{#each data.projects as project (project.id)}
						<option value={project.id}>{project.name}</option>
					{/each}
				</select>
			{:else if data.selectedProject}
				<span class="text-sm text-gray-500">Project: {data.selectedProject.name}</span>
			{/if}
		</div>
	</div>

	{#if data.projects.length === 0}
		<!-- No project assigned -->
		<div class="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
			<p class="text-yellow-800 font-medium">You are not assigned to any project.</p>
			<p class="text-yellow-700 text-sm mt-1">Please contact your manager to be assigned to a project.</p>
		</div>
	{:else if !data.categoryId}
		<!-- Step 1: Main Category Buttons -->
		<div class="grid grid-cols-2 gap-4">
			{#each data.mainCategories as category (category.id)}
				<a
					href={buildUrl({ category: category.id, sub: null })}
					class="aspect-square bg-blue-500 text-white rounded-xl flex flex-col items-center justify-center text-lg font-bold shadow-lg hover:bg-blue-600 active:scale-95 transition-all"
				>
					<span class="text-5xl mb-3">{category.icon}</span>
					<span class="text-center px-2">{category.name}</span>
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
				<div class="bg-gray-50 rounded-lg p-6 text-center">
					<p class="text-gray-500">No products in this category yet.</p>
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

	<!-- Floating Cart Summary -->
	{#if cartItems.length > 0}
		<div class="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4 z-50">
			<div class="max-w-lg mx-auto flex items-center justify-between">
				<div>
					<p class="font-medium text-gray-900">{getCartItemCount()} items</p>
					<p class="text-lg font-bold text-blue-600">CHF {formatPrice(getCartTotal())}</p>
				</div>
				<a
					href="/worker/order/checkout?project={data.selectedProject?.id}"
					class="bg-green-600 text-white py-3 px-6 rounded-lg font-bold hover:bg-green-700 active:scale-95 transition-all"
				>
					Checkout
				</a>
			</div>
		</div>
		<!-- Spacer for fixed bottom bar -->
		<div class="h-24"></div>
	{/if}
</div>
