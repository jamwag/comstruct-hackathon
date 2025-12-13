import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';
import { cart } from './cart';

const STORAGE_KEY = 'selectedProjectId';

function loadSelectedProject(): string | null {
	if (browser) {
		return localStorage.getItem(STORAGE_KEY);
	}
	return null;
}

function createSelectedProjectStore() {
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
		set: (projectId: string | null) => {
			const current = get({ subscribe });
			// Clear cart when switching projects
			if (current && projectId && current !== projectId) {
				cart.clear();
			}
			set(projectId);
		},
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

export const selectedProjectId = createSelectedProjectStore();
