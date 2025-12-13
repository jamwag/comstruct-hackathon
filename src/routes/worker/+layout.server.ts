import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}
	if (locals.user.role !== 'worker') {
		throw redirect(302, '/manager');
	}

	// Get worker's assigned projects for the project selector
	const workerProjects = await db
		.select({
			project: table.project
		})
		.from(table.projectWorker)
		.innerJoin(table.project, eq(table.projectWorker.projectId, table.project.id))
		.where(eq(table.projectWorker.workerId, locals.user.id));

	const projects = workerProjects.map((wp) => wp.project);

	return {
		user: locals.user,
		projects
	};
};
