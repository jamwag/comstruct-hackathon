<script lang="ts">
	import type { PageData } from './$types';
	import VoiceMicButton from '$lib/components/voice/VoiceMicButton.svelte';

	let { data }: { data: PageData } = $props();

	// Selected project for voice ordering (default to first project)
	let selectedProjectId = $state<string | null>(data.projects.length > 0 ? data.projects[0].id : null);

	function formatPrice(cents: number): string {
		return (cents / 100).toFixed(2);
	}

	function formatDate(date: Date): string {
		return new Date(date).toLocaleDateString('en-CH', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric'
		});
	}

	function getStatusColor(status: string): string {
		switch (status) {
			case 'approved':
				return 'bg-green-100 text-green-800';
			case 'rejected':
				return 'bg-red-100 text-red-800';
			default:
				return 'bg-yellow-100 text-yellow-800';
		}
	}

	// Get selected project name for display
	const selectedProject = $derived(data.projects.find((p) => p.id === selectedProjectId));
</script>

<svelte:head>
	<title>Worker Dashboard - ComStruct</title>
</svelte:head>

<div class="space-y-6">
	<!-- Voice Ordering Section - Main Feature -->
	{#if data.projects.length > 0}
		<div class="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg shadow-lg p-6 border border-blue-100">
			<div class="text-center mb-4">
				<h2 class="text-2xl font-bold text-gray-900">Quick Voice Order</h2>
				<p class="mt-1 text-gray-600">
					Tap the mic and tell me what you need
				</p>
			</div>

			<!-- Project selector (if multiple projects) -->
			{#if data.projects.length > 1}
				<div class="mb-4">
					<label for="voice-project" class="block text-sm font-medium text-gray-700 mb-1">
						Order for project:
					</label>
					<select
						id="voice-project"
						bind:value={selectedProjectId}
						class="w-full px-3 py-2 border border-gray-300 rounded-lg text-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
					>
						{#each data.projects as project (project.id)}
							<option value={project.id}>{project.name}</option>
						{/each}
					</select>
				</div>
			{:else if selectedProject}
				<p class="text-center text-sm text-gray-500 mb-4">
					Ordering for: <span class="font-medium">{selectedProject.name}</span>
				</p>
			{/if}

			<!-- Voice mic button -->
			<VoiceMicButton projectId={selectedProjectId} />

			<!-- Alternative: Browse catalog -->
			<div class="mt-6 pt-4 border-t border-blue-200 text-center">
				<span class="text-gray-500 text-sm">or</span>
				<a
					href="/worker/order{selectedProjectId ? `?project=${selectedProjectId}` : ''}"
					class="ml-2 text-blue-600 hover:text-blue-800 font-medium"
				>
					Browse the catalog
				</a>
			</div>
		</div>
	{/if}

	<!-- Welcome card -->
	<div class="bg-white rounded-lg shadow p-6">
		<h2 class="text-2xl font-bold text-gray-900">Welcome, {data.user.username}!</h2>
		<p class="mt-2 text-gray-600">
			Order site supplies and consumables quickly from here.
		</p>
		{#if data.projects.length > 0}
			<a
				href="/worker/order"
				class="mt-4 inline-block bg-blue-600 text-white py-3 px-6 rounded-lg font-bold text-lg hover:bg-blue-700 active:scale-95 transition-all"
			>
				Browse All Products
			</a>
		{:else}
			<div class="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
				<p class="text-yellow-800">You are not assigned to any project yet. Please contact your manager.</p>
			</div>
		{/if}
	</div>

	{#if data.projects.length > 0}
		<div class="bg-white rounded-lg shadow p-6">
			<h3 class="text-lg font-semibold text-gray-900 mb-4">Your Projects</h3>
			<div class="space-y-2">
				{#each data.projects as project (project.id)}
					<div class="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-md">
						<div>
							<span class="font-medium text-gray-900">{project.name}</span>
							{#if project.address}
								<span class="text-sm text-gray-500 ml-2">{project.address}</span>
							{/if}
						</div>
						<a
							href="/worker/order?project={project.id}"
							class="text-sm px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
						>
							Order
						</a>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<div class="bg-white rounded-lg shadow p-6">
		<h3 class="text-lg font-semibold text-gray-900 mb-4">Recent Orders</h3>
		{#if data.recentOrders.length === 0}
			<p class="text-gray-500 text-sm">No orders yet.</p>
		{:else}
			<div class="space-y-3">
				{#each data.recentOrders as { order, project } (order.id)}
					<div class="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-md">
						<div>
							<div class="flex items-center gap-2">
								<span class="font-medium text-gray-900">{project.name}</span>
								<span class="px-2 py-0.5 rounded text-xs font-medium {getStatusColor(order.status)}">
									{order.status}
								</span>
							</div>
							<p class="text-sm text-gray-500">{formatDate(order.createdAt)}</p>
						</div>
						<div class="text-right">
							<p class="font-bold text-gray-900">CHF {formatPrice(order.totalCents)}</p>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
