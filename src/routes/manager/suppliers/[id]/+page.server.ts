import { error, fail, redirect } from '@sveltejs/kit';
import { eq, desc, count, inArray } from 'drizzle-orm';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	// Procurement-only route
	if (locals.user?.role !== 'manager') {
		throw redirect(302, '/manager');
	}

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
		const description = formData.get('description');

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
				shopUrl: typeof shopUrl === 'string' && shopUrl.trim() ? shopUrl.trim() : null,
				description:
					typeof description === 'string' && description.trim() ? description.trim() : null
			})
			.where(eq(table.supplier.id, params.id));

		throw redirect(302, '/manager/suppliers');
	},

	deleteSupplier: async ({ params }) => {
		// First, delete all related data for products from this supplier
		const supplierProducts = await db
			.select({ id: table.product.id })
			.from(table.product)
			.where(eq(table.product.supplierId, params.id));

		const productIds = supplierProducts.map((p) => p.id);

		if (productIds.length > 0) {
			// Delete product-related records
			await db.delete(table.productConstructionType).where(
				inArray(table.productConstructionType.productId, productIds)
			);
			await db.delete(table.projectProduct).where(
				inArray(table.projectProduct.productId, productIds)
			);
			await db.delete(table.productKitItem).where(
				inArray(table.productKitItem.productId, productIds)
			);
			// Set orderItem productId to null for these products
			await db
				.update(table.orderItem)
				.set({ productId: null })
				.where(inArray(table.orderItem.productId, productIds));
			// Delete products
			await db.delete(table.product).where(eq(table.product.supplierId, params.id));
		}

		// Delete project supplier preferences
		await db.delete(table.projectSupplier).where(eq(table.projectSupplier.supplierId, params.id));

		// Delete the supplier
		await db.delete(table.supplier).where(eq(table.supplier.id, params.id));

		throw redirect(302, '/manager/suppliers');
	},

	deleteProduct: async ({ request }) => {
		const formData = await request.formData();
		const productId = formData.get('productId');

		if (typeof productId !== 'string') {
			return fail(400, { message: 'Product ID is required' });
		}

		// Delete product-related records
		await db.delete(table.productConstructionType).where(
			eq(table.productConstructionType.productId, productId)
		);
		await db.delete(table.projectProduct).where(
			eq(table.projectProduct.productId, productId)
		);
		await db.delete(table.productKitItem).where(
			eq(table.productKitItem.productId, productId)
		);
		// Set orderItem productId to null
		await db
			.update(table.orderItem)
			.set({ productId: null })
			.where(eq(table.orderItem.productId, productId));
		// Delete the product
		await db.delete(table.product).where(eq(table.product.id, productId));

		return { success: true };
	}
};
