import { fail, redirect } from '@sveltejs/kit';
import { encodeBase32LowerCase } from '@oslojs/encoding';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import type { Actions, PageServerLoad } from './$types';
import * as XLSX from 'xlsx';
import { mapCsvColumns, classifyProduct, classifyProductsBatch, extractProductsFromPdf } from '$lib/server/ai';
import type { ColumnMapping, ExtractedProduct } from '$lib/server/ai';

export const load: PageServerLoad = async ({ url, locals }) => {
	// Procurement-only route
	if (locals.user?.role !== 'manager') {
		throw redirect(302, '/manager');
	}

	const suppliers = await db.select().from(table.supplier).orderBy(table.supplier.name);

	// Load categories with hierarchy info
	const categories = await db
		.select()
		.from(table.productCategory)
		.orderBy(table.productCategory.sortOrder);

	// Load construction types
	const constructionTypes = await db
		.select()
		.from(table.constructionType)
		.orderBy(table.constructionType.sortOrder);

	// Get pre-selected supplier from URL param
	const preselectedSupplierId = url.searchParams.get('supplier');

	return { suppliers, categories, constructionTypes, preselectedSupplierId };
};

export const actions: Actions = {
	preview: async ({ request }) => {
		const formData = await request.formData();
		const file = formData.get('file') as File;
		const supplierId = formData.get('supplierId') as string;

		if (!file || file.size === 0) {
			return fail(400, { message: 'Please select a file' });
		}

		if (!supplierId) {
			return fail(400, { message: 'Please select a supplier' });
		}

		const isPdf = file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf';

		try {
			const buffer = await file.arrayBuffer();

			// Handle PDF files with AI extraction
			if (isPdf) {
				const base64 = Buffer.from(buffer).toString('base64');
				const extraction = await extractProductsFromPdf(base64);

				if (extraction.products.length === 0) {
					return fail(400, { message: 'No products found in the PDF. Please check the document format.' });
				}

				return {
					success: true,
					isPdf: true,
					pdfProducts: extraction.products,
					supplierName: extraction.supplierName,
					totalRows: extraction.products.length,
					supplierId,
					confidence: extraction.confidence
				};
			}

			// Handle Excel/CSV files
			// codepage 65001 = UTF-8 encoding for proper umlaut handling in CSV
			const workbook = XLSX.read(buffer, { type: 'array', codepage: 65001 });
			const sheetName = workbook.SheetNames[0];
			const sheet = workbook.Sheets[sheetName];
			const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

			if (data.length === 0) {
				return fail(400, { message: 'The file appears to be empty' });
			}

			// Get column headers
			const headers = Object.keys(data[0]);

			// Preview first 10 rows
			const preview = data.slice(0, 10);

			// Get AI suggested mappings
			let suggestedMappings: ColumnMapping[] = [];
			let unmappedColumns: string[] = headers;

			try {
				const aiMappings = await mapCsvColumns(headers, preview as Record<string, unknown>[]);
				suggestedMappings = aiMappings.mappings;
				unmappedColumns = aiMappings.unmappedColumns;
			} catch (err) {
				console.error('AI mapping failed:', err);
				// Continue without AI suggestions
			}

			return {
				success: true,
				isPdf: false,
				headers,
				preview,
				totalRows: data.length,
				supplierId,
				suggestedMappings,
				unmappedColumns
			};
		} catch (err) {
			console.error('Error parsing file:', err);
			return fail(400, {
				message: isPdf
					? 'Error extracting products from PDF. Please try again or use an Excel file.'
					: 'Error parsing file. Make sure it is a valid Excel or CSV file.'
			});
		}
	},

	import: async ({ request }) => {
		const formData = await request.formData();
		const file = formData.get('file') as File;
		const supplierId = formData.get('supplierId') as string;
		const skuColumn = formData.get('skuColumn') as string;
		const nameColumn = formData.get('nameColumn') as string;
		const descriptionColumn = formData.get('descriptionColumn') as string;
		const unitColumn = formData.get('unitColumn') as string;
		const priceColumn = formData.get('priceColumn') as string;
		const categoryId = formData.get('categoryId') as string;

		// Extended field mappings
		const manufacturerColumn = formData.get('manufacturerColumn') as string;
		const packagingUnitColumn = formData.get('packagingUnitColumn') as string;
		const hazardousColumn = formData.get('hazardousColumn') as string;
		const consumableTypeColumn = formData.get('consumableTypeColumn') as string;
		const minOrderQtyColumn = formData.get('minOrderQtyColumn') as string;
		const supplierSkuColumn = formData.get('supplierSkuColumn') as string;

		if (!file || !supplierId || !skuColumn || !nameColumn || !priceColumn) {
			return fail(400, { message: 'Missing required fields' });
		}

		try {
			const buffer = await file.arrayBuffer();
			// codepage 65001 = UTF-8 encoding for proper umlaut handling in CSV
			const workbook = XLSX.read(buffer, { type: 'array', codepage: 65001 });
			const sheetName = workbook.SheetNames[0];
			const sheet = workbook.Sheets[sheetName];
			const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

			let imported = 0;
			let skipped = 0;
			const importedProductIds: string[] = [];

			for (const row of data) {
				const sku = String(row[skuColumn] || '').trim();
				const name = String(row[nameColumn] || '').trim();
				const description = descriptionColumn ? String(row[descriptionColumn] || '').trim() : null;
				const unit = unitColumn ? String(row[unitColumn] || '').trim() : 'piece';
				const priceRaw = row[priceColumn];

				// Parse price (handle string or number)
				let pricePerUnit = 0;
				if (typeof priceRaw === 'number') {
					pricePerUnit = Math.round(priceRaw * 100); // Convert to cents
				} else if (typeof priceRaw === 'string') {
					const parsed = parseFloat(priceRaw.replace(',', '.').replace(/[^\d.]/g, ''));
					if (!isNaN(parsed)) {
						pricePerUnit = Math.round(parsed * 100);
					}
				}

				// Skip rows with missing required data
				if (!sku || !name || pricePerUnit <= 0) {
					skipped++;
					continue;
				}

				// Parse extended fields
				const manufacturer = manufacturerColumn
					? String(row[manufacturerColumn] || '').trim() || null
					: null;

				const packagingUnit = packagingUnitColumn
					? String(row[packagingUnitColumn] || '').trim() || null
					: null;

				let hazardous = false;
				if (hazardousColumn) {
					const hazVal = row[hazardousColumn];
					if (typeof hazVal === 'boolean') hazardous = hazVal;
					else if (typeof hazVal === 'string') {
						const lower = hazVal.toLowerCase();
						hazardous = ['true', 'yes', 'ja', '1', 'x'].includes(lower);
					} else if (typeof hazVal === 'number') hazardous = hazVal === 1;
				}

				let consumableType: 'single-use' | 'reusable' | null = null;
				if (consumableTypeColumn) {
					const ctVal = String(row[consumableTypeColumn] || '').toLowerCase();
					if (ctVal.includes('einweg') || ctVal.includes('single')) {
						consumableType = 'single-use';
					} else if (ctVal.includes('mehrweg') || ctVal.includes('reusable')) {
						consumableType = 'reusable';
					}
				}

				let minOrderQty = 1;
				if (minOrderQtyColumn) {
					const moqVal = row[minOrderQtyColumn];
					if (typeof moqVal === 'number') minOrderQty = Math.round(moqVal);
					else if (typeof moqVal === 'string') {
						const parsed = parseInt(moqVal, 10);
						if (!isNaN(parsed)) minOrderQty = parsed;
					}
				}

				const supplierSku = supplierSkuColumn
					? String(row[supplierSkuColumn] || '').trim() || null
					: null;

				const productId = generateId();

				await db.insert(table.product).values({
					id: productId,
					supplierId,
					categoryId: categoryId || null,
					subcategoryId: null,
					sku,
					name,
					description: description || null,
					unit: unit || 'piece',
					pricePerUnit,
					manufacturer,
					packagingUnit,
					hazardous,
					consumableType,
					minOrderQty,
					supplierSku
				});

				importedProductIds.push(productId);
				imported++;
			}

			return {
				success: true,
				imported,
				skipped,
				importedProductIds
			};
		} catch (err) {
			console.error('Error importing products:', err);
			return fail(500, { message: 'Error importing products' });
		}
	},

	classifyBatch: async ({ request }) => {
		const formData = await request.formData();
		const productIdsJson = formData.get('productIds') as string;

		if (!productIdsJson) {
			return fail(400, { message: 'No product IDs provided' });
		}

		let productIds: string[];
		try {
			productIds = JSON.parse(productIdsJson);
		} catch {
			return fail(400, { message: 'Invalid product IDs' });
		}

		// Load categories and construction types for classification
		const categories = await db.select().from(table.productCategory);
		const constructionTypes = await db.select().from(table.constructionType);

		// Load all products to classify
		const productsToClassify = await db
			.select({
				id: table.product.id,
				name: table.product.name,
				description: table.product.description
			})
			.from(table.product)
			.where(
				productIds.length === 1
					? eq(table.product.id, productIds[0])
					: undefined // Will filter below for multiple IDs
			);

		// Filter to only requested IDs
		const productIdSet = new Set(productIds);
		const filteredProducts = productsToClassify.filter((p) => productIdSet.has(p.id));

		if (filteredProducts.length === 0) {
			return fail(400, { message: 'No products found' });
		}

		try {
			// Use batch classification - single API call for up to 20 products
			const classifications = await classifyProductsBatch(
				filteredProducts,
				categories,
				constructionTypes
			);

			let classified = 0;
			const results: Array<{ productId: string; success: boolean; error?: string }> = [];

			// Update products with classifications
			for (const product of filteredProducts) {
				const classification = classifications.get(product.id);
				if (!classification) {
					results.push({ productId: product.id, success: false, error: 'Classification not found' });
					continue;
				}

				try {
					// Update product with classification
					await db
						.update(table.product)
						.set({
							categoryId: classification.categoryId,
							subcategoryId: classification.subcategoryId,
							hazardous: classification.hazardous,
							consumableType: classification.consumableType
						})
						.where(eq(table.product.id, product.id));

					// Insert construction type associations
					for (const ct of classification.constructionTypes) {
						await db
							.insert(table.productConstructionType)
							.values({
								productId: product.id,
								constructionTypeId: ct.id
							})
							.onConflictDoNothing();
					}

					results.push({ productId: product.id, success: true });
					classified++;
				} catch (err) {
					console.error(`Error updating product ${product.id}:`, err);
					results.push({
						productId: product.id,
						success: false,
						error: err instanceof Error ? err.message : 'Unknown error'
					});
				}
			}

			return {
				success: true,
				classified,
				total: productIds.length,
				results
			};
		} catch (err) {
			console.error('Batch classification error:', err);
			return fail(500, { message: 'Classification failed' });
		}
	},

	importPdf: async ({ request }) => {
		const formData = await request.formData();
		const productsJson = formData.get('products') as string;
		const supplierId = formData.get('supplierId') as string;
		const categoryId = formData.get('categoryId') as string;

		if (!productsJson || !supplierId) {
			return fail(400, { message: 'Missing required fields' });
		}

		let products: ExtractedProduct[];
		try {
			products = JSON.parse(productsJson);
		} catch {
			return fail(400, { message: 'Invalid product data' });
		}

		try {
			let imported = 0;
			const importedProductIds: string[] = [];

			for (const product of products) {
				const productId = generateId();

				await db.insert(table.product).values({
					id: productId,
					supplierId,
					categoryId: categoryId || null,
					subcategoryId: null,
					sku: product.sku,
					name: product.name,
					description: product.description || null,
					unit: product.unit || 'pcs',
					pricePerUnit: product.pricePerUnit, // Already in cents from extraction
					manufacturer: null,
					packagingUnit: null,
					hazardous: false,
					consumableType: null,
					minOrderQty: 1,
					supplierSku: product.sku
				});

				importedProductIds.push(productId);
				imported++;
			}

			return {
				success: true,
				imported,
				skipped: 0,
				importedProductIds
			};
		} catch (err) {
			console.error('Error importing PDF products:', err);
			return fail(500, { message: 'Error importing products' });
		}
	}
};

function generateId() {
	const bytes = crypto.getRandomValues(new Uint8Array(15));
	return encodeBase32LowerCase(bytes);
}
