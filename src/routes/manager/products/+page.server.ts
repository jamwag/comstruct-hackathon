import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { desc, eq, and, asc, gte, lte, like, inArray, notInArray, or } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, parent }) => {
	const { user } = await parent();

	// Get current project from URL params
	const projectId = url.searchParams.get('project');

	// Get filter params
	const supplierFilter = url.searchParams.get('supplier');
	const categoryFilter = url.searchParams.get('category');
	const priceMin = url.searchParams.get('priceMin');
	const priceMax = url.searchParams.get('priceMax');
	const searchTerm = url.searchParams.get('search');
	const assignedFilter = url.searchParams.get('assigned') || 'all';

	// Get assigned product IDs for the current project
	let assignedProductIds: string[] = [];
	let project = null;

	if (projectId) {
		const [foundProject] = await db
			.select()
			.from(table.project)
			.where(eq(table.project.id, projectId));
		project = foundProject;

		const assignedProductRows = await db
			.select({ productId: table.projectProduct.productId })
			.from(table.projectProduct)
			.where(eq(table.projectProduct.projectId, projectId));

		assignedProductIds = assignedProductRows.map((r) => r.productId);
	}

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

	// Assignment status filter (only if project is selected)
	if (projectId) {
		if (assignedFilter === 'assigned' && assignedProductIds.length > 0) {
			conditions.push(inArray(table.product.id, assignedProductIds));
		} else if (assignedFilter === 'unassigned') {
			if (assignedProductIds.length > 0) {
				conditions.push(notInArray(table.product.id, assignedProductIds));
			}
		}
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

	// Get categories and suppliers for filter dropdowns
	const categories = await db.select().from(table.productCategory).orderBy(table.productCategory.sortOrder);
	const suppliers = await db.select().from(table.supplier).orderBy(table.supplier.name);

	return {
		products,
		categories,
		suppliers,
		user,
		project,
		projectId,
		assignedProductIds,
		filters: {
			category: categoryFilter,
			supplier: supplierFilter,
			priceMin,
			priceMax,
			search: searchTerm,
			assigned: assignedFilter
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
	},

	assignBulk: async ({ url, request }) => {
		const projectId = url.searchParams.get('project');
		if (!projectId) {
			return { error: 'No project selected' };
		}

		const formData = await request.formData();
		const productIds = formData.getAll('productId');

		if (productIds.length === 0) {
			return { error: 'No products selected' };
		}

		// Get already assigned products
		const existingAssignments = await db
			.select({ productId: table.projectProduct.productId })
			.from(table.projectProduct)
			.where(eq(table.projectProduct.projectId, projectId));

		const existingIds = new Set(existingAssignments.map((r) => r.productId));

		// Filter out already assigned products
		const newProductIds = productIds.filter(
			(id) => typeof id === 'string' && !existingIds.has(id)
		);

		if (newProductIds.length > 0) {
			await db.insert(table.projectProduct).values(
				newProductIds.map((productId) => ({
					projectId,
					productId: productId as string
				}))
			);
		}

		return { success: true, assigned: newProductIds.length };
	},

	unassignBulk: async ({ url, request }) => {
		const projectId = url.searchParams.get('project');
		if (!projectId) {
			return { error: 'No project selected' };
		}

		const formData = await request.formData();
		const productIds = formData.getAll('productId');

		if (productIds.length === 0) {
			return { error: 'No products selected' };
		}

		const validIds = productIds.filter((id): id is string => typeof id === 'string');

		if (validIds.length > 0) {
			await db
				.delete(table.projectProduct)
				.where(
					and(
						eq(table.projectProduct.projectId, projectId),
						inArray(table.projectProduct.productId, validIds)
					)
				);
		}

		return { success: true, unassigned: validIds.length };
	},

	assignProduct: async ({ url, request }) => {
		const projectId = url.searchParams.get('project');
		if (!projectId) {
			return { error: 'No project selected' };
		}

		const formData = await request.formData();
		const productId = formData.get('productId');

		if (!productId || typeof productId !== 'string') {
			return { error: 'No product specified' };
		}

		// Check if already assigned
		const existing = await db
			.select()
			.from(table.projectProduct)
			.where(
				and(
					eq(table.projectProduct.projectId, projectId),
					eq(table.projectProduct.productId, productId)
				)
			);

		if (existing.length === 0) {
			await db.insert(table.projectProduct).values({
				projectId,
				productId
			});
		}

		return { success: true };
	},

	unassignProduct: async ({ url, request }) => {
		const projectId = url.searchParams.get('project');
		if (!projectId) {
			return { error: 'No project selected' };
		}

		const formData = await request.formData();
		const productId = formData.get('productId');

		if (!productId || typeof productId !== 'string') {
			return { error: 'No product specified' };
		}

		await db
			.delete(table.projectProduct)
			.where(
				and(
					eq(table.projectProduct.projectId, projectId),
					eq(table.projectProduct.productId, productId)
				)
			);

		return { success: true };
	}
};
