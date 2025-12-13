<script lang="ts">
	import { page } from '$app/stores';

	// Derive active state from current pathname
	const isOrdersActive = $derived(
		$page.url.pathname === '/worker' || $page.url.pathname.startsWith('/worker/order')
	);
	const isHistoryActive = $derived($page.url.pathname === '/worker/history');
</script>

<nav
	class="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50"
	style="padding-bottom: env(safe-area-inset-bottom, 0px);"
>
	<div class="flex justify-around items-center h-16">
		<!-- Purchasing/Orders -->
		<a
			href="/worker"
			class="flex flex-col items-center justify-center flex-1 h-full transition-colors {isOrdersActive
				? 'text-blue-600'
				: 'text-gray-500'}"
		>
			<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
				/>
			</svg>
			<span class="text-xs mt-1 font-medium">Purchasing</span>
		</a>

		<!-- Order History -->
		<a
			href="/worker/history"
			class="flex flex-col items-center justify-center flex-1 h-full transition-colors {isHistoryActive
				? 'text-blue-600'
				: 'text-gray-500'}"
		>
			<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
				/>
			</svg>
			<span class="text-xs mt-1 font-medium">History</span>
		</a>
	</div>
</nav>
