<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Suppliers - ComStruct</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex justify-between items-center">
		<h2 class="text-2xl font-bold text-gray-900">Suppliers</h2>
		<a
			href="/manager/suppliers/new"
			class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
		>
			Add Supplier
		</a>
	</div>

	{#if data.suppliers.length === 0}
		<div class="bg-white rounded-lg shadow p-6 text-center">
			<p class="text-gray-500">No suppliers yet. Add a supplier to start importing products.</p>
		</div>
	{:else}
		<div class="bg-white rounded-lg shadow overflow-hidden">
			<table class="min-w-full divide-y divide-gray-200">
				<thead class="bg-gray-50">
					<tr>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
							Name
						</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
							Contact Email
						</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
							Added
						</th>
					</tr>
				</thead>
				<tbody class="bg-white divide-y divide-gray-200">
					{#each data.suppliers as supplier (supplier.id)}
						<tr class="hover:bg-gray-50">
							<td class="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
								{supplier.name}
							</td>
							<td class="px-6 py-4 whitespace-nowrap text-gray-500">
								{supplier.contactEmail || '-'}
							</td>
							<td class="px-6 py-4 whitespace-nowrap text-gray-500 text-sm">
								{supplier.createdAt.toLocaleDateString()}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
