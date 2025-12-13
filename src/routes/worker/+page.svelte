<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Worker Dashboard - ComStruct</title>
</svelte:head>

<div class="space-y-6">
	<div class="bg-white rounded-lg shadow p-6">
		<h2 class="text-2xl font-bold text-gray-900">Welcome, {data.user.username}!</h2>
		<p class="mt-2 text-gray-600">
			This is your worker dashboard. Order site supplies and consumables quickly from here.
		</p>
	</div>

	<div class="bg-white rounded-lg shadow p-6">
		<h3 class="text-lg font-semibold text-gray-900 mb-4">Recent Orders</h3>
		<p class="text-gray-500 text-sm">No orders yet.</p>
	</div>
</div>
