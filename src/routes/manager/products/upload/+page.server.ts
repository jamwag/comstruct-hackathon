import { fail, redirect } from '@sveltejs/kit';
import { encodeBase32LowerCase } from '@oslojs/encoding';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import type { Actions, PageServerLoad } from './$types';
import * as XLSX from 'xlsx';

export const load: PageServerLoad = async () => {
	const suppliers = await db.select().from(table.supplier).orderBy(table.supplier.name);
	const categories = await db.select().from(table.productCategory).orderBy(table.productCategory.sortOrder);

	return { suppliers, categories };
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

		try {
			const buffer = await file.arrayBuffer();
			const workbook = XLSX.read(buffer, { type: 'array' });
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

			return {
				success: true,
				headers,
				preview,
				totalRows: data.length,
				supplierId
			};
		} catch (err) {
			console.error('Error parsing file:', err);
			return fail(400, { message: 'Error parsing file. Make sure it is a valid Excel or CSV file.' });
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

		if (!file || !supplierId || !skuColumn || !nameColumn || !priceColumn) {
			return fail(400, { message: 'Missing required fields' });
		}

		try {
			const buffer = await file.arrayBuffer();
			const workbook = XLSX.read(buffer, { type: 'array' });
			const sheetName = workbook.SheetNames[0];
			const sheet = workbook.Sheets[sheetName];
			const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

			let imported = 0;
			let skipped = 0;

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

				const productId = generateId();

				await db.insert(table.product).values({
					id: productId,
					supplierId,
					categoryId: categoryId || null,
					sku,
					name,
					description: description || null,
					unit: unit || 'piece',
					pricePerUnit
				});

				imported++;
			}

			return {
				success: true,
				imported,
				skipped
			};
		} catch (err) {
			console.error('Error importing products:', err);
			return fail(500, { message: 'Error importing products' });
		}
	}
};

function generateId() {
	const bytes = crypto.getRandomValues(new Uint8Array(15));
	return encodeBase32LowerCase(bytes);
}
