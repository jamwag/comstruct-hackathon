import { fail, redirect } from '@sveltejs/kit';
import { encodeBase32LowerCase } from '@oslojs/encoding';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	return {};
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const formData = await request.formData();
		const name = formData.get('name');
		const address = formData.get('address');

		if (typeof name !== 'string' || name.trim().length === 0) {
			return fail(400, { message: 'Project name is required' });
		}

		const projectId = generateId();
		const user = locals.user!;

		await db.insert(table.project).values({
			id: projectId,
			name: name.trim(),
			address: typeof address === 'string' && address.trim() ? address.trim() : null,
			createdBy: user.id
		});

		// Auto-assign project manager to their created project
		if (user.role === 'project_manager') {
			await db.insert(table.projectManagerAssignment).values({
				projectId,
				managerId: user.id
			});
		}

		throw redirect(302, `/manager/projects/${projectId}`);
	}
};

function generateId() {
	const bytes = crypto.getRandomValues(new Uint8Array(15));
	return encodeBase32LowerCase(bytes);
}
