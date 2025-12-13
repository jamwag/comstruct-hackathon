import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { desc, eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const user = locals.user!;

	let projects: typeof table.project.$inferSelect[];

	if (user.role === 'manager') {
		// Procurement sees all projects
		projects = await db
			.select()
			.from(table.project)
			.orderBy(desc(table.project.createdAt));
	} else {
		// Project managers see only their assigned projects
		const assignedProjects = await db
			.select({ project: table.project })
			.from(table.projectManagerAssignment)
			.innerJoin(table.project, eq(table.projectManagerAssignment.projectId, table.project.id))
			.where(eq(table.projectManagerAssignment.managerId, user.id))
			.orderBy(desc(table.project.createdAt));

		projects = assignedProjects.map((row) => row.project);
	}

	return { projects, userRole: user.role };
};
