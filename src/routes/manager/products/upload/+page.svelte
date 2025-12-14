<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// Wizard state
	type Step = 'upload' | 'mapping' | 'review' | 'importing' | 'done';
	let currentStep = $state<Step>('upload');
	let isProcessing = $state(false);
	let processingMessage = $state('');

	// Form data
	let selectedFile = $state<File | null>(null);
	let selectedSupplierId = $state(data.preselectedSupplierId || '');
	let isDragging = $state(false);

	// Parsed data (stored to avoid re-upload)
	let parsedData = $state<Record<string, unknown>[] | null>(null);
	let headers = $state<string[]>([]);
	let preview = $state<Record<string, unknown>[]>([]);
	let totalRows = $state(0);

	// Column mappings
	let skuColumn = $state('');
	let nameColumn = $state('');
	let descriptionColumn = $state('');
	let unitColumn = $state('');
	let priceColumn = $state('');
	let categoryId = $state('');

	// AI suggestions
	let aiMappings = $state<Array<{ sourceColumn: string; targetField: string; confidence: number }>>([]);

	// Import results
	let importedCount = $state(0);
	let skippedCount = $state(0);
	let importedProductIds = $state<string[]>([]);
	let isClassifying = $state(false);
	let classificationResult = $state<{ classified: number; total: number } | null>(null);

	// PDF specific
	let isPdf = $state(false);
	let pdfProducts = $state<Array<{ sku: string; name: string; unit: string; pricePerUnit: number }>>([]);

	const mainCategories = $derived(data.categories.filter((c) => !c.parentId));

	const steps = [
		{ id: 'upload', label: 'Upload', icon: '1' },
		{ id: 'mapping', label: 'Map Columns', icon: '2' },
		{ id: 'review', label: 'Review', icon: '3' },
		{ id: 'done', label: 'Done', icon: '✓' }
	];

	const currentStepIndex = $derived(
		currentStep === 'importing' ? 2 : steps.findIndex((s) => s.id === currentStep)
	);

	// Handle file drop
	function handleDrop(event: DragEvent) {
		event.preventDefault();
		isDragging = false;
		const file = event.dataTransfer?.files[0];
		if (file && isValidFile(file)) {
			selectedFile = file;
		}
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		isDragging = true;
	}

	function handleDragLeave() {
		isDragging = false;
	}

	function isValidFile(file: File): boolean {
		const validTypes = ['.xlsx', '.xls', '.csv', '.pdf'];
		return validTypes.some((ext) => file.name.toLowerCase().endsWith(ext));
	}

	function handleFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		selectedFile = input.files?.[0] || null;
	}

	// Apply AI suggestions to mappings
	function applyAiSuggestions() {
		for (const mapping of aiMappings) {
			switch (mapping.targetField) {
				case 'sku':
				case 'supplierSku':
					if (!skuColumn) skuColumn = mapping.sourceColumn;
					break;
				case 'name':
					if (!nameColumn) nameColumn = mapping.sourceColumn;
					break;
				case 'description':
					if (!descriptionColumn) descriptionColumn = mapping.sourceColumn;
					break;
				case 'unit':
					if (!unitColumn) unitColumn = mapping.sourceColumn;
					break;
				case 'pricePerUnit':
					if (!priceColumn) priceColumn = mapping.sourceColumn;
					break;
			}
		}
	}

	// Handle parse response - use guard to prevent infinite loops
	$effect(() => {
		if (!form) return;

		// Excel/CSV parsed - only process if we're still on upload step
		if (form?.success && form?.headers && !form?.isPdf && currentStep === 'upload') {
			headers = form.headers;
			preview = form.preview || [];
			parsedData = form.allData || [];
			totalRows = form.totalRows || 0;
			aiMappings = form.suggestedMappings || [];
			isPdf = false;

			// Auto-apply AI suggestions
			applyAiSuggestions();

			currentStep = 'mapping';
			isProcessing = false;
		}
		// PDF parsed - only process if we're still on upload step
		else if (form?.success && form?.isPdf && currentStep === 'upload') {
			isPdf = true;
			pdfProducts = form.pdfProducts || [];
			totalRows = form.totalRows || 0;
			currentStep = 'review';
			isProcessing = false;
		}
		// Import complete - only process if we're on importing step
		else if (form?.imported !== undefined && currentStep === 'importing') {
			importedCount = form.imported;
			skippedCount = form.skipped || 0;
			importedProductIds = form.importedProductIds || [];
			currentStep = 'done';
			isProcessing = false;

			// Auto-classify products for better catalog discovery
			if (form.importedProductIds && form.importedProductIds.length > 0) {
				classifyProducts();
			}
		}
	});

	function formatPrice(cents: number): string {
		return (cents / 100).toFixed(2);
	}

	function getConfidenceColor(confidence: number): string {
		if (confidence >= 0.8) return 'text-green-600 bg-green-100';
		if (confidence >= 0.5) return 'text-yellow-600 bg-yellow-100';
		return 'text-gray-600 bg-gray-100';
	}

	function resetWizard() {
		currentStep = 'upload';
		selectedFile = null;
		parsedData = null;
		headers = [];
		preview = [];
		totalRows = 0;
		skuColumn = '';
		nameColumn = '';
		descriptionColumn = '';
		unitColumn = '';
		priceColumn = '';
		categoryId = '';
		aiMappings = [];
		importedCount = 0;
		skippedCount = 0;
		importedProductIds = [];
		isPdf = false;
		pdfProducts = [];
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
			// SvelteKit action response has data nested under result.data
			const data = result.data || result;
			if (data.classified !== undefined) {
				classificationResult = {
					classified: data.classified,
					total: data.total
				};
			}
		} catch (err) {
			console.error('Classification error:', err);
		} finally {
			isClassifying = false;
		}
	}

	// Check if required mappings are set
	const canProceedToReview = $derived(skuColumn && nameColumn && priceColumn);
</script>

<svelte:head>
	<title>Import Products - ComStruct</title>
</svelte:head>

<div class="max-w-4xl mx-auto">
	<!-- Back link -->
	<div class="mb-6">
		{#if data.preselectedSupplierId}
			<a href="/manager/suppliers/{data.preselectedSupplierId}" class="text-blue-600 hover:underline text-sm">&larr; Back to Supplier</a>
		{:else}
			<a href="/manager/products" class="text-blue-600 hover:underline text-sm">&larr; Back to Products</a>
		{/if}
	</div>

	<!-- Step Indicator -->
	<div class="mb-8">
		<div class="flex items-center justify-between">
			{#each steps as step, i (step.id)}
				<div class="flex items-center {i < steps.length - 1 ? 'flex-1' : ''}">
					<div class="flex items-center">
						<div
							class="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all
							{i < currentStepIndex ? 'bg-green-500 text-white' : ''}
							{i === currentStepIndex ? 'bg-blue-600 text-white ring-4 ring-blue-200' : ''}
							{i > currentStepIndex ? 'bg-gray-200 text-gray-500' : ''}"
						>
							{i < currentStepIndex ? '✓' : step.icon}
						</div>
						<span class="ml-2 text-sm font-medium {i <= currentStepIndex ? 'text-gray-900' : 'text-gray-400'}">
							{step.label}
						</span>
					</div>
					{#if i < steps.length - 1}
						<div class="flex-1 mx-4 h-1 rounded {i < currentStepIndex ? 'bg-green-500' : 'bg-gray-200'}"></div>
					{/if}
				</div>
			{/each}
		</div>
	</div>

	<div class="bg-white rounded-xl shadow-lg overflow-hidden">
		<!-- STEP 1: Upload -->
		{#if currentStep === 'upload'}
			<div class="p-8">
				<h2 class="text-2xl font-bold text-gray-900 mb-2">Import Products</h2>
				<p class="text-gray-600 mb-6">Upload a price list or contract to import products. AI will help map the columns.</p>

				{#if data.suppliers.length === 0}
					<div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
						<p class="text-yellow-800">
							You need to <a href="/manager/suppliers/new" class="underline font-medium">add a supplier</a> first.
						</p>
					</div>
				{:else}
					<form
						method="post"
						action="?/parse"
						enctype="multipart/form-data"
						use:enhance={() => {
							isProcessing = true;
							processingMessage = 'Analyzing file with AI...';
							return async ({ update }) => {
								await update();
							};
						}}
						class="space-y-6"
					>
						<!-- Supplier Selection -->
						<div>
							<label for="supplierId" class="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
							<select
								id="supplierId"
								name="supplierId"
								required
								bind:value={selectedSupplierId}
								class="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
							>
								<option value="">Select a supplier...</option>
								{#each data.suppliers as supplier (supplier.id)}
									<option value={supplier.id}>{supplier.name}</option>
								{/each}
							</select>
						</div>

						<!-- Drag & Drop Zone -->
						<div
							class="relative border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer
							{isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
							{selectedFile ? 'border-green-500 bg-green-50' : ''}"
							ondrop={handleDrop}
							ondragover={handleDragOver}
							ondragleave={handleDragLeave}
							role="button"
							tabindex="0"
						>
							<input
								type="file"
								name="file"
								id="file"
								accept=".xlsx,.xls,.csv,.pdf"
								class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
								onchange={handleFileSelect}
							/>

							{#if selectedFile}
								<div class="text-green-600">
									<svg class="w-12 h-12 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
									</svg>
									<p class="font-medium">{selectedFile.name}</p>
									<p class="text-sm text-green-500 mt-1">Ready to upload</p>
								</div>
							{:else}
								<svg class="w-12 h-12 mx-auto mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
								</svg>
								<p class="font-medium text-gray-700">Drop your file here</p>
								<p class="text-sm text-gray-500 mt-1">or click to browse</p>
								<p class="text-xs text-gray-400 mt-3">Supports Excel (.xlsx, .xls), CSV, and PDF</p>
							{/if}
						</div>

						{#if form?.message}
							<div class="bg-red-50 border border-red-200 rounded-lg p-4">
								<p class="text-red-700">{form.message}</p>
							</div>
						{/if}

						<button
							type="submit"
							disabled={!selectedFile || !selectedSupplierId || isProcessing}
							class="w-full py-4 px-6 bg-blue-600 text-white rounded-xl font-bold text-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-3"
						>
							{#if isProcessing}
								<svg class="animate-spin h-5 w-5" viewBox="0 0 24 24">
									<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
									<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
								</svg>
								{processingMessage}
							{:else}
								<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
								</svg>
								Analyze File
							{/if}
						</button>
					</form>
				{/if}
			</div>

		<!-- STEP 2: Column Mapping (Excel/CSV only) -->
		{:else if currentStep === 'mapping'}
			<div class="p-8">
				<h2 class="text-2xl font-bold text-gray-900 mb-2">Map Your Columns</h2>
				<p class="text-gray-600 mb-6">
					Found <strong>{totalRows}</strong> products. AI has suggested mappings below.
				</p>

				<!-- AI Suggestions Banner -->
				{#if aiMappings.length > 0}
					<div class="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-xl p-4 mb-6">
						<div class="flex items-center gap-2 mb-3">
							<svg class="w-5 h-5 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
								<path d="M10 18a8 8 0 100-16 8 8 0 000 16zm0-2a6 6 0 100-12 6 6 0 000 12z"/>
								<path d="M10 6a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V7a1 1 0 011-1z"/>
							</svg>
							<span class="font-semibold text-purple-800">AI Detected Columns</span>
						</div>
						<div class="flex flex-wrap gap-2">
							{#each aiMappings as mapping (mapping.sourceColumn)}
								<span class="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm {getConfidenceColor(mapping.confidence)}">
									<span class="font-medium">{mapping.sourceColumn}</span>
									<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
									</svg>
									<span>{mapping.targetField}</span>
								</span>
							{/each}
						</div>
					</div>
				{/if}

				<form
					method="post"
					action="?/import"
					use:enhance={() => {
						isProcessing = true;
						processingMessage = 'Importing products...';
						currentStep = 'importing';
						return async ({ update }) => {
							await update();
						};
					}}
					class="space-y-6"
				>
					<input type="hidden" name="supplierId" value={form?.supplierId || selectedSupplierId} />
					<input type="hidden" name="data" value={JSON.stringify(parsedData)} />

					<!-- Required Fields -->
					<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
						<div>
							<label for="skuColumn" class="block text-sm font-medium text-gray-700 mb-1">
								SKU Column <span class="text-red-500">*</span>
							</label>
							<select id="skuColumn" name="skuColumn" required bind:value={skuColumn} class="w-full rounded-lg border border-gray-300 px-3 py-2.5 focus:border-blue-500 focus:ring-2 focus:ring-blue-200">
								<option value="">Select...</option>
								{#each headers as header (header)}
									<option value={header}>{header}</option>
								{/each}
							</select>
						</div>

						<div>
							<label for="nameColumn" class="block text-sm font-medium text-gray-700 mb-1">
								Name Column <span class="text-red-500">*</span>
							</label>
							<select id="nameColumn" name="nameColumn" required bind:value={nameColumn} class="w-full rounded-lg border border-gray-300 px-3 py-2.5 focus:border-blue-500 focus:ring-2 focus:ring-blue-200">
								<option value="">Select...</option>
								{#each headers as header (header)}
									<option value={header}>{header}</option>
								{/each}
							</select>
						</div>

						<div>
							<label for="priceColumn" class="block text-sm font-medium text-gray-700 mb-1">
								Price Column <span class="text-red-500">*</span>
							</label>
							<select id="priceColumn" name="priceColumn" required bind:value={priceColumn} class="w-full rounded-lg border border-gray-300 px-3 py-2.5 focus:border-blue-500 focus:ring-2 focus:ring-blue-200">
								<option value="">Select...</option>
								{#each headers as header (header)}
									<option value={header}>{header}</option>
								{/each}
							</select>
						</div>
					</div>

					<!-- Optional Fields (Collapsible) -->
					<details class="border border-gray-200 rounded-lg">
						<summary class="px-4 py-3 cursor-pointer text-sm font-medium text-gray-700 hover:bg-gray-50">
							Optional Fields (Unit, Description, Category)
						</summary>
						<div class="p-4 pt-0 grid grid-cols-1 md:grid-cols-3 gap-4">
							<div>
								<label for="unitColumn" class="block text-sm font-medium text-gray-700 mb-1">Unit Column</label>
								<select id="unitColumn" name="unitColumn" bind:value={unitColumn} class="w-full rounded-lg border border-gray-300 px-3 py-2.5">
									<option value="">None (default: piece)</option>
									{#each headers as header (header)}
										<option value={header}>{header}</option>
									{/each}
								</select>
							</div>

							<div>
								<label for="descriptionColumn" class="block text-sm font-medium text-gray-700 mb-1">Description</label>
								<select id="descriptionColumn" name="descriptionColumn" bind:value={descriptionColumn} class="w-full rounded-lg border border-gray-300 px-3 py-2.5">
									<option value="">None</option>
									{#each headers as header (header)}
										<option value={header}>{header}</option>
									{/each}
								</select>
							</div>

							<div>
								<label for="categoryId" class="block text-sm font-medium text-gray-700 mb-1">Category</label>
								<select id="categoryId" name="categoryId" bind:value={categoryId} class="w-full rounded-lg border border-gray-300 px-3 py-2.5">
									<option value="">Use AI classification</option>
									{#each mainCategories as category (category.id)}
										<option value={category.id}>{category.name}</option>
									{/each}
								</select>
							</div>
						</div>
					</details>

					<!-- Hidden optional mappings -->
					<input type="hidden" name="manufacturerColumn" value="" />
					<input type="hidden" name="packagingUnitColumn" value="" />
					<input type="hidden" name="hazardousColumn" value="" />
					<input type="hidden" name="consumableTypeColumn" value="" />
					<input type="hidden" name="minOrderQtyColumn" value="" />
					<input type="hidden" name="supplierSkuColumn" value="" />

					<!-- Preview Table -->
					<div class="border border-gray-200 rounded-lg overflow-hidden">
						<div class="bg-gray-50 px-4 py-2 text-sm font-medium text-gray-700">
							Preview (first 5 rows)
						</div>
						<div class="overflow-x-auto">
							<table class="min-w-full text-sm">
								<thead class="bg-gray-100">
									<tr>
										{#each headers as header (header)}
											<th class="px-3 py-2 text-left font-medium text-gray-600 border-b">
												{header}
												{#if header === skuColumn}
													<span class="ml-1 text-blue-600">(SKU)</span>
												{:else if header === nameColumn}
													<span class="ml-1 text-blue-600">(Name)</span>
												{:else if header === priceColumn}
													<span class="ml-1 text-blue-600">(Price)</span>
												{/if}
											</th>
										{/each}
									</tr>
								</thead>
								<tbody>
									{#each preview as row, i (i)}
										<tr class="{i % 2 ? 'bg-gray-50' : ''}">
											{#each headers as header (header)}
												<td class="px-3 py-2 border-b border-gray-100">{row[header] ?? ''}</td>
											{/each}
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					</div>

					{#if form?.message}
						<div class="bg-red-50 border border-red-200 rounded-lg p-4">
							<p class="text-red-700">{form.message}</p>
						</div>
					{/if}

					<div class="flex gap-4">
						<button
							type="button"
							onclick={resetWizard}
							class="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-all"
						>
							Start Over
						</button>
						<button
							type="submit"
							disabled={!canProceedToReview}
							class="flex-1 py-3 px-6 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
						>
							Import {totalRows} Products
						</button>
					</div>
				</form>
			</div>

		<!-- STEP 2b: Review (PDF only) -->
		{:else if currentStep === 'review' && isPdf}
			<div class="p-8">
				<h2 class="text-2xl font-bold text-gray-900 mb-2">Review Extracted Products</h2>
				<p class="text-gray-600 mb-6">
					AI extracted <strong>{totalRows}</strong> products from the PDF.
				</p>

				<!-- AI Confidence Banner -->
				{#if form?.confidence}
					<div class="bg-purple-50 border border-purple-200 rounded-xl p-4 mb-6 flex items-center gap-3">
						<svg class="w-6 h-6 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
							<path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/>
							<path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5z" clip-rule="evenodd"/>
						</svg>
						<div>
							<span class="font-medium text-purple-800">AI Extraction</span>
							<span class="ml-2 text-sm px-2 py-0.5 rounded-full {getConfidenceColor(form.confidence)}">
								{Math.round(form.confidence * 100)}% confidence
							</span>
						</div>
					</div>
				{/if}

				<form
					method="post"
					action="?/importPdf"
					use:enhance={() => {
						isProcessing = true;
						processingMessage = 'Importing products...';
						currentStep = 'importing';
						return async ({ update }) => {
							await update();
						};
					}}
					class="space-y-6"
				>
					<input type="hidden" name="supplierId" value={form?.supplierId || selectedSupplierId} />
					<input type="hidden" name="products" value={JSON.stringify(pdfProducts)} />

					<div>
						<label for="pdfCategoryId" class="block text-sm font-medium text-gray-700 mb-1">Category (all products)</label>
						<select id="pdfCategoryId" name="categoryId" bind:value={categoryId} class="w-full md:w-1/2 rounded-lg border border-gray-300 px-3 py-2.5">
							<option value="">Use AI classification later</option>
							{#each mainCategories as category (category.id)}
								<option value={category.id}>{category.name}</option>
							{/each}
						</select>
					</div>

					<!-- Products Table -->
					<div class="border border-gray-200 rounded-lg overflow-hidden">
						<div class="overflow-x-auto max-h-96">
							<table class="min-w-full text-sm">
								<thead class="bg-gray-100 sticky top-0">
									<tr>
										<th class="px-4 py-3 text-left font-medium text-gray-600">SKU</th>
										<th class="px-4 py-3 text-left font-medium text-gray-600">Name</th>
										<th class="px-4 py-3 text-left font-medium text-gray-600">Unit</th>
										<th class="px-4 py-3 text-right font-medium text-gray-600">Price</th>
									</tr>
								</thead>
								<tbody>
									{#each pdfProducts as product, i (product.sku)}
										<tr class="{i % 2 ? 'bg-gray-50' : ''} hover:bg-blue-50">
											<td class="px-4 py-2 font-mono text-gray-500">{product.sku}</td>
											<td class="px-4 py-2">{product.name}</td>
											<td class="px-4 py-2">{product.unit}</td>
											<td class="px-4 py-2 text-right">CHF {formatPrice(product.pricePerUnit)}</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					</div>

					<div class="flex gap-4">
						<button
							type="button"
							onclick={resetWizard}
							class="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-all"
						>
							Start Over
						</button>
						<button
							type="submit"
							class="flex-1 py-3 px-6 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all"
						>
							Import {totalRows} Products
						</button>
					</div>
				</form>
			</div>

		<!-- STEP 3: Importing (Loading State) -->
		{:else if currentStep === 'importing'}
			<div class="p-12 text-center">
				<svg class="animate-spin h-16 w-16 mx-auto text-blue-600 mb-6" viewBox="0 0 24 24">
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
					<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
				</svg>
				<h2 class="text-2xl font-bold text-gray-900 mb-2">Importing Products</h2>
				<p class="text-gray-600">{processingMessage}</p>
				<p class="text-sm text-gray-400 mt-4">This may take a moment...</p>
			</div>

		<!-- STEP 4: Done -->
		{:else if currentStep === 'done'}
			<div class="p-8 text-center">
				<div class="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
					<svg class="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
					</svg>
				</div>

				<h2 class="text-2xl font-bold text-gray-900 mb-2">Import Complete!</h2>
				<p class="text-gray-600 mb-6">
					Successfully imported <strong>{importedCount}</strong> products.
					{#if skippedCount > 0}
						<span class="text-yellow-600">({skippedCount} rows skipped)</span>
					{/if}
				</p>

				<!-- AI Classification Status (runs automatically) -->
				{#if isClassifying}
					<div class="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-xl p-4 mb-6 max-w-md mx-auto flex items-center justify-center gap-3">
						<svg class="animate-spin h-5 w-5 text-purple-600" viewBox="0 0 24 24">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
						</svg>
						<span class="text-purple-800 font-medium">Classifying products with AI...</span>
					</div>
				{:else if classificationResult}
					<div class="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 max-w-md mx-auto">
						<p class="text-green-800">
							Classified <strong>{classificationResult.classified}</strong> of {classificationResult.total} products!
						</p>
					</div>
				{/if}

				<div class="flex justify-center gap-4">
					<a
						href="/manager/products"
						class="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-all"
					>
						View Products
					</a>
					<button
						type="button"
						onclick={resetWizard}
						class="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-all"
					>
						Import More
					</button>
				</div>
			</div>
		{/if}
	</div>
</div>
