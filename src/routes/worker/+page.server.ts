import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	// Projects are already loaded in the layout
	const { projects } = await parent();
	return { projects };
};
