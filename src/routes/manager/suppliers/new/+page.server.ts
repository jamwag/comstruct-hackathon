import { fail, redirect } from '@sveltejs/kit';
import { encodeBase32LowerCase } from '@oslojs/encoding';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	return {};
};

export const actions: Actions = {
	default: async ({ request }) => {
		const formData = await request.formData();
		const name = formData.get('name');
		const contactEmail = formData.get('contactEmail');

		if (typeof name !== 'string' || name.trim().length === 0) {
			return fail(400, { message: 'Supplier name is required' });
		}

		const supplierId = generateId();

		await db.insert(table.supplier).values({
			id: supplierId,
			name: name.trim(),
			contactEmail: typeof contactEmail === 'string' && contactEmail.trim() ? contactEmail.trim() : null
		});

		throw redirect(302, '/manager/suppliers');
	}
};

function generateId() {
	const bytes = crypto.getRandomValues(new Uint8Array(15));
	return encodeBase32LowerCase(bytes);
}
