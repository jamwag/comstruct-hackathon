<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let selectedFile = $state<File | null>(null);
	let selectedSupplierId = $state('');
	let step = $state<'upload' | 'mapping' | 'done'>('upload');

	// Column mappings
	let skuColumn = $state('');
	let nameColumn = $state('');
	let descriptionColumn = $state('');
	let unitColumn = $state('');
	let priceColumn = $state('');
	let categoryId = $state('');

	// Auto-detect columns when preview is loaded
	$effect(() => {
		if (form?.headers) {
			const headers = form.headers as string[];
			// Try to auto-detect common column names
			skuColumn = headers.find(h => /sku|artikelnr|article|item/i.test(h)) || '';
			nameColumn = headers.find(h => /name|bezeichnung|description|title/i.test(h)) || '';
			descriptionColumn = headers.find(h => /desc|beschreibung|details/i.test(h)) || '';
			unitColumn = headers.find(h => /unit|einheit|me|uom/i.test(h)) || '';
			priceColumn = headers.find(h => /price|preis|cost|betrag/i.test(h)) || '';
			step = 'mapping';
		}
	});

	$effect(() => {
		if (form?.imported !== undefined) {
			step = 'done';
		}
	});

	function handleFileChange(event: Event) {
		const input = event.target as HTMLInputElement;
		selectedFile = input.files?.[0] || null;
	}

	function resetForm() {
		selectedFile = null;
		selectedSupplierId = '';
		step = 'upload';
		skuColumn = '';
		nameColumn = '';
		descriptionColumn = '';
		unitColumn = '';
		priceColumn = '';
		categoryId = '';
	}
</script>

<svelte:head>
	<title>Import Products - ComStruct</title>
</svelte:head>

<div class="max-w-3xl">
	<div class="mb-6">
		<a href="/manager/products" class="text-blue-600 hover:underline text-sm">&larr; Back to Products</a>
	</div>

	<div class="bg-white rounded-lg shadow p-6">
		<h2 class="text-xl font-bold text-gray-900 mb-6">Import Products from Excel</h2>

		{#if step === 'upload'}
			{#if data.suppliers.length === 0}
				<div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
					<p class="text-yellow-800">
						You need to <a href="/manager/suppliers/new" class="underline font-medium">add a supplier</a> first.
					</p>
				</div>
			{:else}
				<form method="post" action="?/preview" enctype="multipart/form-data" use:enhance class="space-y-4">
					<div>
						<label for="supplierId" class="block text-sm font-medium text-gray-700">Supplier</label>
						<select
							id="supplierId"
							name="supplierId"
							required
							bind:value={selectedSupplierId}
							class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
						>
							<option value="">Select a supplier...</option>
							{#each data.suppliers as supplier (supplier.id)}
								<option value={supplier.id}>{supplier.name}</option>
							{/each}
						</select>
					</div>

					<div>
						<label for="file" class="block text-sm font-medium text-gray-700">Excel File (.xlsx, .csv)</label>
						<input
							id="file"
							name="file"
							type="file"
							required
							accept=".xlsx,.xls,.csv"
							onchange={handleFileChange}
							class="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
						/>
					</div>

					{#if form?.message}
						<p class="text-red-600 text-sm">{form.message}</p>
					{/if}

					<button
						type="submit"
						disabled={!selectedFile || !selectedSupplierId}
						class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
					>
						Preview Data
					</button>
				</form>
			{/if}

		{:else if step === 'mapping' && form?.headers}
			<div class="space-y-6">
				<div class="bg-gray-50 rounded-lg p-4">
					<p class="text-sm text-gray-600">
						Found <strong>{form.totalRows}</strong> rows. Map the columns below and import.
					</p>
				</div>

				<form method="post" action="?/import" enctype="multipart/form-data" use:enhance class="space-y-4">
					<input type="hidden" name="supplierId" value={form.supplierId} />

					<!-- Re-upload file for import -->
					<div>
						<label for="file2" class="block text-sm font-medium text-gray-700">Re-select the same file</label>
						<input
							id="file2"
							name="file"
							type="file"
							required
							accept=".xlsx,.xls,.csv"
							class="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
						/>
					</div>

					<div class="grid grid-cols-2 gap-4">
						<div>
							<label for="skuColumn" class="block text-sm font-medium text-gray-700">SKU Column *</label>
							<select id="skuColumn" name="skuColumn" required bind:value={skuColumn} class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2">
								<option value="">Select...</option>
								{#each form.headers as header}
									<option value={header}>{header}</option>
								{/each}
							</select>
						</div>

						<div>
							<label for="nameColumn" class="block text-sm font-medium text-gray-700">Name Column *</label>
							<select id="nameColumn" name="nameColumn" required bind:value={nameColumn} class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2">
								<option value="">Select...</option>
								{#each form.headers as header}
									<option value={header}>{header}</option>
								{/each}
							</select>
						</div>

						<div>
							<label for="priceColumn" class="block text-sm font-medium text-gray-700">Price Column *</label>
							<select id="priceColumn" name="priceColumn" required bind:value={priceColumn} class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2">
								<option value="">Select...</option>
								{#each form.headers as header}
									<option value={header}>{header}</option>
								{/each}
							</select>
						</div>

						<div>
							<label for="unitColumn" class="block text-sm font-medium text-gray-700">Unit Column</label>
							<select id="unitColumn" name="unitColumn" bind:value={unitColumn} class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2">
								<option value="">None (default: piece)</option>
								{#each form.headers as header}
									<option value={header}>{header}</option>
								{/each}
							</select>
						</div>

						<div>
							<label for="descriptionColumn" class="block text-sm font-medium text-gray-700">Description Column</label>
							<select id="descriptionColumn" name="descriptionColumn" bind:value={descriptionColumn} class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2">
								<option value="">None</option>
								{#each form.headers as header}
									<option value={header}>{header}</option>
								{/each}
							</select>
						</div>

						<div>
							<label for="categoryId" class="block text-sm font-medium text-gray-700">Category (all products)</label>
							<select id="categoryId" name="categoryId" bind:value={categoryId} class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2">
								<option value="">None</option>
								{#each data.categories as category (category.id)}
									<option value={category.id}>{category.name}</option>
								{/each}
							</select>
						</div>
					</div>

					<!-- Preview table -->
					<div class="overflow-x-auto">
						<p class="text-sm text-gray-500 mb-2">Preview (first 10 rows):</p>
						<table class="min-w-full text-xs border">
							<thead class="bg-gray-100">
								<tr>
									{#each form.headers as header}
										<th class="px-2 py-1 text-left border">{header}</th>
									{/each}
								</tr>
							</thead>
							<tbody>
								{#each form.preview as row, i (i)}
									<tr>
										{#each form.headers as header}
											<td class="px-2 py-1 border">{row[header] ?? ''}</td>
										{/each}
									</tr>
								{/each}
							</tbody>
						</table>
					</div>

					{#if form?.message}
						<p class="text-red-600 text-sm">{form.message}</p>
					{/if}

					<div class="flex gap-3">
						<button
							type="submit"
							class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
						>
							Import {form.totalRows} Products
						</button>
						<button
							type="button"
							onclick={resetForm}
							class="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
						>
							Start Over
						</button>
					</div>
				</form>
			</div>

		{:else if step === 'done'}
			<div class="text-center space-y-4">
				<div class="text-green-600 text-5xl">&#10003;</div>
				<h3 class="text-lg font-semibold text-gray-900">Import Complete</h3>
				<p class="text-gray-600">
					Imported <strong>{form?.imported}</strong> products.
					{#if form?.skipped && form.skipped > 0}
						<span class="text-yellow-600">({form.skipped} rows skipped due to missing data)</span>
					{/if}
				</p>
				<div class="flex justify-center gap-3">
					<a
						href="/manager/products"
						class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
					>
						View Products
					</a>
					<button
						type="button"
						onclick={resetForm}
						class="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
					>
						Import More
					</button>
				</div>
			</div>
		{/if}
	</div>
</div>
