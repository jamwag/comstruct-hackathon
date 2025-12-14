<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import { cart, type CartState } from '$lib/stores/cart';
	import { offlineStore } from '$lib/stores/offline';
	import { onDestroy } from 'svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let cartState = $state<CartState>({ items: [], note: null, priority: 'normal' });
	let isSubmitting = $state(false);
	let showNoteInput = $state(false);
	let noteInput = $state('');

	// Offline-specific state
	let offlineSaved = $state(false);
	let submitResult = $state<{
		success: boolean;
		isAutoApproved?: boolean;
		totalCents?: number;
		isOffline?: boolean;
	} | null>(null);

	const isOnline = $derived($offlineStore.isOnline);

	const unsubscribe = cart.subscribe((state) => {
		cartState = state;
		noteInput = state.note || '';
	});
	onDestroy(unsubscribe);

	const cartItems = $derived(cartState.items);

	function formatPrice(cents: number): string {
		return (cents / 100).toFixed(2);
	}

	function getTotal(): number {
		return cart.getTotal(cartItems);
	}

	function getThreshold(): number {
		return data.project.autoApprovalThreshold ?? 20000;
	}

	function isOverThreshold(): boolean {
		return getTotal() > getThreshold();
	}

	function togglePriority() {
		cart.setPriority(cartState.priority === 'urgent' ? 'normal' : 'urgent');
	}

	function saveNote() {
		cart.setNote(noteInput.trim() || null);
		showNoteInput = false;
	}

	function clearNote() {
		cart.setNote(null);
		noteInput = '';
		showNoteInput = false;
	}

	// Handle successful submission from server action
	$effect(() => {
		if (form?.success) {
			cart.clear();
		}
	});

	// Custom submit handler with offline support
	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		isSubmitting = true;
		submitResult = null;

		const totalCents = getTotal();
		const orderPayload = {
			projectId: data.project.id,
			items: cartItems.map((item) => ({
				productId: item.productId,
				quantity: item.quantity
			})),
			notes: cartState.note,
			priority: cartState.priority
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
					const result = await response.json();
					cart.clear();
					submitResult = {
						success: true,
						isAutoApproved: result.isAutoApproved,
						totalCents: result.totalCents
					};
					isSubmitting = false;
					return;
				}
				// Server error - fall through to queue
			} catch {
				// Network error - fall through to queue
			}
		}

		// Offline or failed - queue the order
		offlineStore.queueOrder({
			projectId: data.project.id,
			items: cartItems.map((item) => ({
				productId: item.productId,
				name: item.name,
				sku: item.sku,
				quantity: item.quantity,
				pricePerUnit: item.pricePerUnit,
				unit: item.unit
			})),
			notes: cartState.note,
			priority: cartState.priority
		});

		cart.clear();
		submitResult = {
			success: true,
			isOffline: true,
			totalCents
		};
		isSubmitting = false;
	}
</script>

<svelte:head>
	<title>Checkout - ComStruct</title>
</svelte:head>

<div class="space-y-4">
	<div class="flex items-center gap-2">
		<a href="/worker/order" class="inline-flex items-center text-blue-600 hover:underline">
			<svg class="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
			</svg>
			Continue Shopping
		</a>
	</div>

	<div class="bg-white rounded-lg shadow p-4">
		<h2 class="text-xl font-bold text-gray-900 mb-2">Checkout</h2>
		<p class="text-sm text-gray-500">Project: {data.project.name}</p>
	</div>

	{#if form?.success || submitResult?.success}
		<!-- Success Message -->
		{@const result = submitResult || form}
		<div class="border rounded-lg p-6 text-center space-y-4 {result?.isOffline ? 'bg-blue-50 border-blue-200' : 'bg-green-50 border-green-200'}">
			<div class="text-5xl">
				{#if result?.isOffline}
					📱
				{:else if result?.isAutoApproved}
					✅
				{:else}
					⏳
				{/if}
			</div>
			<h3 class="text-xl font-bold {result?.isOffline ? 'text-blue-800' : 'text-green-800'}">
				{#if result?.isOffline}
					Order Saved Offline
				{:else if result?.isAutoApproved}
					Order Approved!
				{:else}
					Order Submitted
				{/if}
			</h3>
			<p class="{result?.isOffline ? 'text-blue-700' : 'text-green-700'}">
				{#if result?.isOffline}
					Your order for CHF {formatPrice(result?.totalCents ?? 0)} has been saved.
					It will be submitted automatically when you're back online.
				{:else if result?.isAutoApproved}
					Your order for CHF {formatPrice(result?.totalCents ?? 0)} has been automatically approved.
				{:else}
					Your order for CHF {formatPrice(result?.totalCents ?? 0)} is pending manager approval.
				{/if}
			</p>
			<div class="flex justify-center gap-3 pt-4">
				<a
					href="/worker/order"
					class="bg-blue-600 text-white py-2 px-4 rounded-md font-medium hover:bg-blue-700"
				>
					Order More
				</a>
				<a
					href="/worker"
					class="bg-gray-100 text-gray-700 py-2 px-4 rounded-md font-medium hover:bg-gray-200"
				>
					Back to Home
				</a>
			</div>
		</div>
	{:else if cartItems.length === 0}
		<!-- Empty Cart -->
		<div class="bg-gray-50 rounded-lg p-6 text-center">
			<p class="text-gray-500">Your cart is empty.</p>
			<a
				href="/worker/order"
				class="inline-block mt-4 bg-blue-600 text-white py-2 px-4 rounded-md font-medium hover:bg-blue-700"
			>
				Start Shopping
			</a>
		</div>
	{:else}
		<!-- Cart Items -->
		<div class="bg-white rounded-lg shadow divide-y">
			{#each cartItems as item (item.productId)}
				<div class="p-4">
					<!-- Row 1: Title, SKU and Remove button -->
					<div class="flex items-start justify-between gap-3 mb-3">
						<div class="flex-1 min-w-0">
							<h4 class="font-semibold text-gray-900 truncate">{item.name}</h4>
							<p class="text-sm text-gray-500">{item.sku} · CHF {formatPrice(item.pricePerUnit)}/{item.unit}</p>
						</div>
						<button
							type="button"
							class="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
							onclick={() => cart.removeItem(item.productId)}
							aria-label="Remove item"
						>
							<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
							</svg>
						</button>
					</div>

					<!-- Row 2: Quantity controls and Total price -->
					<div class="flex items-center justify-between gap-4">
						<div class="flex items-center gap-2">
							<button
								type="button"
								class="w-12 h-12 rounded-xl bg-gray-100 text-gray-700 font-bold text-xl hover:bg-gray-200 active:scale-95 transition-all flex items-center justify-center"
								onclick={() => cart.updateQuantity(item.productId, item.quantity - 1)}
							>
								-
							</button>
							<span class="w-14 text-center text-xl font-bold text-gray-900">{item.quantity}</span>
							<button
								type="button"
								class="w-12 h-12 rounded-xl bg-gray-100 text-gray-700 font-bold text-xl hover:bg-gray-200 active:scale-95 transition-all flex items-center justify-center"
								onclick={() => cart.updateQuantity(item.productId, item.quantity + 1)}
							>
								+
							</button>
						</div>
						<div class="text-right">
							<p class="text-xl font-bold text-gray-900">
								CHF {formatPrice(item.pricePerUnit * item.quantity)}
							</p>
						</div>
					</div>
				</div>
			{/each}
		</div>

		<!-- Total -->
		<div class="bg-white rounded-lg shadow p-4">
			<div class="flex justify-between items-center text-lg">
				<span class="font-medium">Total:</span>
				<span class="font-bold text-blue-600">CHF {formatPrice(getTotal())}</span>
			</div>
		</div>

		<!-- Large Order Warning (Misuse Prevention) -->
		{#if getTotal() > 50000}
			<div class="bg-orange-50 border border-orange-200 rounded-lg p-4">
				<div class="flex items-start gap-3">
					<svg class="w-6 h-6 text-orange-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
					</svg>
					<div>
						<p class="text-orange-800 font-medium">This is a larger order</p>
						<p class="text-orange-700 text-sm mt-1">
							This tool is for everyday site supplies. For big project materials
							(steel, concrete, windows, equipment), please contact your project manager.
						</p>
					</div>
				</div>
			</div>
		{/if}

		<!-- Priority and Notes Section -->
		<div class="bg-white rounded-lg shadow p-4 space-y-4">
			<!-- Priority Toggle -->
			<div class="flex items-center justify-between">
				<div>
					<h4 class="font-medium text-gray-900">Priority</h4>
					<p class="text-sm text-gray-500">Mark as urgent for faster processing</p>
				</div>
				<button
					type="button"
					onclick={togglePriority}
					class="px-4 py-2 rounded-lg font-medium transition-all {cartState.priority === 'urgent'
						? 'bg-red-600 text-white hover:bg-red-700'
						: 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
				>
					{#if cartState.priority === 'urgent'}
						<span class="flex items-center gap-2">
							<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
								<path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
							</svg>
							Urgent
						</span>
					{:else}
						Normal
					{/if}
				</button>
			</div>

			<!-- Order Notes -->
			<div class="border-t pt-4">
				<div class="flex items-center justify-between mb-2">
					<h4 class="font-medium text-gray-900">Delivery Notes</h4>
					{#if !showNoteInput && !cartState.note}
						<button
							type="button"
							onclick={() => (showNoteInput = true)}
							class="text-blue-600 text-sm hover:underline"
						>
							+ Add note
						</button>
					{/if}
				</div>

				{#if showNoteInput}
					<div class="space-y-2">
						<textarea
							bind:value={noteInput}
							placeholder="e.g., Deliver to loading dock, 2nd floor entrance..."
							class="w-full p-3 border border-gray-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
							rows="2"
						></textarea>
						<div class="flex gap-2">
							<button
								type="button"
								onclick={saveNote}
								class="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
							>
								Save
							</button>
							<button
								type="button"
								onclick={() => {
									showNoteInput = false;
									noteInput = cartState.note || '';
								}}
								class="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200"
							>
								Cancel
							</button>
						</div>
					</div>
				{:else if cartState.note}
					<div class="bg-gray-50 p-3 rounded-lg">
						<p class="text-sm text-gray-700">{cartState.note}</p>
						<div class="flex gap-3 mt-2">
							<button
								type="button"
								onclick={() => (showNoteInput = true)}
								class="text-blue-600 text-xs hover:underline"
							>
								Edit
							</button>
							<button
								type="button"
								onclick={clearNote}
								class="text-red-600 text-xs hover:underline"
							>
								Remove
							</button>
						</div>
					</div>
				{:else}
					<p class="text-sm text-gray-400 italic">No delivery notes added</p>
				{/if}
			</div>
		</div>

		<!-- Submit Form -->
		<form onsubmit={handleSubmit}>
			{#if form?.message}
				<p class="text-red-600 text-sm mb-4">{form.message}</p>
			{/if}

			{#if !isOnline}
				<div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
					<p class="text-yellow-800 text-sm">
						You're offline. Your order will be saved and submitted when you reconnect.
					</p>
				</div>
			{/if}

			<button
				type="submit"
				disabled={isSubmitting}
				class="w-full py-4 px-6 rounded-lg font-bold text-lg active:scale-95 transition-all disabled:opacity-50 {isOnline
					? 'bg-green-600 text-white hover:bg-green-700'
					: 'bg-blue-600 text-white hover:bg-blue-700'}"
			>
				{#if isSubmitting}
					{isOnline ? 'Submitting...' : 'Saving...'}
				{:else if !isOnline}
					Save Order for Later
				{:else if isOverThreshold()}
					Submit for Approval
				{:else}
					Place Order
				{/if}
			</button>
		</form>
	{/if}
</div>
