import { error, fail } from '@sveltejs/kit';
import { eq, and } from 'drizzle-orm';
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

	return {
		project,
		allWorkers,
		assignedWorkerIds: Array.from(assignedWorkerIds)
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
	}
};
