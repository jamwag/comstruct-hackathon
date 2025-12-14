import { fail } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { eq, desc, and, inArray } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { deriveShippingStatus } from '$lib/utils/shipping';

export const load: PageServerLoad = async ({ url, locals }) => {
	const user = locals.user!;
	const statusFilter = url.searchParams.get('status') || 'pending';
	const projectId = url.searchParams.get('project');

	// For project managers, get their assigned project IDs
	let allowedProjectIds: string[] | null = null;
	if (user.role === 'project_manager') {
		const assignments = await db
			.select({ projectId: table.projectManagerAssignment.projectId })
			.from(table.projectManagerAssignment)
			.where(eq(table.projectManagerAssignment.managerId, user.id));
		allowedProjectIds = assignments.map((a) => a.projectId);

		// If PM has no assigned projects, return empty
		if (allowedProjectIds.length === 0) {
			return { orders: [], statusFilter, projectId };
		}
	}

	// Build filter conditions
	const conditions: ReturnType<typeof eq>[] = [];

	// Project filter (either specific or allowed projects for PM)
	if (projectId) {
		// If PM, verify they have access to this project
		if (allowedProjectIds && !allowedProjectIds.includes(projectId)) {
			return { orders: [], statusFilter, projectId };
		}
		conditions.push(eq(table.order.projectId, projectId));
	} else if (allowedProjectIds) {
		// PM without specific project filter - show all their assigned projects
		conditions.push(inArray(table.order.projectId, allowedProjectIds));
	}

	// Status filter
	if (statusFilter !== 'all') {
		conditions.push(eq(table.order.status, statusFilter as 'pending' | 'approved' | 'rejected'));
	}

	const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

	// Get orders with related data
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

			// Compute supplier response summary
			const deliveryDates = supplierResponses
				.filter((r) => r.deliveryDate)
				.map((r) => new Date(r.deliveryDate!));
			const earliestDeliveryDate = deliveryDates.length > 0
				? new Date(Math.min(...deliveryDates.map((d) => d.getTime())))
				: null;

			return {
				...row,
				items: items.map((i) => ({
					...i.orderItem,
					product: i.product
				})),
				supplierResponses,
				supplierResponseSummary: {
					status: deriveShippingStatus(row.order.status, supplierResponses),
					earliestDeliveryDate,
					responseCount: supplierResponses.length
				}
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
