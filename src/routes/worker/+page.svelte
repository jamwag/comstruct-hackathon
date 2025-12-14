<script lang="ts">
	import type { PageData } from './$types';
	import VoiceMicButton from '$lib/components/voice/VoiceMicButton.svelte';
	import CMaterialsInfoBanner from '$lib/components/CMaterialsInfoBanner.svelte';
	import { selectedProjectId } from '$lib/stores/selectedProject';
	import { cart } from '$lib/stores/cart';
	import { offlineStore } from '$lib/stores/offline';
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	// Note: cart is still needed for PunchOut return handling

	let { data }: { data: PageData } = $props();

	// Get current project from store
	const currentProjectId = $derived($selectedProjectId);
	const selectedProject = $derived(data.projects.find((p) => p.id === currentProjectId));

	// Suppliers with external shop URLs
	const suppliersWithShops = $derived(data.suppliers.filter((s) => s.shopUrl));

	// Kit modal state
	let selectedKit = $state<typeof data.kits[0] | null>(null);
	let isOrdering = $state(false);
	let kitOrderResult = $state<{ success: boolean; isOffline?: boolean; orderNumber?: string } | null>(null);

	// Offline state
	const isOnline = $derived($offlineStore.isOnline);

	function openKitModal(kit: typeof data.kits[0]) {
		selectedKit = kit;
		kitOrderResult = null;
	}

	function closeKitModal() {
		selectedKit = null;
		kitOrderResult = null;
	}

	async function orderKit() {
		if (!selectedKit || !currentProjectId) return;

		isOrdering = true;
		kitOrderResult = null;

		// Build the order payload
		const orderPayload = {
			projectId: currentProjectId,
			items: selectedKit.items.map(item => ({
				productId: item.productId,
				quantity: item.quantity
			})),
			notes: `Kit: ${selectedKit.name}`
		};

		// Try online submission first
		if (navigator.onLine) {
			try {
				const response = await fetch('/api/orders', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(orderPayload)
				});

				if (response.ok) {
					const { orderNumber } = await response.json();
					kitOrderResult = { success: true, orderNumber };
					isOrdering = false;
					return;
				}
				// Server error - fall through to queue
			} catch {
				// Network error - fall through to queue
			}
		}

		// Offline or failed - queue the kit order
		offlineStore.queueOrder({
			projectId: currentProjectId,
			items: selectedKit.items.map(item => ({
				productId: item.productId,
				name: item.name,
				sku: item.sku,
				quantity: item.quantity,
				pricePerUnit: item.pricePerUnit,
				unit: item.unit
			})),
			notes: null,
			priority: 'normal',
			kitName: selectedKit.name
		});

		kitOrderResult = { success: true, isOffline: true };
		isOrdering = false;
	}

	// Handle PunchOut return - merge items from cookie into cart
	$effect(() => {
		if (browser && $page.url.searchParams.get('punchout') === '1') {
			const itemsCookie = document.cookie
				.split('; ')
				.find((c) => c.startsWith('punchout_items='));

			if (itemsCookie) {
				try {
					const items = JSON.parse(decodeURIComponent(itemsCookie.split('=')[1]));
					for (const item of items) {
						cart.addItem(
							{
								productId: item.productId,
								name: item.name,
								sku: item.sku,
								pricePerUnit: item.pricePerUnit,
								unit: item.unit
							},
							item.quantity
						);
					}
					// Clear cookie
					document.cookie = 'punchout_items=; path=/; max-age=0';
					// Navigate to checkout
					goto('/worker/order/checkout');
				} catch (e) {
					console.error('Failed to parse punchout items:', e);
					// Clear the query param
					goto('/worker', { replaceState: true });
				}
			} else {
				// No cookie but punchout param present, clear it
				goto('/worker', { replaceState: true });
			}
		}
	});

	function getReturnUrl(): string {
		if (browser) {
			return `${window.location.origin}/api/punchout/return`;
		}
		return '';
	}

	function openSupplierShop(shopUrl: string) {
		const returnUrl = encodeURIComponent(getReturnUrl());
		window.location.href = `${shopUrl}?returnUrl=${returnUrl}`;
	}
</script>

<svelte:head>
	<title>Purchasing - ComStruct</title>
</svelte:head>

<div class="space-y-6">
	{#if data.projects.length === 0}
		<!-- No project assigned message -->
		<div class="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
			<p class="text-yellow-800 font-medium">You are not assigned to any project.</p>
			<p class="text-yellow-700 text-sm mt-1">
				Please contact your manager to be assigned to a project.
			</p>
		</div>
	{:else}
		<!-- C-Materials Info Banner -->
		<CMaterialsInfoBanner />

		<!-- Voice Ordering Section - Main Feature (Enhanced) -->
		<div
			class="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg shadow-lg p-6 border border-blue-100"
		>
			<div class="text-center mb-4">
				<h2 class="text-2xl font-bold text-gray-900">Quick Voice Order</h2>
				<p class="mt-1 text-gray-600">Tap the mic and tell me what you need</p>
				{#if selectedProject}
					<p class="text-sm text-gray-500 mt-2">
						Ordering for: <span class="font-medium">{selectedProject.name}</span>
					</p>
				{/if}
			</div>

			<!-- Voice mic button -->
			<VoiceMicButton projectId={currentProjectId} />

			<!-- Enhanced "Browse the catalog" button -->
			<div class="mt-8 pt-6 border-t border-blue-200">
				<a
					href="/worker/order"
					class="block w-full bg-blue-600 text-white py-4 px-6 rounded-xl font-bold text-lg text-center hover:bg-blue-700 active:scale-95 transition-all shadow-md"
				>
					Browse the Catalog
				</a>
				<p class="text-center text-gray-500 text-sm mt-2">Or browse products manually</p>
			</div>
		</div>

		<!-- Quick Kits Section -->
		{@const projectKits = data.kits.filter(k => k.projectId === currentProjectId)}
		{#if projectKits.length > 0}
			<div class="bg-white rounded-lg shadow p-6">
				<h3 class="text-lg font-semibold text-gray-900 mb-2">Quick Kits</h3>
				<p class="text-sm text-gray-600 mb-4">
					One-tap bundles for common tasks
				</p>
				<div class="grid grid-cols-2 sm:grid-cols-3 gap-4">
					{#each projectKits as kit (kit.id)}
						<button
							onclick={() => openKitModal(kit)}
							class="flex flex-col items-center p-4 bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl hover:from-amber-100 hover:to-orange-100 transition-all border-2 border-amber-200 hover:border-amber-300 active:scale-95"
						>
							<span class="text-3xl mb-2">{kit.icon || '📦'}</span>
							<span class="font-semibold text-gray-900 text-center text-sm">{kit.name}</span>
							<span class="text-xs text-gray-500 mt-1">{kit.itemCount} items</span>
							<span class="text-xs font-medium text-amber-700 mt-1">~CHF {(kit.totalPrice / 100).toFixed(0)}</span>
						</button>
					{/each}
				</div>
			</div>
		{/if}

		<!-- External Supplier Catalogs (PunchOut) -->
		{#if suppliersWithShops.length > 0}
			<div class="bg-white rounded-lg shadow p-6">
				<h3 class="text-lg font-semibold text-gray-900 mb-2">External Supplier Catalogs</h3>
				<p class="text-sm text-gray-600 mb-4">
					Browse supplier catalogs and add items directly to your cart
				</p>
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
					{#each suppliersWithShops as supplier (supplier.id)}
						<button
							type="button"
							onclick={() => openSupplierShop(supplier.shopUrl!)}
							class="flex items-center gap-3 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-left border border-gray-200 cursor-pointer touch-manipulation"
						>
							<div
								class="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0"
							>
								<svg
									class="w-5 h-5 text-blue-600"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
									/>
								</svg>
							</div>
							<div class="flex-1 min-w-0">
								<span class="font-medium text-gray-900 block truncate">{supplier.name}</span>
								<span class="text-xs text-gray-500">Browse catalog</span>
							</div>
							<svg
								class="w-5 h-5 text-gray-400 flex-shrink-0"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
								/>
							</svg>
						</button>
					{/each}
				</div>
			</div>
		{/if}
	{/if}
</div>

<!-- Kit Order Modal -->
{#if selectedKit}
	<div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center modal-container">
		<!-- Backdrop -->
		<button
			class="absolute inset-0 bg-black/50 backdrop-blur-sm"
			onclick={closeKitModal}
			aria-label="Close"
		></button>

		<!-- Modal -->
		<div class="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md max-h-[70vh] overflow-hidden animate-slide-up">
			<!-- Header -->
			<div class="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-4 text-white">
				<div class="flex items-center gap-3">
					<span class="text-4xl">{selectedKit.icon || '📦'}</span>
					<div>
						<h3 class="text-xl font-bold">{selectedKit.name}</h3>
						<p class="text-amber-100 text-sm">{selectedKit.itemCount} items</p>
					</div>
				</div>
			</div>

			<!-- Items List -->
			<div class="max-h-64 overflow-y-auto divide-y">
				{#each selectedKit.items as item (item.productId)}
					<div class="px-6 py-3 flex items-center justify-between">
						<div class="flex-1 min-w-0">
							<div class="font-medium text-gray-900 truncate">{item.name}</div>
							<div class="text-sm text-gray-500">{item.sku}</div>
						</div>
						<div class="text-right ml-4">
							<div class="font-bold text-gray-900">×{item.quantity}</div>
							<div class="text-sm text-gray-500">CHF {(item.pricePerUnit * item.quantity / 100).toFixed(2)}</div>
						</div>
					</div>
				{/each}
			</div>

			<!-- Total & Actions -->
			<div class="border-t bg-gray-50 px-6 py-4">
				{#if kitOrderResult?.success}
					<!-- Success message -->
					<div class="text-center py-4">
						<div class="text-4xl mb-2">
							{kitOrderResult.isOffline ? '📱' : '✅'}
						</div>
						<p class="font-bold {kitOrderResult.isOffline ? 'text-blue-700' : 'text-green-700'}">
							{kitOrderResult.isOffline ? 'Kit Saved Offline' : 'Kit Ordered!'}
						</p>
						<p class="text-sm text-gray-600 mt-1">
							{kitOrderResult.isOffline
								? 'Will be submitted when you reconnect'
								: `Order #${kitOrderResult.orderNumber}`}
						</p>
						{#if kitOrderResult.isOffline}
							<button
								onclick={closeKitModal}
								class="mt-4 px-6 py-2 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700"
							>
								Done
							</button>
						{/if}
					</div>
				{:else}
					<div class="flex items-center justify-between mb-4">
						<span class="text-gray-600 font-medium">Total</span>
						<span class="text-2xl font-bold text-gray-900">CHF {(selectedKit.totalPrice / 100).toFixed(2)}</span>
					</div>

					{#if !isOnline}
						<div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
							<p class="text-yellow-800 text-sm text-center">
								You're offline. Kit will be saved for later.
							</p>
						</div>
					{/if}

					<div class="flex gap-3">
						<button
							onclick={closeKitModal}
							class="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-300 active:scale-95 transition-all"
						>
							Cancel
						</button>
						<button
							onclick={orderKit}
							disabled={isOrdering}
							class="flex-1 px-4 py-3 rounded-xl font-bold active:scale-95 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed {isOnline
								? 'bg-green-600 text-white hover:bg-green-700'
								: 'bg-blue-600 text-white hover:bg-blue-700'}"
						>
							{#if isOrdering}
								{isOnline ? 'Ordering...' : 'Saving...'}
							{:else if !isOnline}
								Save for Later
							{:else}
								Order Now
							{/if}
						</button>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	@keyframes slide-up {
		from {
			transform: translateY(100%);
			opacity: 0;
		}
		to {
			transform: translateY(0);
			opacity: 1;
		}
	}

	.animate-slide-up {
		animation: slide-up 0.3s ease-out;
	}

	/* Offset modal above bottom nav on mobile */
	.modal-container {
		padding-bottom: calc(4rem + env(safe-area-inset-bottom, 0px));
	}

	@media (min-width: 640px) {
		.modal-container {
			padding-bottom: 0;
		}
	}
</style>
