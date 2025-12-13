import { fail } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const statusFilter = url.searchParams.get('status') || 'pending';
	const projectId = url.searchParams.get('project');

	// Build filter conditions
	let whereCondition;
	if (projectId && statusFilter !== 'all') {
		whereCondition = and(
			eq(table.order.projectId, projectId),
			eq(table.order.status, statusFilter as 'pending' | 'approved' | 'rejected')
		);
	} else if (projectId) {
		whereCondition = eq(table.order.projectId, projectId);
	} else if (statusFilter !== 'all') {
		whereCondition = eq(table.order.status, statusFilter as 'pending' | 'approved' | 'rejected');
	}

	// Get all orders with related data
	const ordersQuery = await db
		.select({
			order: table.order,
			project: table.project,
			worker: table.user
		})
		.from(table.order)
		.innerJoin(table.project, eq(table.order.projectId, table.project.id))
		.innerJoin(table.user, eq(table.order.workerId, table.user.id))
		.where(whereCondition)
		.orderBy(desc(table.order.createdAt));

	// Get order items and supplier responses for each order
	const ordersWithItems = await Promise.all(
		ordersQuery.map(async (row) => {
			const items = await db
				.select({
					orderItem: table.orderItem,
					product: table.product
				})
				.from(table.orderItem)
				.innerJoin(table.product, eq(table.orderItem.productId, table.product.id))
				.where(eq(table.orderItem.orderId, row.order.id));

			// Fetch supplier responses for this order
			const supplierResponses = await db
				.select({
					id: table.orderSupplierResponse.id,
					status: table.orderSupplierResponse.status,
					deliveryDate: table.orderSupplierResponse.deliveryDate,
					message: table.orderSupplierResponse.message,
					receivedAt: table.orderSupplierResponse.receivedAt,
					supplierName: table.supplier.name,
					supplierEmail: table.supplier.contactEmail
				})
				.from(table.orderSupplierResponse)
				.innerJoin(table.supplier, eq(table.orderSupplierResponse.supplierId, table.supplier.id))
				.where(eq(table.orderSupplierResponse.orderId, row.order.id));

			return {
				...row,
				items: items.map((i) => ({
					...i.orderItem,
					product: i.product
				})),
				supplierResponses
			};
		})
	);

	return {
		orders: ordersWithItems,
		statusFilter,
		projectId
	};
};

export const actions: Actions = {
	approve: async ({ request, locals }) => {
		const user = locals.user!;
		const formData = await request.formData();
		const orderId = formData.get('orderId') as string;

		if (!orderId) {
			return fail(400, { message: 'Missing order ID' });
		}

		await db
			.update(table.order)
			.set({
				status: 'approved',
				approvedAt: new Date(),
				approvedBy: user.id
			})
			.where(eq(table.order.id, orderId));

		return { success: true, action: 'approved' };
	},

	reject: async ({ request, locals }) => {
		const user = locals.user!;
		const formData = await request.formData();
		const orderId = formData.get('orderId') as string;
		const reason = formData.get('reason') as string;

		if (!orderId) {
			return fail(400, { message: 'Missing order ID' });
		}

		await db
			.update(table.order)
			.set({
				status: 'rejected',
				rejectionReason: reason || 'No reason provided'
			})
			.where(eq(table.order.id, orderId));

		return { success: true, action: 'rejected' };
	}
};
