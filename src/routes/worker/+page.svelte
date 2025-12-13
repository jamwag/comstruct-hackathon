<script lang="ts">
	import type { PageData } from './$types';
	import VoiceMicButton from '$lib/components/voice/VoiceMicButton.svelte';
	import CMaterialsInfoBanner from '$lib/components/CMaterialsInfoBanner.svelte';
	import { selectedProjectId } from '$lib/stores/selectedProject';
	import { cart } from '$lib/stores/cart';
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';

	let { data }: { data: PageData } = $props();

	// Get current project from store
	const currentProjectId = $derived($selectedProjectId);
	const selectedProject = $derived(data.projects.find((p) => p.id === currentProjectId));

	// Suppliers with external shop URLs
	const suppliersWithShops = $derived(data.suppliers.filter((s) => s.shopUrl));

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
		<CMaterialsInfoBanner threshold={selectedProject?.autoApprovalThreshold ? selectedProject.autoApprovalThreshold / 100 : 200} />

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
							onclick={() => openSupplierShop(supplier.shopUrl!)}
							class="flex items-center gap-3 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-left border border-gray-200"
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
