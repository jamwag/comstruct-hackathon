import { error, fail, redirect } from '@sveltejs/kit';
import { eq, desc, count } from 'drizzle-orm';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const [supplier] = await db.select().from(table.supplier).where(eq(table.supplier.id, params.id));

	if (!supplier) {
		throw error(404, 'Supplier not found');
	}

	// Fetch products for this supplier
	const products = await db
		.select({
			id: table.product.id,
			sku: table.product.sku,
			name: table.product.name,
			unit: table.product.unit,
			pricePerUnit: table.product.pricePerUnit,
			categoryName: table.productCategory.name
		})
		.from(table.product)
		.leftJoin(table.productCategory, eq(table.product.categoryId, table.productCategory.id))
		.where(eq(table.product.supplierId, params.id))
		.orderBy(desc(table.product.createdAt))
		.limit(100);

	// Get total product count
	const [productCount] = await db
		.select({ count: count() })
		.from(table.product)
		.where(eq(table.product.supplierId, params.id));

	return { supplier, products, productCount: productCount.count };
};

export const actions: Actions = {
	update: async ({ params, request }) => {
		const formData = await request.formData();
		const name = formData.get('name');
		const contactEmail = formData.get('contactEmail');
		const shopUrl = formData.get('shopUrl');

		if (typeof name !== 'string' || name.trim().length === 0) {
			return fail(400, { message: 'Supplier name is required' });
		}

		// Validate shopUrl if provided
		if (typeof shopUrl === 'string' && shopUrl.trim()) {
			try {
				new URL(shopUrl.trim());
			} catch {
				return fail(400, { message: 'Invalid shop URL format' });
			}
		}

		await db
			.update(table.supplier)
			.set({
				name: name.trim(),
				contactEmail:
					typeof contactEmail === 'string' && contactEmail.trim() ? contactEmail.trim() : null,
				shopUrl: typeof shopUrl === 'string' && shopUrl.trim() ? shopUrl.trim() : null
			})
			.where(eq(table.supplier.id, params.id));

		throw redirect(302, '/manager/suppliers');
	}
};
