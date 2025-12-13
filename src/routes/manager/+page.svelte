<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Manager Dashboard - ComStruct</title>
</svelte:head>

<div class="space-y-6">
	<div>
		<h2 class="text-2xl font-bold text-gray-900">Welcome, {data.user.username}!</h2>
		<p class="mt-1 text-gray-600">
			Manage procurement, review orders, and control C-material spending.
		</p>
	</div>

	<div class="grid grid-cols-1 md:grid-cols-3 gap-6">
		<div class="bg-white rounded-lg shadow p-6">
			<div class="text-sm font-medium text-gray-500">Pending Approvals</div>
			<div class="mt-2 text-3xl font-bold text-gray-900">0</div>
		</div>
		<div class="bg-white rounded-lg shadow p-6">
			<div class="text-sm font-medium text-gray-500">Orders This Month</div>
			<div class="mt-2 text-3xl font-bold text-gray-900">0</div>
		</div>
		<div class="bg-white rounded-lg shadow p-6">
			<div class="text-sm font-medium text-gray-500">Total Spend</div>
			<div class="mt-2 text-3xl font-bold text-gray-900">CHF 0</div>
		</div>
	</div>

	<div class="bg-white rounded-lg shadow">
		<div class="px-6 py-4 border-b">
			<h3 class="text-lg font-semibold text-gray-900">Recent Orders</h3>
		</div>
		<div class="p-6">
			<p class="text-gray-500 text-sm">No orders to display yet.</p>
		</div>
	</div>

	<div class="bg-white rounded-lg shadow">
		<div class="px-6 py-4 border-b">
			<h3 class="text-lg font-semibold text-gray-900">About C-Materials</h3>
		</div>
		<div class="p-6">
			<p class="text-gray-700">
				<strong>C-materials</strong> are low-value, high-volume consumables and site supplies that
				represent roughly 5% of spend but 60% of all orders. This includes:
			</p>
			<ul class="mt-3 list-disc list-inside text-gray-600 space-y-1">
				<li>Fasteners: screws, plugs, nails</li>
				<li>Consumables: tapes, foils, sealants, spray cans</li>
				<li>Site supplies: PPE, gloves, masks, batteries</li>
				<li>Small tools: drill bits, blades</li>
			</ul>
			<p class="mt-3 text-gray-700">
				By streamlining C-material ordering, you reduce administrative overhead and give workers a
				simple way to get what they need on site.
			</p>
		</div>
	</div>
</div>
