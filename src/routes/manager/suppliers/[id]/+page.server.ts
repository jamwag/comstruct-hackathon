import { error, fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const [supplier] = await db.select().from(table.supplier).where(eq(table.supplier.id, params.id));

	if (!supplier) {
		throw error(404, 'Supplier not found');
	}

	return { supplier };
};

export const actions: Actions = {
	update: async ({ params, request }) => {
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

		await db
			.update(table.supplier)
			.set({
				name: name.trim(),
				contactEmail:
					typeof contactEmail === 'string' && contactEmail.trim() ? contactEmail.trim() : null,
				shopUrl: typeof shopUrl === 'string' && shopUrl.trim() ? shopUrl.trim() : null
			})
			.where(eq(table.supplier.id, params.id));

		throw redirect(302, '/manager/suppliers');
	}
};
