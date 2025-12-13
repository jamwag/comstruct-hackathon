import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { eq, desc } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const user = locals.user!;

	// Get all orders for this worker with project info
	const ordersWithProjects = await db
		.select({
			order: table.order,
			project: table.project
		})
		.from(table.order)
		.innerJoin(table.project, eq(table.order.projectId, table.project.id))
		.where(eq(table.order.workerId, user.id))
		.orderBy(desc(table.order.createdAt));

	// Fetch order items and supplier responses for each order
	const ordersWithItems = await Promise.all(
		ordersWithProjects.map(async ({ order, project }) => {
			const items = await db
				.select({
					id: table.orderItem.id,
					productId: table.orderItem.productId,
					productName: table.product.name,
					quantity: table.orderItem.quantity,
					pricePerUnit: table.orderItem.pricePerUnit,
					totalCents: table.orderItem.totalCents
				})
				.from(table.orderItem)
				.innerJoin(table.product, eq(table.orderItem.productId, table.product.id))
				.where(eq(table.orderItem.orderId, order.id));

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
				.where(eq(table.orderSupplierResponse.orderId, order.id));

			return { order, project, items, supplierResponses };
		})
	);

	return {
		orders: ordersWithItems
	};
};
