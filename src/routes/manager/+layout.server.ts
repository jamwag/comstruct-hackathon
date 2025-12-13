import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { desc, eq } from 'drizzle-orm';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}
	// Allow both manager (procurement) and project_manager roles
	if (locals.user.role !== 'manager' && locals.user.role !== 'project_manager') {
		throw redirect(302, '/worker');
	}

	let projects: { id: string; name: string }[];

	if (locals.user.role === 'manager') {
		// Procurement sees all projects
		projects = await db
			.select({
				id: table.project.id,
				name: table.project.name
			})
			.from(table.project)
			.orderBy(desc(table.project.createdAt));
	} else {
		// Project managers see only their assigned projects
		const assignedProjects = await db
			.select({
				id: table.project.id,
				name: table.project.name
			})
			.from(table.projectManagerAssignment)
			.innerJoin(table.project, eq(table.projectManagerAssignment.projectId, table.project.id))
			.where(eq(table.projectManagerAssignment.managerId, locals.user.id))
			.orderBy(desc(table.project.createdAt));

		projects = assignedProjects;
	}

	return { user: locals.user, projects };
};
