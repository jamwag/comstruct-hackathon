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
		// Smart quantity suggestion
		usualQuantity?: number;
		orderCount?: number;
	}

	interface Recommendation {
		forItem: string;
		quantity: number;
		products: Product[];
	}

	// Indexed product for conversation context
	export interface IndexedProduct {
		index: number;
		productId: string;
		productName: string;
		sku: string;
		pricePerUnit: number;
		unit: string;
	}

	interface Props {
		recommendations: Recommendation[];
		onAddToCart?: (product: Product, quantity: number) => void;
		onClear?: () => void;
		onProductsIndexed?: (products: IndexedProduct[]) => void;
	}

	let { recommendations, onAddToCart, onClear, onProductsIndexed }: Props = $props();

	// Quantity modal state
	let quantityModalProduct = $state<(Product & { globalIndex: number; suggestedQty: number }) | null>(null);
	let quantityValue = $state(1);

	// Compute globally indexed products across all recommendations
	const indexedRecommendations = $derived.by(() => {
		let globalIndex = 1;
		return recommendations.map((rec) => ({
			...rec,
			products: rec.products.map((product) => ({
				...product,
				globalIndex: globalIndex++
			}))
		}));
	});

	// Build indexed products list for context and notify parent
	$effect(() => {
		const indexed: IndexedProduct[] = [];
		for (const rec of indexedRecommendations) {
			for (const product of rec.products) {
				indexed.push({
					index: product.globalIndex,
					productId: product.id,
					productName: product.name,
					sku: product.sku,
					pricePerUnit: product.pricePerUnit,
					unit: product.unit
				});
			}
		}
		onProductsIndexed?.(indexed);
	});

	// Track which products have been added
	let addedProducts = $state<Set<string>>(new Set());

	function formatPrice(cents: number): string {
		return (cents / 100).toFixed(2);
	}

	function openQuantityModal(product: Product & { globalIndex: number }, suggestedQty: number) {
		quantityModalProduct = { ...product, suggestedQty };
		quantityValue = suggestedQty;
	}

	function closeQuantityModal() {
		quantityModalProduct = null;
	}

	function confirmAddToCart() {
		if (!quantityModalProduct || quantityValue < 1) return;
		handleAddToCart(quantityModalProduct, quantityValue);
		closeQuantityModal();
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

	const hasProducts = $derived(indexedRecommendations.some((r) => r.products.length > 0));
</script>

{#if indexedRecommendations.length > 0}
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

		{#each indexedRecommendations as rec (rec.forItem)}
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
							{@const suggestedQty = product.usualQuantity || rec.quantity}
							<div class="px-4 py-3">
								<!-- Row 1: Index badge + Product name -->
								<div class="flex items-start gap-3 mb-2">
									<div class="w-8 h-8 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-sm flex-shrink-0">
										{product.globalIndex}
									</div>
									<div class="flex-1 min-w-0">
										<div class="font-medium text-gray-900">{product.name}</div>
										<div class="text-sm text-gray-500 mt-0.5">
											{product.sku}
											{#if product.categoryName}
												<span class="mx-1">·</span>
												{product.categoryName}
											{/if}
										</div>
									</div>
									<span class="text-xs px-2 py-0.5 rounded flex-shrink-0 {getConfidenceColor(product.matchScore)}">
										{Math.round(product.matchScore * 100)}%
									</span>
								</div>

								<!-- Row 2: Price + Add button -->
								<div class="flex items-center justify-between gap-3 ml-11">
									<div>
										<span class="font-bold text-gray-900">CHF {formatPrice(product.pricePerUnit)}</span>
										<span class="text-sm text-gray-500">/ {product.unit}</span>
									</div>
									<button
										onclick={() => openQuantityModal(product, suggestedQty)}
										disabled={isAdded}
										class="px-5 py-2 rounded-lg font-medium transition-all {isAdded
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
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/each}
	</div>
{/if}

<!-- Quantity Modal -->
{#if quantityModalProduct}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
		<!-- Backdrop -->
		<button
			class="absolute inset-0 bg-black/50 backdrop-blur-sm"
			onclick={closeQuantityModal}
			aria-label="Close"
		></button>

		<!-- Modal -->
		<div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-scale-in">
			<!-- Header -->
			<div class="bg-blue-600 px-5 py-4 text-white">
				<h3 class="font-bold text-lg">Add to Cart</h3>
			</div>

			<!-- Content -->
			<div class="p-5">
				<div class="mb-4">
					<p class="font-medium text-gray-900">{quantityModalProduct.name}</p>
					<p class="text-sm text-gray-500">{quantityModalProduct.sku}</p>
					<p class="text-sm font-medium text-gray-700 mt-1">
						CHF {formatPrice(quantityModalProduct.pricePerUnit)} per {quantityModalProduct.unit}
					</p>
				</div>

				<!-- Quantity selector -->
				<div class="mb-4">
					<label for="quantity" class="block text-sm font-medium text-gray-700 mb-2">Quantity</label>
					<div class="flex items-center justify-center gap-3">
						<button
							onclick={() => quantityValue = Math.max(1, quantityValue - 1)}
							class="w-14 h-14 flex-shrink-0 rounded-xl bg-gray-100 text-gray-700 font-bold text-2xl hover:bg-gray-200 active:scale-95 transition-all flex items-center justify-center"
						>
							-
						</button>
						<input
							id="quantity"
							type="number"
							min="1"
							bind:value={quantityValue}
							class="w-28 text-center text-2xl font-bold border-2 border-gray-200 rounded-xl py-3 focus:border-blue-500 focus:outline-none"
						/>
						<button
							onclick={() => quantityValue = quantityValue + 1}
							class="w-14 h-14 flex-shrink-0 rounded-xl bg-gray-100 text-gray-700 font-bold text-2xl hover:bg-gray-200 active:scale-95 transition-all flex items-center justify-center"
						>
							+
						</button>
					</div>
				</div>

				<!-- Subtotal -->
				<div class="bg-gray-50 rounded-lg p-3 mb-4">
					<div class="flex justify-between items-center">
						<span class="text-gray-600">Subtotal</span>
						<span class="text-xl font-bold text-gray-900">
							CHF {formatPrice(quantityModalProduct.pricePerUnit * quantityValue)}
						</span>
					</div>
				</div>

				<!-- Actions -->
				<div class="flex gap-3">
					<button
						onclick={closeQuantityModal}
						class="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-300 active:scale-95 transition-all"
					>
						Cancel
					</button>
					<button
						onclick={confirmAddToCart}
						class="flex-1 px-4 py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 active:scale-95 transition-all"
					>
						Add to Cart
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	@keyframes scale-in {
		from {
			transform: scale(0.95);
			opacity: 0;
		}
		to {
			transform: scale(1);
			opacity: 1;
		}
	}

	.animate-scale-in {
		animation: scale-in 0.2s ease-out;
	}
</style>
