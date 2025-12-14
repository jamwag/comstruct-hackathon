import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { order, orderItem, product } from '$lib/server/db/schema';
import { eq, and, desc, gte, lte } from 'drizzle-orm';

export interface OrderHistoryItem {
	productId: string | null;
	productName: string;
	sku: string;
	quantity: number;
	pricePerUnit: number;
	unit: string;
	isPunchout?: boolean;
}

export interface PastOrder {
	orderId: string;
	createdAt: string;
	totalCents: number;
	status: string;
	items: OrderHistoryItem[];
}

/**
 * Parse natural language date references like "last Tuesday" or "two weeks ago"
 */
function parseDateReference(dateRef: string): { start: Date; end: Date } | null {
	const now = new Date();
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const ref = dateRef.toLowerCase().trim();

	// Days of the week
	const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
	const dayIndex = days.findIndex((d) => ref.includes(d));

	if (dayIndex !== -1) {
		// "last Tuesday", "on Tuesday", etc.
		const currentDay = today.getDay();
		let daysAgo = currentDay - dayIndex;
		if (daysAgo <= 0) daysAgo += 7; // Go to previous week if today or future day

		// If "last" is mentioned, ensure we go back at least a week
		if (ref.includes('last') && daysAgo < 7) {
			daysAgo += 7;
		}

		const targetDate = new Date(today);
		targetDate.setDate(targetDate.getDate() - daysAgo);

		return {
			start: targetDate,
			end: new Date(targetDate.getTime() + 24 * 60 * 60 * 1000 - 1) // End of that day
		};
	}

	// "yesterday"
	if (ref.includes('yesterday')) {
		const yesterday = new Date(today);
		yesterday.setDate(yesterday.getDate() - 1);
		return {
			start: yesterday,
			end: new Date(yesterday.getTime() + 24 * 60 * 60 * 1000 - 1)
		};
	}

	// "X days ago"
	const daysAgoMatch = ref.match(/(\d+)\s*days?\s*ago/);
	if (daysAgoMatch) {
		const daysAgo = parseInt(daysAgoMatch[1], 10);
		const targetDate = new Date(today);
		targetDate.setDate(targetDate.getDate() - daysAgo);
		return {
			start: targetDate,
			end: new Date(targetDate.getTime() + 24 * 60 * 60 * 1000 - 1)
		};
	}

	// "last week"
	if (ref.includes('last week')) {
		const startOfLastWeek = new Date(today);
		startOfLastWeek.setDate(startOfLastWeek.getDate() - startOfLastWeek.getDay() - 7);
		const endOfLastWeek = new Date(startOfLastWeek);
		endOfLastWeek.setDate(endOfLastWeek.getDate() + 6);
		endOfLastWeek.setHours(23, 59, 59, 999);
		return {
			start: startOfLastWeek,
			end: endOfLastWeek
		};
	}

	// "two weeks ago", "2 weeks ago"
	const weeksAgoMatch = ref.match(/(\d+|two|three|four)\s*weeks?\s*ago/);
	if (weeksAgoMatch) {
		let weeks = 0;
		const num = weeksAgoMatch[1];
		if (num === 'two') weeks = 2;
		else if (num === 'three') weeks = 3;
		else if (num === 'four') weeks = 4;
		else weeks = parseInt(num, 10);

		const targetDate = new Date(today);
		targetDate.setDate(targetDate.getDate() - weeks * 7);

		// Return a week-long window
		const endDate = new Date(targetDate);
		endDate.setDate(endDate.getDate() + 7);
		return {
			start: targetDate,
			end: endDate
		};
	}

	// "last time" or "previous order" - just get most recent
	if (ref.includes('last time') || ref.includes('previous') || ref.includes('last order')) {
		return null; // Will fetch most recent
	}

	return null;
}

/**
 * GET /api/voice/order-history
 * Fetch user's past orders
 */
export const GET: RequestHandler = async ({ url, locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const projectId = url.searchParams.get('projectId');
	const dateRef = url.searchParams.get('dateRef');
	const limit = parseInt(url.searchParams.get('limit') || '5', 10);

	if (!projectId) {
		throw error(400, 'Project ID is required');
	}

	// Build query conditions
	const conditions = [
		eq(order.workerId, locals.user.id),
		eq(order.projectId, projectId)
	];

	// Parse date reference if provided
	if (dateRef) {
		const dateRange = parseDateReference(dateRef);
		if (dateRange) {
			conditions.push(gte(order.createdAt, dateRange.start));
			conditions.push(lte(order.createdAt, dateRange.end));
		}
	}

	// Fetch orders
	const orders = await db
		.select({
			id: order.id,
			createdAt: order.createdAt,
			totalCents: order.totalCents,
			status: order.status
		})
		.from(order)
		.where(and(...conditions))
		.orderBy(desc(order.createdAt))
		.limit(limit);

	// Fetch items for each order
	const result: PastOrder[] = [];

	for (const o of orders) {
		// Use LEFT JOIN to include PunchOut items (which have null productId)
		const items = await db
			.select({
				productId: orderItem.productId,
				quantity: orderItem.quantity,
				pricePerUnit: orderItem.pricePerUnit,
				productName: product.name,
				productSku: product.sku,
				productUnit: product.unit,
				// PunchOut fields (used when productId is null)
				punchoutName: orderItem.punchoutName,
				punchoutSku: orderItem.punchoutSku,
				punchoutUnit: orderItem.punchoutUnit
			})
			.from(orderItem)
			.leftJoin(product, eq(orderItem.productId, product.id))
			.where(eq(orderItem.orderId, o.id));

		result.push({
			orderId: o.id,
			createdAt: o.createdAt.toISOString(),
			totalCents: o.totalCents,
			status: o.status,
			items: items.map((item) => ({
				productId: item.productId,
				productName: item.productName ?? item.punchoutName ?? 'Unknown',
				sku: item.productSku ?? item.punchoutSku ?? 'N/A',
				quantity: item.quantity,
				pricePerUnit: item.pricePerUnit,
				unit: item.productUnit ?? item.punchoutUnit ?? 'unit',
				isPunchout: item.productId === null
			}))
		});
	}

	// Generate summary for TTS
	let summary = '';
	if (result.length === 0) {
		summary = dateRef
			? `I couldn't find any orders from ${dateRef}.`
			: "You haven't placed any orders yet.";
	} else if (result.length === 1) {
		const o = result[0];
		const date = new Date(o.createdAt);
		const dateStr = date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
		const itemNames = o.items.slice(0, 3).map((i) => `${i.quantity} ${i.productName}`).join(', ');
		const more = o.items.length > 3 ? ` and ${o.items.length - 3} more items` : '';
		summary = `Your order from ${dateStr} had ${itemNames}${more}.`;
	} else {
		summary = `Found ${result.length} orders. The most recent had ${result[0].items.length} items.`;
	}

	return json({
		orders: result,
		summary
	});
};
