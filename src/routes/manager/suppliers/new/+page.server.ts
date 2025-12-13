import { fail, redirect } from '@sveltejs/kit';
import { encodeBase32LowerCase } from '@oslojs/encoding';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	// Procurement-only route
	if (locals.user?.role !== 'manager') {
		throw redirect(302, '/manager');
	}
	return {};
};

export const actions: Actions = {
	default: async ({ request }) => {
		const formData = await request.formData();
		const name = formData.get('name');
		const contactEmail = formData.get('contactEmail');
		const shopUrl = formData.get('shopUrl');

		if (typeof name !== 'string' || name.trim().length === 0) {
			return fail(400, { message: 'Supplier name is required' });
		}

		// Validate shopUrl if provided
		if (typeof shopUrl === 'string' && shopUrl.trim()) {
			try {
				new URL(shopUrl.trim());
			} catch {
				return fail(400, { message: 'Invalid shop URL format' });
			}
		}

		const supplierId = generateId();

		await db.insert(table.supplier).values({
			id: supplierId,
			name: name.trim(),
			contactEmail: typeof contactEmail === 'string' && contactEmail.trim() ? contactEmail.trim() : null,
			shopUrl: typeof shopUrl === 'string' && shopUrl.trim() ? shopUrl.trim() : null
		});

		throw redirect(302, `/manager/suppliers/${supplierId}`);
	}
};

function generateId() {
	const bytes = crypto.getRandomValues(new Uint8Array(15));
	return encodeBase32LowerCase(bytes);
}
