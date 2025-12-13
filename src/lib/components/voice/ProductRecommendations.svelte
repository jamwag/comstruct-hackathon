<script lang="ts">
	import { cart, type CartItem } from '$lib/stores/cart';

	interface Product {
		id: string;
		name: string;
		sku: string;
		description: string | null;
		unit: string;
		pricePerUnit: number;
		categoryName: string | null;
		matchScore: number;
		matchReason: string;
	}

	interface Recommendation {
		forItem: string;
		quantity: number;
		products: Product[];
	}

	interface Props {
		recommendations: Recommendation[];
		onAddToCart?: (product: Product, quantity: number) => void;
		onClear?: () => void;
	}

	let { recommendations, onAddToCart, onClear }: Props = $props();

	// Track which products have been added
	let addedProducts = $state<Set<string>>(new Set());

	function formatPrice(cents: number): string {
		return (cents / 100).toFixed(2);
	}

	function handleAddToCart(product: Product, quantity: number) {
		cart.addItem(
			{
				productId: product.id,
				name: product.name,
				sku: product.sku,
				pricePerUnit: product.pricePerUnit,
				unit: product.unit
			},
			quantity
		);

		addedProducts.add(product.id);
		addedProducts = new Set(addedProducts);

		onAddToCart?.(product, quantity);

		// Haptic feedback
		if (navigator.vibrate) {
			navigator.vibrate(50);
		}
	}

	function handleAddAll() {
		for (const rec of recommendations) {
			if (rec.products.length > 0) {
				const topProduct = rec.products[0];
				if (!addedProducts.has(topProduct.id)) {
					handleAddToCart(topProduct, rec.quantity);
				}
			}
		}
	}

	function getConfidenceColor(score: number): string {
		if (score >= 0.7) return 'bg-green-100 text-green-800';
		if (score >= 0.4) return 'bg-yellow-100 text-yellow-800';
		return 'bg-gray-100 text-gray-600';
	}

	// Flatten all unique products
	const allProducts = $derived(() => {
		const products: Array<{ product: Product; quantity: number }> = [];
		for (const rec of recommendations) {
			for (const product of rec.products) {
				if (!products.some((p) => p.product.id === product.id)) {
					products.push({ product, quantity: rec.quantity });
				}
			}
		}
		return products;
	});

	const hasProducts = $derived(recommendations.some((r) => r.products.length > 0));
</script>

{#if recommendations.length > 0}
	<div class="space-y-4">
		{#if hasProducts}
			<!-- Quick actions -->
			<div class="flex gap-2 justify-end">
				<button
					onclick={() => handleAddAll()}
					class="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 active:scale-95 transition-all"
				>
					Add Top Matches
				</button>
				<button
					onclick={() => onClear?.()}
					class="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 active:scale-95 transition-all"
				>
					Clear
				</button>
			</div>
		{/if}

		{#each recommendations as rec (rec.forItem)}
			<div class="bg-white border border-gray-200 rounded-lg overflow-hidden">
				<!-- Item header -->
				<div class="bg-gray-50 px-4 py-2 border-b">
					<span class="font-medium text-gray-700">Looking for:</span>
					<span class="text-gray-900 ml-1">{rec.forItem}</span>
					{#if rec.quantity > 1}
						<span class="text-gray-500 ml-1">(x{rec.quantity})</span>
					{/if}
				</div>

				{#if rec.products.length === 0}
					<div class="px-4 py-6 text-center text-gray-500">
						<svg class="mx-auto h-10 w-10 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
						<p>No matching products found in your project</p>
					</div>
				{:else}
					<div class="divide-y">
						{#each rec.products as product (product.id)}
							{@const isAdded = addedProducts.has(product.id)}
							<div class="px-4 py-3 flex items-center gap-3">
								<!-- Product info -->
								<div class="flex-1 min-w-0">
									<div class="flex items-center gap-2 flex-wrap">
										<span class="font-medium text-gray-900 truncate">{product.name}</span>
										<span class="text-xs px-2 py-0.5 rounded {getConfidenceColor(product.matchScore)}">
											{Math.round(product.matchScore * 100)}% match
										</span>
									</div>
									<div class="text-sm text-gray-500 mt-0.5">
										<span>{product.sku}</span>
										{#if product.categoryName}
											<span class="mx-1">·</span>
											<span>{product.categoryName}</span>
										{/if}
									</div>
									<div class="text-xs text-gray-400 mt-0.5">{product.matchReason}</div>
								</div>

								<!-- Price -->
								<div class="text-right">
									<div class="font-bold text-gray-900">CHF {formatPrice(product.pricePerUnit)}</div>
									<div class="text-xs text-gray-500">per {product.unit}</div>
								</div>

								<!-- Add button -->
								<button
									onclick={() => handleAddToCart(product, rec.quantity)}
									disabled={isAdded}
									class="px-4 py-2 rounded-lg font-medium min-w-20 transition-all {isAdded
										? 'bg-green-100 text-green-700 cursor-default'
										: 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95'}"
								>
									{#if isAdded}
										Added
									{:else}
										Add
									{/if}
								</button>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/each}
	</div>
{/if}
