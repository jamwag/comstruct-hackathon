import { error, fail } from '@sveltejs/kit';
import { eq, and, asc, gte, lte, like, inArray, notInArray, or } from 'drizzle-orm';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, url }) => {
	// Get project
	const [project] = await db
		.select()
		.from(table.project)
		.where(eq(table.project.id, params.id));

	if (!project) {
		throw error(404, 'Project not found');
	}

	// Get filter params
	const supplierFilter = url.searchParams.get('supplier');
	const categoryFilter = url.searchParams.get('category');
	const priceMin = url.searchParams.get('priceMin');
	const priceMax = url.searchParams.get('priceMax');
	const searchTerm = url.searchParams.get('search');
	const assignedFilter = url.searchParams.get('assigned') || 'all'; // all, assigned, unassigned

	// Get assigned product IDs for this project
	const assignedProductRows = await db
		.select({ productId: table.projectProduct.productId })
		.from(table.projectProduct)
		.where(eq(table.projectProduct.projectId, params.id));

	const assignedProductIds = assignedProductRows.map((r) => r.productId);

	// Build where conditions
	const conditions = [];

	if (supplierFilter) {
		conditions.push(eq(table.product.supplierId, supplierFilter));
	}

	if (categoryFilter) {
		conditions.push(eq(table.product.categoryId, categoryFilter));
	}

	if (priceMin) {
		const minCents = Math.round(parseFloat(priceMin) * 100);
		if (!isNaN(minCents)) {
			conditions.push(gte(table.product.pricePerUnit, minCents));
		}
	}

	if (priceMax) {
		const maxCents = Math.round(parseFloat(priceMax) * 100);
		if (!isNaN(maxCents)) {
			conditions.push(lte(table.product.pricePerUnit, maxCents));
		}
	}

	if (searchTerm) {
		const searchPattern = `%${searchTerm}%`;
		conditions.push(
			or(
				like(table.product.name, searchPattern),
				like(table.product.sku, searchPattern)
			)
		);
	}

	// Assignment status filter
	if (assignedFilter === 'assigned' && assignedProductIds.length > 0) {
		conditions.push(inArray(table.product.id, assignedProductIds));
	} else if (assignedFilter === 'unassigned') {
		if (assignedProductIds.length > 0) {
			conditions.push(notInArray(table.product.id, assignedProductIds));
		}
		// If no assigned products, all products are unassigned - no filter needed
	}

	// Query products with filters
	let query = db
		.select({
			product: table.product,
			supplier: table.supplier,
			category: table.productCategory
		})
		.from(table.product)
		.leftJoin(table.supplier, eq(table.product.supplierId, table.supplier.id))
		.leftJoin(table.productCategory, eq(table.product.categoryId, table.productCategory.id))
		.orderBy(asc(table.productCategory.sortOrder), asc(table.product.name));

	if (conditions.length > 0) {
		query = query.where(and(...conditions)) as typeof query;
	}

	const products = await query;

	// Get all suppliers for filter dropdown
	const suppliers = await db
		.select()
		.from(table.supplier)
		.orderBy(asc(table.supplier.name));

	// Get all categories for filter dropdown
	const categories = await db
		.select()
		.from(table.productCategory)
		.orderBy(asc(table.productCategory.sortOrder));

	return {
		project,
		products,
		suppliers,
		categories,
		assignedProductIds,
		filters: {
			supplier: supplierFilter,
			category: categoryFilter,
			priceMin,
			priceMax,
			search: searchTerm,
			assigned: assignedFilter
		}
	};
};

export const actions: Actions = {
	assignBulk: async ({ params, request }) => {
		const formData = await request.formData();
		const productIds = formData.getAll('productId');

		if (productIds.length === 0) {
			return fail(400, { message: 'No products selected' });
		}

		// Get already assigned products
		const existingAssignments = await db
			.select({ productId: table.projectProduct.productId })
			.from(table.projectProduct)
			.where(eq(table.projectProduct.projectId, params.id));

		const existingIds = new Set(existingAssignments.map((r) => r.productId));

		// Filter out already assigned products
		const newProductIds = productIds.filter(
			(id) => typeof id === 'string' && !existingIds.has(id)
		);

		if (newProductIds.length > 0) {
			await db.insert(table.projectProduct).values(
				newProductIds.map((productId) => ({
					projectId: params.id,
					productId: productId as string
				}))
			);
		}

		return { success: true, assigned: newProductIds.length };
	},

	unassignBulk: async ({ params, request }) => {
		const formData = await request.formData();
		const productIds = formData.getAll('productId');

		if (productIds.length === 0) {
			return fail(400, { message: 'No products selected' });
		}

		const validIds = productIds.filter((id): id is string => typeof id === 'string');

		if (validIds.length > 0) {
			await db
				.delete(table.projectProduct)
				.where(
					and(
						eq(table.projectProduct.projectId, params.id),
						inArray(table.projectProduct.productId, validIds)
					)
				);
		}

		return { success: true, unassigned: validIds.length };
	}
};
