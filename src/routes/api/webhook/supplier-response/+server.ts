import { json } from '@sveltejs/kit';
import { encodeBase32LowerCase } from '@oslojs/encoding';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import type { RequestHandler } from './$types';

interface SupplierResponsePayload {
	output: {
		order_id: string;
		supplier_email: string;
		status: string;
		delivery_date?: string;
		message?: string;
	};
}

function generateId() {
	const bytes = crypto.getRandomValues(new Uint8Array(15));
	return encodeBase32LowerCase(bytes);
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		// Log raw body for debugging
		const rawBody = await request.text();
		console.log('Received webhook body:', rawBody);

		if (!rawBody || rawBody.trim() === '') {
			return json({ error: 'Empty request body' }, { status: 400 });
		}

		let payload: SupplierResponsePayload;
		try {
			payload = JSON.parse(rawBody);
		} catch (parseError) {
			console.error('JSON parse error:', parseError);
			return json({ error: 'Invalid JSON body', received: rawBody.substring(0, 200) }, { status: 400 });
		}

		const { order_id, supplier_email, status, delivery_date, message } = payload.output;

		// Validate required fields
		if (!order_id || !supplier_email || !status) {
			return json(
				{ error: 'Missing required fields: order_id, supplier_email, status' },
				{ status: 400 }
			);
		}

		// Normalize order_id (remove # prefix if present)
		const orderNumber = order_id.startsWith('#') ? order_id : `#${order_id}`;

		// Normalize status to lowercase
		const normalizedStatus = status.toLowerCase();
		if (!['confirmed', 'rejected', 'partial'].includes(normalizedStatus)) {
			return json(
				{ error: `Invalid status: ${status}. Must be one of: confirmed, rejected, partial` },
				{ status: 400 }
			);
		}

		// Look up order by orderNumber
		const orders = await db
			.select()
			.from(table.order)
			.where(eq(table.order.orderNumber, orderNumber))
			.limit(1);

		if (orders.length === 0) {
			return json({ error: `Order not found: ${order_id}` }, { status: 404 });
		}

		const order = orders[0];

		// Look up supplier by contactEmail
		const suppliers = await db
			.select()
			.from(table.supplier)
			.where(eq(table.supplier.contactEmail, supplier_email))
			.limit(1);

		if (suppliers.length === 0) {
			return json({ error: `Supplier not found with email: ${supplier_email}` }, { status: 404 });
		}

		const supplier = suppliers[0];

		// Parse delivery date if provided
		let deliveryDate: Date | null = null;
		if (delivery_date) {
			deliveryDate = new Date(delivery_date);
			if (isNaN(deliveryDate.getTime())) {
				return json({ error: `Invalid delivery_date format: ${delivery_date}` }, { status: 400 });
			}
		}

		// Check if a response already exists for this order/supplier combination
		const existingResponses = await db
			.select()
			.from(table.orderSupplierResponse)
			.where(
				and(
					eq(table.orderSupplierResponse.orderId, order.id),
					eq(table.orderSupplierResponse.supplierId, supplier.id)
				)
			)
			.limit(1);

		if (existingResponses.length > 0) {
			// Update existing response
			await db
				.update(table.orderSupplierResponse)
				.set({
					status: normalizedStatus as 'confirmed' | 'rejected' | 'partial',
					deliveryDate,
					message: message || null,
					receivedAt: new Date()
				})
				.where(eq(table.orderSupplierResponse.id, existingResponses[0].id));

			console.log(
				`Updated supplier response for order ${orderNumber} from ${supplier.name} (${supplier_email})`
			);
		} else {
			// Insert new response
			await db.insert(table.orderSupplierResponse).values({
				id: generateId(),
				orderId: order.id,
				supplierId: supplier.id,
				status: normalizedStatus as 'confirmed' | 'rejected' | 'partial',
				deliveryDate,
				message: message || null
			});

			console.log(
				`Recorded supplier response for order ${orderNumber} from ${supplier.name} (${supplier_email})`
			);
		}

		return json({
			success: true,
			order_id: orderNumber,
			supplier: supplier.name,
			status: normalizedStatus
		});
	} catch (error) {
		console.error('Error processing supplier response webhook:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
