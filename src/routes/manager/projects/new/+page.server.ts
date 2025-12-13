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

		await db.insert(table.project).values({
			id: projectId,
			name: name.trim(),
			address: typeof address === 'string' && address.trim() ? address.trim() : null,
			createdBy: locals.user?.id ?? null
		});

		throw redirect(302, `/manager?project=${projectId}`);
	}
};

function generateId() {
	const bytes = crypto.getRandomValues(new Uint8Array(15));
	return encodeBase32LowerCase(bytes);
}
