import { error, fail } from '@sveltejs/kit';
import { eq, and, asc, max, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const [project] = await db
		.select()
		.from(table.project)
		.where(eq(table.project.id, params.id));

	if (!project) {
		throw error(404, 'Project not found');
	}

	// Get all workers
	const allWorkers = await db
		.select({ id: table.user.id, username: table.user.username })
		.from(table.user)
		.where(eq(table.user.role, 'worker'));

	// Get assigned worker IDs for this project
	const assignedWorkerRows = await db
		.select({ workerId: table.projectWorker.workerId })
		.from(table.projectWorker)
		.where(eq(table.projectWorker.projectId, params.id));

	const assignedWorkerIds = new Set(assignedWorkerRows.map((r) => r.workerId));

	// Get all products with categories
	const allProducts = await db
		.select({
			product: table.product,
			category: table.productCategory
		})
		.from(table.product)
		.leftJoin(table.productCategory, eq(table.product.categoryId, table.productCategory.id))
		.orderBy(asc(table.productCategory.sortOrder), asc(table.product.name));

	// Get assigned product IDs for this project
	const assignedProductRows = await db
		.select({ productId: table.projectProduct.productId })
		.from(table.projectProduct)
		.where(eq(table.projectProduct.projectId, params.id));

	const assignedProductIds = assignedProductRows.map((r) => r.productId);

	// Get categories for grouping
	const categories = await db
		.select()
		.from(table.productCategory)
		.orderBy(asc(table.productCategory.sortOrder));

	// Get project suppliers with ranking (for project managers)
	const projectSuppliers = await db
		.select({
			supplier: table.supplier,
			preferenceRank: table.projectSupplier.preferenceRank
		})
		.from(table.projectSupplier)
		.innerJoin(table.supplier, eq(table.projectSupplier.supplierId, table.supplier.id))
		.where(eq(table.projectSupplier.projectId, params.id))
		.orderBy(asc(table.projectSupplier.preferenceRank));

	// Get all suppliers for adding new ones
	const allSuppliers = await db
		.select()
		.from(table.supplier)
		.orderBy(asc(table.supplier.name));

	// Get IDs of already assigned suppliers
	const assignedSupplierIds = new Set(projectSuppliers.map((ps) => ps.supplier.id));

	// Available suppliers are those not yet assigned
	const availableSuppliers = allSuppliers.filter((s) => !assignedSupplierIds.has(s.id));

	return {
		project,
		allWorkers,
		assignedWorkerIds: Array.from(assignedWorkerIds),
		allProducts,
		assignedProductIds,
		categories,
		projectSuppliers,
		availableSuppliers,
		userRole: locals.user?.role
	};
};

export const actions: Actions = {
	assign: async ({ params, request, locals }) => {
		// Only procurement can assign workers
		if (locals.user?.role !== 'manager') {
			return fail(403, { message: 'Not authorized' });
		}

		const formData = await request.formData();
		const workerId = formData.get('workerId');

		if (typeof workerId !== 'string') {
			return fail(400, { message: 'Invalid worker ID' });
		}

		// Check if already assigned
		const [existing] = await db
			.select()
			.from(table.projectWorker)
			.where(
				and(
					eq(table.projectWorker.projectId, params.id),
					eq(table.projectWorker.workerId, workerId)
				)
			);

		if (!existing) {
			await db.insert(table.projectWorker).values({
				projectId: params.id,
				workerId
			});
		}

		return { success: true };
	},

	unassign: async ({ params, request, locals }) => {
		// Only procurement can unassign workers
		if (locals.user?.role !== 'manager') {
			return fail(403, { message: 'Not authorized' });
		}

		const formData = await request.formData();
		const workerId = formData.get('workerId');

		if (typeof workerId !== 'string') {
			return fail(400, { message: 'Invalid worker ID' });
		}

		await db
			.delete(table.projectWorker)
			.where(
				and(
					eq(table.projectWorker.projectId, params.id),
					eq(table.projectWorker.workerId, workerId)
				)
			);

		return { success: true };
	},

	assignProduct: async ({ params, request, locals }) => {
		// Only procurement can assign products
		if (locals.user?.role !== 'manager') {
			return fail(403, { message: 'Not authorized' });
		}

		const formData = await request.formData();
		const productId = formData.get('productId');

		if (typeof productId !== 'string') {
			return fail(400, { message: 'Invalid product ID' });
		}

		// Check if already assigned
		const [existing] = await db
			.select()
			.from(table.projectProduct)
			.where(
				and(
					eq(table.projectProduct.projectId, params.id),
					eq(table.projectProduct.productId, productId)
				)
			);

		if (!existing) {
			await db.insert(table.projectProduct).values({
				projectId: params.id,
				productId
			});
		}

		return { success: true };
	},

	unassignProduct: async ({ params, request, locals }) => {
		// Only procurement can unassign products
		if (locals.user?.role !== 'manager') {
			return fail(403, { message: 'Not authorized' });
		}

		const formData = await request.formData();
		const productId = formData.get('productId');

		if (typeof productId !== 'string') {
			return fail(400, { message: 'Invalid product ID' });
		}

		await db
			.delete(table.projectProduct)
			.where(
				and(
					eq(table.projectProduct.projectId, params.id),
					eq(table.projectProduct.productId, productId)
				)
			);

		return { success: true };
	},

	updateThreshold: async ({ params, request, locals }) => {
		// Only procurement can update threshold
		if (locals.user?.role !== 'manager') {
			return fail(403, { message: 'Not authorized' });
		}

		const formData = await request.formData();
		const thresholdStr = formData.get('threshold');

		if (typeof thresholdStr !== 'string') {
			return fail(400, { message: 'Invalid threshold value' });
		}

		const thresholdChf = parseFloat(thresholdStr);
		if (isNaN(thresholdChf) || thresholdChf < 0) {
			return fail(400, { message: 'Threshold must be a positive number' });
		}

		// Convert to cents
		const thresholdCents = Math.round(thresholdChf * 100);

		await db
			.update(table.project)
			.set({ autoApprovalThreshold: thresholdCents })
			.where(eq(table.project.id, params.id));

		return { success: true, thresholdUpdated: true };
	},

	addProjectSupplier: async ({ params, request, locals }) => {
		// Only project managers can manage supplier preferences
		if (locals.user?.role !== 'project_manager') {
			return fail(403, { message: 'Not authorized' });
		}

		const formData = await request.formData();
		const supplierId = formData.get('supplierId');

		if (typeof supplierId !== 'string' || !supplierId) {
			return fail(400, { message: 'Please select a supplier' });
		}

		// Get the current max rank for this project
		const [maxRankResult] = await db
			.select({ maxRank: max(table.projectSupplier.preferenceRank) })
			.from(table.projectSupplier)
			.where(eq(table.projectSupplier.projectId, params.id));

		const nextRank = (maxRankResult?.maxRank ?? 0) + 1;

		await db.insert(table.projectSupplier).values({
			projectId: params.id,
			supplierId,
			preferenceRank: nextRank
		});

		return { success: true };
	},

	removeProjectSupplier: async ({ params, request, locals }) => {
		// Only project managers can manage supplier preferences
		if (locals.user?.role !== 'project_manager') {
			return fail(403, { message: 'Not authorized' });
		}

		const formData = await request.formData();
		const supplierId = formData.get('supplierId');

		if (typeof supplierId !== 'string') {
			return fail(400, { message: 'Invalid supplier ID' });
		}

		await db
			.delete(table.projectSupplier)
			.where(
				and(
					eq(table.projectSupplier.projectId, params.id),
					eq(table.projectSupplier.supplierId, supplierId)
				)
			);

		return { success: true };
	},

	moveSupplierUp: async ({ params, request, locals }) => {
		// Only project managers can manage supplier preferences
		if (locals.user?.role !== 'project_manager') {
			return fail(403, { message: 'Not authorized' });
		}

		const formData = await request.formData();
		const supplierId = formData.get('supplierId');

		if (typeof supplierId !== 'string') {
			return fail(400, { message: 'Invalid supplier ID' });
		}

		// Get current supplier's rank
		const [current] = await db
			.select({ preferenceRank: table.projectSupplier.preferenceRank })
			.from(table.projectSupplier)
			.where(
				and(
					eq(table.projectSupplier.projectId, params.id),
					eq(table.projectSupplier.supplierId, supplierId)
				)
			);

		if (!current || current.preferenceRank <= 1) {
			return { success: true }; // Already at top
		}

		// Swap with the supplier above
		const targetRank = current.preferenceRank - 1;

		// Update the supplier above to take this one's rank
		await db
			.update(table.projectSupplier)
			.set({ preferenceRank: current.preferenceRank })
			.where(
				and(
					eq(table.projectSupplier.projectId, params.id),
					eq(table.projectSupplier.preferenceRank, targetRank)
				)
			);

		// Update this supplier to the target rank
		await db
			.update(table.projectSupplier)
			.set({ preferenceRank: targetRank })
			.where(
				and(
					eq(table.projectSupplier.projectId, params.id),
					eq(table.projectSupplier.supplierId, supplierId)
				)
			);

		return { success: true };
	},

	moveSupplierDown: async ({ params, request, locals }) => {
		// Only project managers can manage supplier preferences
		if (locals.user?.role !== 'project_manager') {
			return fail(403, { message: 'Not authorized' });
		}

		const formData = await request.formData();
		const supplierId = formData.get('supplierId');

		if (typeof supplierId !== 'string') {
			return fail(400, { message: 'Invalid supplier ID' });
		}

		// Get current supplier's rank
		const [current] = await db
			.select({ preferenceRank: table.projectSupplier.preferenceRank })
			.from(table.projectSupplier)
			.where(
				and(
					eq(table.projectSupplier.projectId, params.id),
					eq(table.projectSupplier.supplierId, supplierId)
				)
			);

		if (!current) {
			return { success: true };
		}

		// Get max rank
		const [maxResult] = await db
			.select({ maxRank: max(table.projectSupplier.preferenceRank) })
			.from(table.projectSupplier)
			.where(eq(table.projectSupplier.projectId, params.id));

		if (current.preferenceRank >= (maxResult?.maxRank ?? 0)) {
			return { success: true }; // Already at bottom
		}

		// Swap with the supplier below
		const targetRank = current.preferenceRank + 1;

		// Update the supplier below to take this one's rank
		await db
			.update(table.projectSupplier)
			.set({ preferenceRank: current.preferenceRank })
			.where(
				and(
					eq(table.projectSupplier.projectId, params.id),
					eq(table.projectSupplier.preferenceRank, targetRank)
				)
			);

		// Update this supplier to the target rank
		await db
			.update(table.projectSupplier)
			.set({ preferenceRank: targetRank })
			.where(
				and(
					eq(table.projectSupplier.projectId, params.id),
					eq(table.projectSupplier.supplierId, supplierId)
				)
			);

		return { success: true };
	}
};
