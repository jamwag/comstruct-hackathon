<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head>
	<title>Edit {data.supplier.name} - ComStruct</title>
</svelte:head>

<div class="max-w-xl">
	<div class="mb-6">
		<a href="/manager/suppliers" class="text-blue-600 hover:underline text-sm"
			>&larr; Back to Suppliers</a
		>
	</div>

	<div class="bg-white rounded-lg shadow p-6">
		<h2 class="text-xl font-bold text-gray-900 mb-6">Edit Supplier</h2>

		<form method="post" action="?/update" use:enhance class="space-y-4">
			<div>
				<label for="name" class="block text-sm font-medium text-gray-700">Supplier Name</label>
				<input
					id="name"
					name="name"
					type="text"
					required
					value={data.supplier.name}
					class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
				/>
			</div>

			<div>
				<label for="contactEmail" class="block text-sm font-medium text-gray-700"
					>Contact Email</label
				>
				<input
					id="contactEmail"
					name="contactEmail"
					type="email"
					value={data.supplier.contactEmail || ''}
					class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
				/>
			</div>

			<div>
				<label for="shopUrl" class="block text-sm font-medium text-gray-700"
					>External Shop URL (PunchOut)</label
				>
				<input
					id="shopUrl"
					name="shopUrl"
					type="url"
					placeholder="https://supplier-shop.example.com"
					value={data.supplier.shopUrl || ''}
					class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
				/>
				<p class="mt-1 text-xs text-gray-500">
					The supplier's external catalog URL. Workers will be redirected here to browse products.
				</p>
			</div>

			{#if form?.message}
				<p class="text-red-600 text-sm">{form.message}</p>
			{/if}

			<div class="flex gap-3 pt-4">
				<button
					type="submit"
					class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
				>
					Save Changes
				</button>
				<a
					href="/manager/suppliers"
					class="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
				>
					Cancel
				</a>
			</div>
		</form>
	</div>
</div>
