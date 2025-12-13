<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import type { PageData } from './$types';
	import { managerSelectedProjectId } from '$lib/stores/managerSelectedProject';

	let { data }: { data: PageData } = $props();

	let showCMaterialInfo = $state(false);
	let popoverRef = $state<HTMLDivElement | null>(null);

	// Sync URL with store on mount
	onMount(() => {
		const urlProjectId = $page.url.searchParams.get('project');
		const storeProjectId = $managerSelectedProjectId;

		if (urlProjectId && urlProjectId !== storeProjectId) {
			// URL has a project, update store
			managerSelectedProjectId.set(urlProjectId);
		} else if (storeProjectId && !urlProjectId) {
			// Store has project but URL doesn't, update URL
			const url = new URL($page.url);
			url.searchParams.set('project', storeProjectId);
			goto(url.toString(), { replaceState: true, keepFocus: true });
		}

		// Close popover on click outside
		function handleClickOutside(event: MouseEvent) {
			if (popoverRef && !popoverRef.contains(event.target as Node)) {
				showCMaterialInfo = false;
			}
		}
		document.addEventListener('click', handleClickOutside);
		return () => document.removeEventListener('click', handleClickOutside);
	});

	function formatPrice(cents: number): string {
		return (cents / 100).toFixed(2);
	}

	function formatDate(date: Date): string {
		return new Date(date).toLocaleDateString('de-CH', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function getStatusColor(status: string): string {
		switch (status) {
			case 'approved':
				return 'bg-green-100 text-green-800';
			case 'pending':
				return 'bg-yellow-100 text-yellow-800';
			case 'rejected':
				return 'bg-red-100 text-red-800';
			default:
				return 'bg-gray-100 text-gray-800';
		}
	}
</script>

<svelte:head>
	<title>Manager Dashboard - ComStruct</title>
</svelte:head>

<div class="space-y-6">
	<div>
		<h2 class="text-2xl font-bold text-gray-900">Welcome, {data.user.username}!</h2>
		<p class="mt-1 text-gray-600">
			Manage procurement, review orders, and control
			<span class="relative inline-block" bind:this={popoverRef}>
				<button
					type="button"
					class="text-blue-600 hover:text-blue-800 underline decoration-dotted underline-offset-2 cursor-pointer"
					onclick={(e) => {
						e.stopPropagation();
						showCMaterialInfo = !showCMaterialInfo;
					}}
				>
					C-material
				</button>
				{#if showCMaterialInfo}
					<div
						class="absolute left-0 top-full mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 p-4 z-50"
					>
						<div class="flex justify-between items-start mb-2">
							<h4 class="font-semibold text-gray-900">About C-Materials</h4>
							<button
								type="button"
								class="text-gray-400 hover:text-gray-600"
								onclick={() => (showCMaterialInfo = false)}
							>
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
								</svg>
							</button>
						</div>
						<p class="text-sm text-gray-700">
							<strong>C-materials</strong> are low-value, high-volume consumables and site supplies that
							represent roughly 5% of spend but 60% of all orders.
						</p>
						<ul class="mt-2 text-sm text-gray-600 space-y-1">
							<li>Fasteners: screws, plugs, nails</li>
							<li>Consumables: tapes, foils, sealants</li>
							<li>Site supplies: PPE, gloves, masks</li>
							<li>Small tools: drill bits, blades</li>
						</ul>
						<p class="mt-2 text-sm text-gray-700">
							Streamlining C-material ordering reduces administrative overhead.
						</p>
					</div>
				{/if}
			</span>
			spending.
		</p>
	</div>

	<!-- Spending Analytics -->
	<div class="grid grid-cols-1 md:grid-cols-4 gap-4">
		<div class="bg-white rounded-lg shadow p-5">
			<div class="flex items-center gap-3">
				<div class="p-2 bg-green-100 rounded-lg">
					<svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
				</div>
				<div>
					<div class="text-sm font-medium text-gray-500">Total Approved</div>
					<div class="text-2xl font-bold text-gray-900">CHF {formatPrice(data.analytics.totalApprovedSpend)}</div>
				</div>
			</div>
		</div>

		<div class="bg-white rounded-lg shadow p-5">
			<div class="flex items-center gap-3">
				<div class="p-2 bg-yellow-100 rounded-lg">
					<svg class="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
				</div>
				<div>
					<div class="text-sm font-medium text-gray-500">Pending Review</div>
					<div class="text-2xl font-bold text-gray-900">{data.analytics.pendingOrdersCount}</div>
					{#if data.analytics.pendingOrdersValue > 0}
						<div class="text-xs text-gray-500">CHF {formatPrice(data.analytics.pendingOrdersValue)}</div>
					{/if}
				</div>
			</div>
		</div>

		<div class="bg-white rounded-lg shadow p-5">
			<div class="flex items-center gap-3">
				<div class="p-2 bg-blue-100 rounded-lg">
					<svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
					</svg>
				</div>
				<div>
					<div class="text-sm font-medium text-gray-500">Total Orders</div>
					<div class="text-2xl font-bold text-gray-900">{data.analytics.totalOrdersCount}</div>
				</div>
			</div>
		</div>

		<a href="/manager/orders?status=pending{data.projectId ? `&project=${data.projectId}` : ''}" class="bg-white rounded-lg shadow p-5 hover:shadow-md transition-shadow">
			<div class="flex items-center gap-3">
				<div class="p-2 bg-purple-100 rounded-lg">
					<svg class="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
					</svg>
				</div>
				<div>
					<div class="text-sm font-medium text-gray-500">Review Orders</div>
					<div class="text-sm text-purple-600 font-medium">View pending &rarr;</div>
				</div>
			</div>
		</a>
	</div>

	<!-- Resource Counts -->
	<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
		<a href="/manager/suppliers" class="bg-white rounded-lg shadow p-5 hover:shadow-md transition-shadow">
			<div class="text-sm font-medium text-gray-500">Suppliers</div>
			<div class="mt-1 text-2xl font-bold text-gray-900">{data.counts.suppliers}</div>
		</a>
		<a href="/manager/products" class="bg-white rounded-lg shadow p-5 hover:shadow-md transition-shadow">
			<div class="text-sm font-medium text-gray-500">Products</div>
			<div class="mt-1 text-2xl font-bold text-gray-900">{data.counts.products}</div>
		</a>
	</div>

	<!-- Recent Orders -->
	<div class="bg-white rounded-lg shadow">
		<div class="px-6 py-4 border-b flex justify-between items-center">
			<h3 class="text-lg font-semibold text-gray-900">Recent Orders</h3>
			<a href="/manager/orders?status=all{data.projectId ? `&project=${data.projectId}` : ''}" class="text-sm text-blue-600 hover:underline">View all &rarr;</a>
		</div>
		{#if data.recentOrders.length === 0}
			<div class="p-6">
				<p class="text-gray-500 text-sm text-center">No orders yet. Orders will appear here once workers place them.</p>
			</div>
		{:else}
			<div class="overflow-x-auto">
				<table class="w-full">
					<thead class="bg-gray-50">
						<tr>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order</th>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Project</th>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Worker</th>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
							<th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
							<th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-200">
						{#each data.recentOrders as order (order.id)}
							<tr class="hover:bg-gray-50">
								<td class="px-6 py-4 whitespace-nowrap">
									<div class="flex items-center gap-2">
										<span class="font-medium text-gray-900">{order.orderNumber}</span>
										{#if order.priority === 'urgent'}
											<span class="px-1.5 py-0.5 text-xs bg-red-100 text-red-700 rounded">Urgent</span>
										{/if}
									</div>
								</td>
								<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{order.projectName}</td>
								<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{order.workerName}</td>
								<td class="px-6 py-4 whitespace-nowrap">
									<span class="px-2 py-1 text-xs font-medium rounded-full {getStatusColor(order.status)}">
										{order.status}
									</span>
								</td>
								<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium">
									CHF {formatPrice(order.totalCents)}
								</td>
								<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
									{formatDate(order.createdAt)}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>
</div>
