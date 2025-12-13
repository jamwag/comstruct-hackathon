import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';

const STORAGE_KEY = 'managerSelectedProjectId';

function loadSelectedProject(): string | null {
	if (browser) {
		return localStorage.getItem(STORAGE_KEY);
	}
	return null;
}

function createManagerSelectedProjectStore() {
	const { subscribe, set } = writable<string | null>(loadSelectedProject());

	// Persist to localStorage on changes
	if (browser) {
		subscribe((value) => {
			if (value) {
				localStorage.setItem(STORAGE_KEY, value);
			} else {
				localStorage.removeItem(STORAGE_KEY);
			}
		});
	}

	return {
		subscribe,
		set,
		// Initialize with default if not already set or if current is invalid
		initWithDefault: (projects: { id: string }[]) => {
			const current = get({ subscribe });
			if (!current && projects.length > 0) {
				set(projects[0].id);
			} else if (current && !projects.find((p) => p.id === current)) {
				// Current selection is invalid, reset to first
				set(projects[0]?.id || null);
			}
		},
		clear: () => set(null)
	};
}

export const managerSelectedProjectId = createManagerSelectedProjectStore();
