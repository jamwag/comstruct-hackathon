import { fail, redirect } from '@sveltejs/kit';
import { encodeBase32LowerCase } from '@oslojs/encoding';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const user = locals.user!;
	const projectId = url.searchParams.get('project');

	if (!projectId) {
		throw redirect(302, '/worker/order');
	}

	// Verify worker is assigned to this project
	const assignment = await db
		.select()
		.from(table.projectWorker)
		.where(eq(table.projectWorker.workerId, user.id))
		.innerJoin(table.project, eq(table.projectWorker.projectId, table.project.id));

	const projectAssignment = assignment.find((a) => a.project.id === projectId);
	if (!projectAssignment) {
		throw redirect(302, '/worker/order');
	}

	return {
		project: projectAssignment.project
	};
};

export const actions: Actions = {
	submit: async ({ request, locals }) => {
		const user = locals.user!;
		const formData = await request.formData();
		const projectId = formData.get('projectId') as string;
		const cartJson = formData.get('cart') as string;
		const notes = (formData.get('notes') as string) || null;
		const priority = (formData.get('priority') as string) === 'urgent' ? 'urgent' : 'normal';

		if (!projectId || !cartJson) {
			return fail(400, { message: 'Missing required data' });
		}

		let cartItems: Array<{
			productId: string;
			name: string;
			quantity: number;
			pricePerUnit: number;
		}>;

		try {
			cartItems = JSON.parse(cartJson);
		} catch {
			return fail(400, { message: 'Invalid cart data' });
		}

		if (cartItems.length === 0) {
			return fail(400, { message: 'Cart is empty' });
		}

		// Get project to check threshold
		const projects = await db
			.select()
			.from(table.project)
			.where(eq(table.project.id, projectId))
			.limit(1);

		if (projects.length === 0) {
			return fail(400, { message: 'Project not found' });
		}

		const project = projects[0];

		// Calculate total
		const totalCents = cartItems.reduce(
			(sum, item) => sum + item.pricePerUnit * item.quantity,
			0
		);

		// Determine if auto-approved
		const threshold = project.autoApprovalThreshold ?? 20000; // Default 200 CHF
		const isAutoApproved = totalCents <= threshold;

		// Create order
		const orderId = generateId();

		await db.insert(table.order).values({
			id: orderId,
			projectId,
			workerId: user.id,
			status: isAutoApproved ? 'approved' : 'pending',
			totalCents,
			approvedAt: isAutoApproved ? new Date() : null,
			approvedBy: isAutoApproved ? user.id : null, // Self-approved for auto
			notes: notes || null,
			priority
		});

		// Create order items
		for (const item of cartItems) {
			await db.insert(table.orderItem).values({
				id: generateId(),
				orderId,
				productId: item.productId,
				quantity: item.quantity,
				pricePerUnit: item.pricePerUnit,
				totalCents: item.pricePerUnit * item.quantity
			});
		}

		return {
			success: true,
			orderId,
			isAutoApproved,
			totalCents
		};
	}
};

function generateId() {
	const bytes = crypto.getRandomValues(new Uint8Array(15));
	return encodeBase32LowerCase(bytes);
}
