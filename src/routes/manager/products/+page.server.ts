import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { desc, eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, parent }) => {
	const { user } = await parent();
	const categoryFilter = url.searchParams.get('category');
	const supplierFilter = url.searchParams.get('supplier');

	// Get all products with joins
	let query = db
		.select({
			product: table.product,
			supplier: table.supplier,
			category: table.productCategory
		})
		.from(table.product)
		.leftJoin(table.supplier, eq(table.product.supplierId, table.supplier.id))
		.leftJoin(table.productCategory, eq(table.product.categoryId, table.productCategory.id))
		.orderBy(desc(table.product.createdAt))
		.$dynamic();

	// Note: filtering can be added with .where() if needed

	const products = await query;

	// Get categories and suppliers for filter dropdowns
	const categories = await db.select().from(table.productCategory).orderBy(table.productCategory.sortOrder);
	const suppliers = await db.select().from(table.supplier).orderBy(table.supplier.name);

	return {
		products,
		categories,
		suppliers,
		user,
		filters: {
			category: categoryFilter,
			supplier: supplierFilter
		}
	};
};

export const actions: Actions = {
	deleteAll: async () => {
		// Delete all dependent records first (foreign key constraints)
		await db.delete(table.productConstructionType);
		await db.delete(table.projectProduct);
		await db.delete(table.productKitItem);
		// Set orderItem productId to null (they reference products but can be null for PunchOut)
		await db.update(table.orderItem).set({ productId: null });
		// Delete all products
		await db.delete(table.product);

		return { success: true };
	}
};
