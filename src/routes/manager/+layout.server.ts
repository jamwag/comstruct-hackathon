import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { desc } from 'drizzle-orm';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}
	// Allow both manager (procurement) and project_manager roles
	if (locals.user.role !== 'manager' && locals.user.role !== 'project_manager') {
		throw redirect(302, '/worker');
	}

	// Fetch all projects for the project selector
	const projects = await db
		.select({
			id: table.project.id,
			name: table.project.name
		})
		.from(table.project)
		.orderBy(desc(table.project.createdAt));

	return { user: locals.user, projects };
};
