import { json, error } from '@sveltejs/kit';
import { encodeBase32LowerCase } from '@oslojs/encoding';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { generateOrderNumber, sendOrderWebhooks } from '$lib/server/webhook';
import type { RequestHandler } from './$types';

function generateId() {
	const bytes = crypto.getRandomValues(new Uint8Array(15));
	return encodeBase32LowerCase(bytes);
}

export const POST: RequestHandler = async ({ request, locals }) => {
	const user = locals.user;
	if (!user || user.role !== 'worker') {
		throw error(401, 'Unauthorized');
	}

	const body = await request.json();
	const { projectId, items, notes } = body as {
		projectId: string;
		items: Array<{ productId: string; quantity: number }>;
		notes?: string;
	};

	if (!projectId || !items || items.length === 0) {
		throw error(400, 'Missing projectId or items');
	}

	// Verify worker is assigned to this project
	const assignment = await db
		.select()
		.from(table.projectWorker)
		.where(
			and(
				eq(table.projectWorker.workerId, user.id),
				eq(table.projectWorker.projectId, projectId)
			)
		)
		.limit(1);

	if (assignment.length === 0) {
		throw error(403, 'Not assigned to this project');
	}

	// Get project for threshold
	const projects = await db
		.select()
		.from(table.project)
		.where(eq(table.project.id, projectId))
		.limit(1);

	if (projects.length === 0) {
		throw error(404, 'Project not found');
	}

	const project = projects[0];

	// Get product details
	const productIds = items.map((i) => i.productId);
	const products = await db
		.select()
		.from(table.product)
		.where(eq(table.product.id, productIds[0])); // TODO: use inArray for multiple

	// For now, fetch all and filter (simple approach)
	const allProducts = await db.select().from(table.product);
	const productMap = new Map(allProducts.map((p) => [p.id, p]));

	// Calculate total
	let totalCents = 0;
	const orderItems: Array<{
		productId: string;
		quantity: number;
		pricePerUnit: number;
		name: string;
	}> = [];

	for (const item of items) {
		const product = productMap.get(item.productId);
		if (!product) {
			throw error(400, `Product not found: ${item.productId}`);
		}
		totalCents += product.pricePerUnit * item.quantity;
		orderItems.push({
			productId: item.productId,
			quantity: item.quantity,
			pricePerUnit: product.pricePerUnit,
			name: product.name
		});
	}

	// Determine if auto-approved
	const threshold = project.autoApprovalThreshold ?? 20000;
	const isAutoApproved = totalCents <= threshold;

	// Create order
	const orderId = generateId();
	const orderNumber = await generateOrderNumber();

	await db.insert(table.order).values({
		id: orderId,
		orderNumber,
		projectId,
		workerId: user.id,
		status: isAutoApproved ? 'approved' : 'pending',
		totalCents,
		approvedAt: isAutoApproved ? new Date() : null,
		approvedBy: isAutoApproved ? user.id : null,
		notes: notes || null,
		priority: 'normal'
	});

	// Create order items
	for (const item of orderItems) {
		await db.insert(table.orderItem).values({
			id: generateId(),
			orderId,
			productId: item.productId,
			quantity: item.quantity,
			pricePerUnit: item.pricePerUnit,
			totalCents: item.pricePerUnit * item.quantity
		});
	}

	// Send webhook (fire-and-forget)
	sendOrderWebhooks(orderId).catch((err) => {
		console.error('Failed to send order webhooks:', err);
	});

	return json({
		success: true,
		orderId,
		orderNumber,
		isAutoApproved,
		totalCents
	});
};
