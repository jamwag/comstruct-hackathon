import { error, fail } from '@sveltejs/kit';
import { eq, and, asc } from 'drizzle-orm';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
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

	return {
		project,
		allWorkers,
		assignedWorkerIds: Array.from(assignedWorkerIds),
		allProducts,
		assignedProductIds,
		categories
	};
};

export const actions: Actions = {
	assign: async ({ params, request }) => {
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

	unassign: async ({ params, request }) => {
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

	assignProduct: async ({ params, request }) => {
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

	unassignProduct: async ({ params, request }) => {
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

	updateThreshold: async ({ params, request }) => {
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
	}
};
