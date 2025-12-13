<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	function formatPrice(cents: number): string {
		return (cents / 100).toFixed(2);
	}
</script>

<svelte:head>
	<title>{data.product.name} - ComStruct</title>
</svelte:head>

<div class="space-y-6">
	<div class="mb-6">
		<a href="/manager/products" class="text-blue-600 hover:underline text-sm">&larr; Back to Products</a>
	</div>

	<div class="bg-white rounded-lg shadow p-6">
		<h2 class="text-2xl font-bold text-gray-900 mb-4">{data.product.name}</h2>

		<div class="grid grid-cols-2 gap-4 text-sm">
			<div>
				<span class="text-gray-500">SKU:</span>
				<span class="ml-2 font-mono">{data.product.sku}</span>
			</div>
			<div>
				<span class="text-gray-500">Price:</span>
				<span class="ml-2 font-medium">CHF {formatPrice(data.product.pricePerUnit)} / {data.product.unit}</span>
			</div>
			<div>
				<span class="text-gray-500">Supplier:</span>
				<span class="ml-2">{data.supplier?.name || '-'}</span>
			</div>
			<div>
				<span class="text-gray-500">Category:</span>
				<span class="ml-2">{data.category?.name || '-'}</span>
			</div>
			{#if data.product.description}
				<div class="col-span-2">
					<span class="text-gray-500">Description:</span>
					<p class="mt-1 text-gray-700">{data.product.description}</p>
				</div>
			{/if}
		</div>
	</div>

	<div class="bg-white rounded-lg shadow p-6">
		<h3 class="text-lg font-semibold text-gray-900 mb-4">Material Classification</h3>

		<div class="mb-4 p-4 bg-gray-50 rounded-lg">
			<p class="text-sm text-gray-600">
				<strong>C-Materials</strong> are low-value consumables and site supplies that workers can order through the simplified ordering flow.
			</p>
			<p class="text-sm text-gray-600 mt-2">
				<strong>A-Materials</strong> are high-value, project-critical items that should be ordered through the main procurement workflow. They will not appear in the worker ordering interface.
			</p>
		</div>

		<form method="post" action="?/updateMaterialType" use:enhance class="space-y-4">
			<div>
				<label class="block text-sm font-medium text-gray-700 mb-2">Material Type</label>
				<div class="flex gap-4">
					<label class="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 {data.product.materialType === 'c_material' ? 'border-green-500 bg-green-50' : 'border-gray-300'}">
						<input
							type="radio"
							name="materialType"
							value="c_material"
							checked={data.product.materialType === 'c_material'}
							class="text-green-600 focus:ring-green-500"
						/>
						<div>
							<span class="font-medium text-gray-900">C-Material</span>
							<p class="text-xs text-gray-500">Available for worker ordering</p>
						</div>
					</label>
					<label class="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 {data.product.materialType === 'a_material' ? 'border-orange-500 bg-orange-50' : 'border-gray-300'}">
						<input
							type="radio"
							name="materialType"
							value="a_material"
							checked={data.product.materialType === 'a_material'}
							class="text-orange-600 focus:ring-orange-500"
						/>
						<div>
							<span class="font-medium text-gray-900">A-Material</span>
							<p class="text-xs text-gray-500">Main procurement workflow only</p>
						</div>
					</label>
				</div>
			</div>

			<button
				type="submit"
				class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
			>
				Save Classification
			</button>

			{#if form?.success}
				<p class="text-sm text-green-600">Material type updated successfully.</p>
			{/if}
			{#if form?.message}
				<p class="text-sm text-red-600">{form.message}</p>
			{/if}
		</form>
	</div>
</div>
