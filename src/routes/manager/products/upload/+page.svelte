<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let selectedFile = $state<File | null>(null);
	let selectedSupplierId = $state('');
	let step = $state<'upload' | 'mapping' | 'pdf-preview' | 'done'>('upload');
	let isClassifying = $state(false);
	let classificationResult = $state<{ classified: number; total: number } | null>(null);

	// Column mappings - required
	let skuColumn = $state('');
	let nameColumn = $state('');
	let descriptionColumn = $state('');
	let unitColumn = $state('');
	let priceColumn = $state('');
	let categoryId = $state('');

	// Extended field mappings
	let manufacturerColumn = $state('');
	let packagingUnitColumn = $state('');
	let hazardousColumn = $state('');
	let consumableTypeColumn = $state('');
	let minOrderQtyColumn = $state('');
	let supplierSkuColumn = $state('');

	// Track imported product IDs for classification
	let importedProductIds = $state<string[]>([]);

	// AI mappings display
	let showAiSuggestions = $state(true);

	// Apply AI suggestions when preview is loaded (Excel/CSV flow)
	$effect(() => {
		if (form?.headers && form?.isPdf === false) {
			const headers = form.headers as string[];
			const suggestions = form.suggestedMappings || [];

			// Apply AI suggestions if available, otherwise use regex fallback
			const findSuggestion = (field: string) =>
				suggestions.find((s: { targetField: string }) => s.targetField === field)?.sourceColumn;

			skuColumn =
				findSuggestion('sku') ||
				findSuggestion('supplierSku') ||
				headers.find((h) => /sku|artikelnr|artikel_id|article|item/i.test(h)) ||
				'';
			nameColumn =
				findSuggestion('name') ||
				headers.find((h) => /name|bezeichnung|artikelname|title/i.test(h)) ||
				'';
			descriptionColumn =
				findSuggestion('description') ||
				headers.find((h) => /desc|beschreibung|details/i.test(h)) ||
				'';
			unitColumn =
				findSuggestion('unit') ||
				headers.find((h) => /unit|einheit|me|uom/i.test(h)) ||
				'';
			priceColumn =
				findSuggestion('pricePerUnit') ||
				headers.find((h) => /price|preis|cost|betrag/i.test(h)) ||
				'';

			// Extended fields from AI
			manufacturerColumn =
				findSuggestion('manufacturer') ||
				headers.find((h) => /hersteller|manufacturer|marke|brand/i.test(h)) ||
				'';
			packagingUnitColumn =
				findSuggestion('packagingUnit') ||
				headers.find((h) => /packag|verpackung/i.test(h)) ||
				'';
			hazardousColumn =
				findSuggestion('hazardous') ||
				headers.find((h) => /hazard|gefahrgut|gefahr/i.test(h)) ||
				'';
			consumableTypeColumn =
				findSuggestion('consumableType') ||
				headers.find((h) => /verbrauch|consumable|einweg|mehrweg/i.test(h)) ||
				'';
			minOrderQtyColumn =
				findSuggestion('minOrderQty') ||
				headers.find((h) => /min.*qty|mindest/i.test(h)) ||
				'';
			supplierSkuColumn =
				findSuggestion('supplierSku') || headers.find((h) => /lieferant.*sku|supplier.*id/i.test(h)) || '';

			step = 'mapping';
		}
	});

	// Handle PDF preview
	$effect(() => {
		if (form?.isPdf === true && form?.pdfProducts) {
			step = 'pdf-preview';
		}
	});

	$effect(() => {
		if (form?.imported !== undefined) {
			step = 'done';
			if (form.importedProductIds) {
				importedProductIds = form.importedProductIds;
			}
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
		manufacturerColumn = '';
		packagingUnitColumn = '';
		hazardousColumn = '';
		consumableTypeColumn = '';
		minOrderQtyColumn = '';
		supplierSkuColumn = '';
		importedProductIds = [];
		classificationResult = null;
	}

	async function classifyProducts() {
		if (importedProductIds.length === 0) return;

		isClassifying = true;
		try {
			const formData = new FormData();
			formData.append('productIds', JSON.stringify(importedProductIds));

			const response = await fetch('?/classifyBatch', {
				method: 'POST',
				body: formData
			});

			const result = await response.json();
			if (result.data) {
				classificationResult = {
					classified: result.data.classified,
					total: result.data.total
				};
			}
		} catch (err) {
			console.error('Classification error:', err);
		} finally {
			isClassifying = false;
		}
	}

	function getConfidenceColor(confidence: number): string {
		if (confidence >= 0.8) return 'bg-green-100 text-green-800';
		if (confidence >= 0.5) return 'bg-yellow-100 text-yellow-800';
		return 'bg-gray-100 text-gray-800';
	}

	function formatPrice(cents: number): string {
		return (cents / 100).toFixed(2);
	}

	// Get main categories only (no parent)
	const mainCategories = $derived(data.categories.filter((c) => !c.parentId));
</script>

<svelte:head>
	<title>Import Products - ComStruct</title>
</svelte:head>

<div class="max-w-4xl">
	<div class="mb-6">
		<a href="/manager/products" class="text-blue-600 hover:underline text-sm">&larr; Back to Products</a>
	</div>

	<div class="bg-white rounded-lg shadow p-6">
		<h2 class="text-xl font-bold text-gray-900 mb-6">Import Products</h2>

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
						<label for="file" class="block text-sm font-medium text-gray-700">File (Excel, CSV, or PDF)</label>
						<input
							id="file"
							name="file"
							type="file"
							required
							accept=".xlsx,.xls,.csv,.pdf"
							onchange={handleFileChange}
							class="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
						/>
						<p class="mt-1 text-xs text-gray-500">PDFs will be processed with AI to extract product data</p>
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

		{:else if step === 'pdf-preview' && form?.pdfProducts}
			<div class="space-y-6">
				<!-- PDF AI Banner -->
				<div class="bg-purple-50 border border-purple-200 rounded-lg p-4">
					<div class="flex items-center gap-2">
						<svg class="w-5 h-5 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
							<path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/>
							<path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd"/>
						</svg>
						<span class="font-medium text-purple-800">AI Extracted from PDF</span>
						{#if form.confidence}
							<span class="text-xs px-2 py-0.5 rounded {getConfidenceColor(form.confidence)}">
								{Math.round(form.confidence * 100)}% confidence
							</span>
						{/if}
					</div>
					{#if form.supplierName}
						<p class="text-sm text-purple-700 mt-1">Detected supplier: {form.supplierName}</p>
					{/if}
				</div>

				<div class="bg-gray-50 rounded-lg p-4">
					<p class="text-sm text-gray-600">
						Found <strong>{form.totalRows}</strong> products. Review and import.
					</p>
				</div>

				<!-- Extracted products table -->
				<div class="overflow-x-auto">
					<table class="min-w-full text-sm border">
						<thead class="bg-gray-100">
							<tr>
								<th class="px-3 py-2 text-left border">SKU</th>
								<th class="px-3 py-2 text-left border">Name</th>
								<th class="px-3 py-2 text-left border">Unit</th>
								<th class="px-3 py-2 text-right border">Price</th>
							</tr>
						</thead>
						<tbody>
							{#each form.pdfProducts as product, i (i)}
								<tr class="hover:bg-gray-50">
									<td class="px-3 py-2 border font-mono text-gray-500">{product.sku}</td>
									<td class="px-3 py-2 border">{product.name}</td>
									<td class="px-3 py-2 border">{product.unit}</td>
									<td class="px-3 py-2 border text-right">CHF {formatPrice(product.pricePerUnit)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				<form method="post" action="?/importPdf" use:enhance class="space-y-4">
					<input type="hidden" name="supplierId" value={form.supplierId} />
					<input type="hidden" name="products" value={JSON.stringify(form.pdfProducts)} />

					<div>
						<label for="pdfCategoryId" class="block text-sm font-medium text-gray-700">Category (all products)</label>
						<select id="pdfCategoryId" name="categoryId" bind:value={categoryId} class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2">
							<option value="">None (use AI classification later)</option>
							{#each mainCategories as category (category.id)}
								<option value={category.id}>{category.name}</option>
							{/each}
						</select>
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

		{:else if step === 'mapping' && form?.headers}
			<div class="space-y-6">
				<div class="bg-gray-50 rounded-lg p-4">
					<p class="text-sm text-gray-600">
						Found <strong>{form.totalRows}</strong> rows. Map the columns below and import.
					</p>
				</div>

				<!-- AI Suggestions Banner -->
				{#if form.suggestedMappings && form.suggestedMappings.length > 0 && showAiSuggestions}
					<div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
						<div class="flex items-start justify-between">
							<div>
								<h4 class="font-medium text-blue-800 flex items-center gap-2">
									<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
										<path d="M10 18a8 8 0 100-16 8 8 0 000 16zm0-2a6 6 0 100-12 6 6 0 000 12z"/>
										<path d="M10 6a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V7a1 1 0 011-1z"/>
									</svg>
									AI Detected Column Mappings
								</h4>
								<div class="mt-2 flex flex-wrap gap-2">
									{#each form.suggestedMappings as mapping}
										<span class="inline-flex items-center gap-1 px-2 py-1 rounded text-xs {getConfidenceColor(mapping.confidence)}">
											{mapping.sourceColumn} &rarr; {mapping.targetField}
											<span class="opacity-70">({Math.round(mapping.confidence * 100)}%)</span>
										</span>
									{/each}
								</div>
							</div>
							<button
								type="button"
								onclick={() => (showAiSuggestions = false)}
								class="text-blue-600 hover:text-blue-800 text-sm"
							>
								Dismiss
							</button>
						</div>
					</div>
				{/if}

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

					<!-- Required fields -->
					<fieldset class="border border-gray-200 rounded-lg p-4">
						<legend class="text-sm font-medium text-gray-700 px-2">Required Fields</legend>
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
						</div>
					</fieldset>

					<!-- Optional fields -->
					<fieldset class="border border-gray-200 rounded-lg p-4">
						<legend class="text-sm font-medium text-gray-700 px-2">Optional Fields</legend>
						<div class="grid grid-cols-2 gap-4">
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
								<label for="manufacturerColumn" class="block text-sm font-medium text-gray-700">Manufacturer Column</label>
								<select id="manufacturerColumn" name="manufacturerColumn" bind:value={manufacturerColumn} class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2">
									<option value="">None</option>
									{#each form.headers as header}
										<option value={header}>{header}</option>
									{/each}
								</select>
							</div>

							<div>
								<label for="hazardousColumn" class="block text-sm font-medium text-gray-700">Hazardous Column</label>
								<select id="hazardousColumn" name="hazardousColumn" bind:value={hazardousColumn} class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2">
									<option value="">None</option>
									{#each form.headers as header}
										<option value={header}>{header}</option>
									{/each}
								</select>
							</div>

							<div>
								<label for="consumableTypeColumn" class="block text-sm font-medium text-gray-700">Consumable Type Column</label>
								<select id="consumableTypeColumn" name="consumableTypeColumn" bind:value={consumableTypeColumn} class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2">
									<option value="">None</option>
									{#each form.headers as header}
										<option value={header}>{header}</option>
									{/each}
								</select>
							</div>

							<div>
								<label for="packagingUnitColumn" class="block text-sm font-medium text-gray-700">Packaging Unit Column</label>
								<select id="packagingUnitColumn" name="packagingUnitColumn" bind:value={packagingUnitColumn} class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2">
									<option value="">None</option>
									{#each form.headers as header}
										<option value={header}>{header}</option>
									{/each}
								</select>
							</div>

							<div>
								<label for="minOrderQtyColumn" class="block text-sm font-medium text-gray-700">Min Order Qty Column</label>
								<select id="minOrderQtyColumn" name="minOrderQtyColumn" bind:value={minOrderQtyColumn} class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2">
									<option value="">None</option>
									{#each form.headers as header}
										<option value={header}>{header}</option>
									{/each}
								</select>
							</div>

							<div>
								<label for="supplierSkuColumn" class="block text-sm font-medium text-gray-700">Supplier SKU Column</label>
								<select id="supplierSkuColumn" name="supplierSkuColumn" bind:value={supplierSkuColumn} class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2">
									<option value="">None</option>
									{#each form.headers as header}
										<option value={header}>{header}</option>
									{/each}
								</select>
							</div>

							<div>
								<label for="categoryId" class="block text-sm font-medium text-gray-700">Category (all products)</label>
								<select id="categoryId" name="categoryId" bind:value={categoryId} class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2">
									<option value="">None (use AI classification later)</option>
									{#each mainCategories as category (category.id)}
										<option value={category.id}>{category.name}</option>
									{/each}
								</select>
							</div>
						</div>
					</fieldset>

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

				<!-- AI Classification Section -->
				{#if importedProductIds.length > 0 && !classificationResult}
					<div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4 text-left">
						<h4 class="font-medium text-blue-800 mb-2">Auto-Classify Products with AI</h4>
						<p class="text-sm text-blue-700 mb-3">
							Use AI to automatically assign categories, subcategories, and construction types to the imported products.
						</p>
						<button
							type="button"
							onclick={classifyProducts}
							disabled={isClassifying}
							class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
						>
							{#if isClassifying}
								<svg class="animate-spin h-4 w-4" viewBox="0 0 24 24">
									<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
									<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
								</svg>
								Classifying...
							{:else}
								Classify {importedProductIds.length} Products
							{/if}
						</button>
					</div>
				{/if}

				{#if classificationResult}
					<div class="bg-green-50 border border-green-200 rounded-lg p-4 mt-4">
						<p class="text-green-800">
							Successfully classified <strong>{classificationResult.classified}</strong> of {classificationResult.total} products.
						</p>
					</div>
				{/if}

				<div class="flex justify-center gap-3 mt-6">
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
