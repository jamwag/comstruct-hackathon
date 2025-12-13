import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { eq, sql } from 'drizzle-orm';

const WEBHOOK_URL = 'https://jansouidi.app.n8n.cloud/webhook/order-webhook';

export interface WebhookOrderItem {
	article_id: string;
	name: string;
	quantity: number;
	unit: string;
	price_per_unit: string;
	total_price: string;
}

export interface WebhookPayload {
	order_number: string;
	created_at: string;
	project_name: string;
	project_address: string;
	supplier_email: string;
	supplier_name: string;
	internal_note: string;
	items: WebhookOrderItem[];
	total_order_value: string;
	currency: string;
}

/**
 * Formats cents to CHF currency string (e.g., 1250 -> "12.50 CHF")
 */
export function formatCurrency(cents: number): string {
	const amount = (cents / 100).toFixed(2);
	return `${amount} CHF`;
}

/**
 * Generates an order number in format #ORD-YYYY-NNN
 */
export async function generateOrderNumber(): Promise<string> {
	const now = new Date();
	const year = now.getFullYear();

	// Count orders from current year
	const result = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(table.order)
		.where(sql`EXTRACT(YEAR FROM ${table.order.createdAt}) = ${year}`);

	const nextNumber = (result[0]?.count || 0) + 1;
	const paddedNumber = String(nextNumber).padStart(3, '0');

	return `#ORD-${year}-${paddedNumber}`;
}

/**
 * Fetches complete order data with items, products, suppliers, and project
 */
export async function fetchOrderWithDetails(orderId: string) {
	// Fetch order with project
	const orderData = await db
		.select({
			order: table.order,
			project: table.project
		})
		.from(table.order)
		.innerJoin(table.project, eq(table.order.projectId, table.project.id))
		.where(eq(table.order.id, orderId))
		.limit(1);

	if (orderData.length === 0) {
		throw new Error(`Order not found: ${orderId}`);
	}

	// Fetch order items with products and suppliers
	const itemsData = await db
		.select({
			orderItem: table.orderItem,
			product: table.product,
			supplier: table.supplier
		})
		.from(table.orderItem)
		.innerJoin(table.product, eq(table.orderItem.productId, table.product.id))
		.innerJoin(table.supplier, eq(table.product.supplierId, table.supplier.id))
		.where(eq(table.orderItem.orderId, orderId));

	return {
		order: orderData[0].order,
		project: orderData[0].project,
		items: itemsData
	};
}

/**
 * Sends a single webhook payload
 */
export async function sendOrderWebhook(payload: WebhookPayload): Promise<boolean> {
	try {
		const response = await fetch(WEBHOOK_URL, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(payload)
		});

		if (!response.ok) {
			console.error(
				`Webhook failed for order ${payload.order_number} to ${payload.supplier_name}:`,
				response.status,
				await response.text()
			);
			return false;
		}

		console.log(
			`Webhook sent successfully for order ${payload.order_number} to ${payload.supplier_name}`
		);
		return true;
	} catch (error) {
		console.error(`Webhook error for order ${payload.order_number}:`, error);
		return false;
	}
}

/**
 * Groups order items by supplier and sends webhook to each supplier
 */
export async function sendOrderWebhooks(orderId: string): Promise<void> {
	const orderData = await fetchOrderWithDetails(orderId);
	const { order, project, items } = orderData;

	// Group items by supplier
	const itemsBySupplier = new Map<
		string,
		{
			supplier: typeof items[0]['supplier'];
			items: typeof items;
		}
	>();

	for (const item of items) {
		const supplierId = item.supplier.id;
		if (!itemsBySupplier.has(supplierId)) {
			itemsBySupplier.set(supplierId, {
				supplier: item.supplier,
				items: []
			});
		}
		itemsBySupplier.get(supplierId)!.items.push(item);
	}

	// Send webhook for each supplier
	const webhookPromises = Array.from(itemsBySupplier.values()).map(
		async ({ supplier, items: supplierItems }) => {
			const supplierTotal = supplierItems.reduce(
				(sum, item) => sum + item.orderItem.totalCents,
				0
			);

			const payload: WebhookPayload = {
				order_number: order.orderNumber,
				created_at: order.createdAt.toISOString(),
				project_name: project.name,
				project_address: project.address || '',
				supplier_email: supplier.contactEmail || '',
				supplier_name: supplier.name,
				internal_note: order.notes || '',
				items: supplierItems.map((item) => ({
					article_id: item.product.sku,
					name: item.product.name,
					quantity: item.orderItem.quantity,
					unit: item.product.unit,
					price_per_unit: formatCurrency(item.orderItem.pricePerUnit),
					total_price: formatCurrency(item.orderItem.totalCents)
				})),
				total_order_value: formatCurrency(supplierTotal),
				currency: 'CHF'
			};

			await sendOrderWebhook(payload);
		}
	);

	await Promise.allSettled(webhookPromises);
}
