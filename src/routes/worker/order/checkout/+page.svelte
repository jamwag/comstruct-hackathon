<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';
	import { cart, type CartItem, type CartState } from '$lib/stores/cart';
	import { onDestroy } from 'svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let cartState = $state<CartState>({ items: [], note: null, priority: 'normal' });
	let isSubmitting = $state(false);
	let showNoteInput = $state(false);
	let noteInput = $state('');

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

	// Handle successful submission
	$effect(() => {
		if (form?.success) {
			cart.clear();
		}
	});
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

	{#if form?.success}
		<!-- Success Message -->
		<div class="bg-green-50 border border-green-200 rounded-lg p-6 text-center space-y-4">
			<div class="text-5xl">
				{form.isAutoApproved ? '✅' : '⏳'}
			</div>
			<h3 class="text-xl font-bold text-green-800">
				{form.isAutoApproved ? 'Order Approved!' : 'Order Submitted'}
			</h3>
			<p class="text-green-700">
				{#if form.isAutoApproved}
					Your order for CHF {formatPrice(form.totalCents)} has been automatically approved.
				{:else}
					Your order for CHF {formatPrice(form.totalCents)} is pending manager approval.
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
				<div class="p-4 flex items-center gap-4">
					<div class="flex-1">
						<h4 class="font-medium text-gray-900">{item.name}</h4>
						<p class="text-sm text-gray-500">{item.sku}</p>
						<p class="text-sm text-gray-600">
							CHF {formatPrice(item.pricePerUnit)} x {item.quantity} {item.unit}
						</p>
					</div>
					<div class="text-right">
						<p class="font-bold text-gray-900">
							CHF {formatPrice(item.pricePerUnit * item.quantity)}
						</p>
						<div class="flex items-center gap-2 mt-2">
							<button
								type="button"
								class="w-8 h-8 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200"
								onclick={() => cart.updateQuantity(item.productId, item.quantity - 1)}
							>
								-
							</button>
							<span class="w-8 text-center">{item.quantity}</span>
							<button
								type="button"
								class="w-8 h-8 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200"
								onclick={() => cart.updateQuantity(item.productId, item.quantity + 1)}
							>
								+
							</button>
							<button
								type="button"
								class="ml-2 text-red-600 hover:text-red-800 text-sm"
								onclick={() => cart.removeItem(item.productId)}
							>
								Remove
							</button>
						</div>
					</div>
				</div>
			{/each}
		</div>

		<!-- Total and Threshold Info -->
		<div class="bg-white rounded-lg shadow p-4 space-y-3">
			<div class="flex justify-between items-center text-lg">
				<span class="font-medium">Total:</span>
				<span class="font-bold text-blue-600">CHF {formatPrice(getTotal())}</span>
			</div>

			{#if isOverThreshold()}
				<div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
					<p class="text-yellow-800 text-sm">
						<strong>Note:</strong> Orders over CHF {formatPrice(getThreshold())} require manager approval.
						Your order will be submitted for review.
					</p>
				</div>
			{:else}
				<div class="bg-green-50 border border-green-200 rounded-lg p-3">
					<p class="text-green-800 text-sm">
						<strong>Auto-approved:</strong> Orders under CHF {formatPrice(getThreshold())} are automatically approved.
					</p>
				</div>
			{/if}
		</div>

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
		<form
			method="post"
			action="?/submit"
			use:enhance={() => {
				isSubmitting = true;
				return async ({ update }) => {
					await update();
					isSubmitting = false;
				};
			}}
		>
			<input type="hidden" name="projectId" value={data.project.id} />
			<input type="hidden" name="cart" value={JSON.stringify(cartItems)} />
			<input type="hidden" name="notes" value={cartState.note || ''} />
			<input type="hidden" name="priority" value={cartState.priority} />

			{#if form?.message}
				<p class="text-red-600 text-sm mb-4">{form.message}</p>
			{/if}

			<button
				type="submit"
				disabled={isSubmitting}
				class="w-full bg-green-600 text-white py-4 px-6 rounded-lg font-bold text-lg hover:bg-green-700 active:scale-95 transition-all disabled:opacity-50"
			>
				{#if isSubmitting}
					Submitting...
				{:else if isOverThreshold()}
					Submit for Approval
				{:else}
					Place Order
				{/if}
			</button>
		</form>
	{/if}
</div>
