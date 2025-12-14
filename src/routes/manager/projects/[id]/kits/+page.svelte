<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let showCreateForm = $state(false);
	let expandedKitId = $state<string | null>(null);
	let selectedProductId = $state('');

	const icons = ['📦', '🧰', '🔧', '🔩', '🦺', '🎨', '⚡', '🧱', '🪚', '🪛'];

	function formatPrice(cents: number): string {
		return (cents / 100).toFixed(2);
	}

	function toggleKit(kitId: string) {
		expandedKitId = expandedKitId === kitId ? null : kitId;
	}
</script>

<svelte:head>
	<title>Product Kits - {data.project.name} - ComStruct</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<a href="/manager/projects/{data.project.id}" class="text-blue-600 hover:underline text-sm">&larr; Back to Project</a>
			<h2 class="text-2xl font-bold text-gray-900 mt-2">Product Kits</h2>
			<p class="text-gray-500 mt-1">Create quick-order bundles for workers</p>
		</div>
		<button
			onclick={() => showCreateForm = !showCreateForm}
			class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
		>
			{showCreateForm ? 'Cancel' : '+ Create Kit'}
		</button>
	</div>

	<!-- Create Kit Form -->
	{#if showCreateForm}
		<div class="bg-white rounded-lg shadow p-6">
			<h3 class="text-lg font-semibold text-gray-900 mb-4">Create New Kit</h3>
			<form method="post" action="?/createKit" use:enhance={() => {
				return async ({ result, update }) => {
					if (result.type === 'success') {
						showCreateForm = false;
					}
					await update();
				};
			}} class="space-y-4">
				<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div>
						<label for="name" class="block text-sm font-medium text-gray-700 mb-1">Kit Name</label>
						<input
							type="text"
							id="name"
							name="name"
							required
							placeholder="e.g., Drywall Starter Kit"
							class="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
						/>
					</div>
					<div>
						<label class="block text-sm font-medium text-gray-700 mb-1">Icon</label>
						<div class="flex gap-2 flex-wrap">
							{#each icons as icon}
								<label class="cursor-pointer">
									<input type="radio" name="icon" value={icon} class="sr-only peer" checked={icon === '📦'} />
									<span class="w-10 h-10 flex items-center justify-center text-xl border-2 rounded-lg peer-checked:border-blue-500 peer-checked:bg-blue-50 hover:bg-gray-50 transition-colors">
										{icon}
									</span>
								</label>
							{/each}
						</div>
					</div>
				</div>
				<div>
					<label for="description" class="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
					<input
						type="text"
						id="description"
						name="description"
						placeholder="e.g., Everything needed for 50m² of drywall work"
						class="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
					/>
				</div>
				<button
					type="submit"
					class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
				>
					Create Kit
				</button>
			</form>
		</div>
	{/if}

	<!-- Existing Kits -->
	{#if data.kits.length === 0}
		<div class="bg-white rounded-lg shadow p-8 text-center">
			<div class="text-4xl mb-4">🧰</div>
			<h3 class="text-lg font-semibold text-gray-900 mb-2">No kits yet</h3>
			<p class="text-gray-500 mb-4">Create product kits to help workers order faster</p>
			<button
				onclick={() => showCreateForm = true}
				class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
			>
				Create Your First Kit
			</button>
		</div>
	{:else}
		<div class="space-y-4">
			{#each data.kits as kit (kit.id)}
				<div class="bg-white rounded-lg shadow overflow-hidden">
					<!-- Kit Header -->
					<div
						class="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
						onclick={() => toggleKit(kit.id)}
						role="button"
						tabindex="0"
						onkeydown={(e) => e.key === 'Enter' && toggleKit(kit.id)}
					>
						<div class="flex items-center gap-4">
							<span class="text-3xl">{kit.icon}</span>
							<div>
								<div class="flex items-center gap-2">
									<h3 class="font-semibold text-gray-900">{kit.name}</h3>
									{#if !kit.isActive}
										<span class="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded">Inactive</span>
									{/if}
								</div>
								{#if kit.description}
									<p class="text-sm text-gray-500">{kit.description}</p>
								{/if}
								<div class="flex items-center gap-4 mt-1 text-sm text-gray-500">
									<span>{kit.itemCount} items</span>
									<span>~CHF {formatPrice(kit.totalPrice)}</span>
								</div>
							</div>
						</div>
						<div class="flex items-center gap-2">
							<form method="post" action="?/toggleActive" use:enhance>
								<input type="hidden" name="kitId" value={kit.id} />
								<input type="hidden" name="isActive" value={kit.isActive.toString()} />
								<button
									type="submit"
									class="px-3 py-1 text-sm rounded {kit.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'} hover:opacity-80 transition-opacity"
									onclick={(e) => e.stopPropagation()}
								>
									{kit.isActive ? 'Active' : 'Inactive'}
								</button>
							</form>
							<svg
								class="w-5 h-5 text-gray-400 transition-transform {expandedKitId === kit.id ? 'rotate-180' : ''}"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
							</svg>
						</div>
					</div>

					<!-- Expanded Kit Details -->
					{#if expandedKitId === kit.id}
						<div class="border-t bg-gray-50 p-4">
							<!-- Kit Items -->
							{#if kit.items.length > 0}
								<div class="space-y-2 mb-4">
									{#each kit.items as item (item.product.id)}
										<div class="flex items-center justify-between bg-white p-3 rounded-lg">
											<div class="flex-1">
												<span class="font-medium text-gray-900">{item.product.name}</span>
												<span class="text-sm text-gray-500 ml-2">
													CHF {formatPrice(item.product.pricePerUnit)} / {item.product.unit}
												</span>
											</div>
											<div class="flex items-center gap-2">
												<form method="post" action="?/updateItemQuantity" use:enhance class="flex items-center gap-1">
													<input type="hidden" name="kitId" value={kit.id} />
													<input type="hidden" name="productId" value={item.product.id} />
													<button
														type="submit"
														name="quantity"
														value={item.quantity - 1}
														class="w-8 h-8 flex items-center justify-center bg-gray-200 rounded hover:bg-gray-300 transition-colors"
													>
														-
													</button>
													<span class="w-12 text-center font-medium">{item.quantity}</span>
													<button
														type="submit"
														name="quantity"
														value={item.quantity + 1}
														class="w-8 h-8 flex items-center justify-center bg-gray-200 rounded hover:bg-gray-300 transition-colors"
													>
														+
													</button>
												</form>
												<form method="post" action="?/removeItem" use:enhance>
													<input type="hidden" name="kitId" value={kit.id} />
													<input type="hidden" name="productId" value={item.product.id} />
													<button
														type="submit"
														class="p-1 text-red-500 hover:bg-red-100 rounded transition-colors"
														title="Remove item"
													>
														<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
															<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
														</svg>
													</button>
												</form>
											</div>
										</div>
									{/each}
								</div>
							{:else}
								<p class="text-gray-500 text-sm mb-4">No items in this kit yet. Add products below.</p>
							{/if}

							<!-- Add Product to Kit -->
							<form method="post" action="?/addItem" use:enhance class="flex gap-2">
								<input type="hidden" name="kitId" value={kit.id} />
								<select
									name="productId"
									bind:value={selectedProductId}
									class="flex-1 rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
								>
									<option value="">Select a product to add...</option>
									{#each data.products as { product } (product.id)}
										<option value={product.id}>
											{product.name} - CHF {formatPrice(product.pricePerUnit)}/{product.unit}
										</option>
									{/each}
								</select>
								<input
									type="number"
									name="quantity"
									min="1"
									value="1"
									class="w-20 rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
								/>
								<button
									type="submit"
									class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
								>
									Add
								</button>
							</form>

							<!-- Delete Kit -->
							<div class="mt-4 pt-4 border-t flex justify-end">
								<form method="post" action="?/deleteKit" use:enhance>
									<input type="hidden" name="kitId" value={kit.id} />
									<button
										type="submit"
										class="px-3 py-1 text-sm text-red-600 hover:bg-red-100 rounded transition-colors"
									>
										Delete Kit
									</button>
								</form>
							</div>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>
