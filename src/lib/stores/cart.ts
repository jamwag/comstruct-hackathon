import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';

export interface CartItem {
	productId: string;
	name: string;
	sku: string;
	quantity: number;
	pricePerUnit: number; // in cents
	unit: string;
}

export interface CartState {
	items: CartItem[];
	note: string | null;
	priority: 'normal' | 'urgent';
}

// Load cart from localStorage if available
function loadCart(): CartItem[] {
	if (browser) {
		const stored = localStorage.getItem('cart');
		if (stored) {
			try {
				return JSON.parse(stored);
			} catch {
				return [];
			}
		}
	}
	return [];
}

function loadNote(): string | null {
	if (browser) {
		return localStorage.getItem('cart_note') || null;
	}
	return null;
}

function loadPriority(): 'normal' | 'urgent' {
	if (browser) {
		const stored = localStorage.getItem('cart_priority');
		return stored === 'urgent' ? 'urgent' : 'normal';
	}
	return 'normal';
}

// Create the cart store
function createCart() {
	const initialState: CartState = {
		items: loadCart(),
		note: loadNote(),
		priority: loadPriority()
	};

	const { subscribe, set, update } = writable<CartState>(initialState);

	// Persist to localStorage on changes
	if (browser) {
		subscribe((state) => {
			localStorage.setItem('cart', JSON.stringify(state.items));
			if (state.note) {
				localStorage.setItem('cart_note', state.note);
			} else {
				localStorage.removeItem('cart_note');
			}
			localStorage.setItem('cart_priority', state.priority);
		});
	}

	return {
		subscribe,

		// Add item to cart
		addItem: (item: Omit<CartItem, 'quantity'>, quantity: number = 1) => {
			update((state) => {
				const existing = state.items.find((i) => i.productId === item.productId);
				if (existing) {
					existing.quantity += quantity;
					return { ...state, items: [...state.items] };
				}
				return { ...state, items: [...state.items, { ...item, quantity }] };
			});
		},

		// Update quantity by product ID
		updateQuantity: (productId: string, quantity: number) => {
			update((state) => {
				if (quantity <= 0) {
					return { ...state, items: state.items.filter((i) => i.productId !== productId) };
				}
				const item = state.items.find((i) => i.productId === productId);
				if (item) {
					item.quantity = quantity;
				}
				return { ...state, items: [...state.items] };
			});
		},

		// Remove item by product ID
		removeItem: (productId: string) => {
			update((state) => ({
				...state,
				items: state.items.filter((i) => i.productId !== productId)
			}));
		},

		// Clear entire cart including note and priority
		clear: () => {
			set({ items: [], note: null, priority: 'normal' });
		},

		// Clear only items, keep note and priority
		clearItems: () => {
			update((state) => ({ ...state, items: [] }));
		},

		// Calculate total in cents
		getTotal: (items: CartItem[]) => {
			return items.reduce((sum, item) => sum + item.pricePerUnit * item.quantity, 0);
		},

		// Get total item count
		getItemCount: (items: CartItem[]) => {
			return items.reduce((sum, item) => sum + item.quantity, 0);
		},

		// ===== Voice Cart Management Methods =====

		// Find item by name (fuzzy search)
		findItemByName: (searchTerm: string): CartItem | null => {
			const state = get({ subscribe });
			const term = searchTerm.toLowerCase();
			return (
				state.items.find(
					(i) => i.name.toLowerCase().includes(term) || i.sku.toLowerCase().includes(term)
				) || null
			);
		},

		// Remove item by name (fuzzy search)
		removeByName: (searchTerm: string): CartItem | null => {
			let removed: CartItem | null = null;
			update((state) => {
				const term = searchTerm.toLowerCase();
				const index = state.items.findIndex(
					(i) => i.name.toLowerCase().includes(term) || i.sku.toLowerCase().includes(term)
				);
				if (index !== -1) {
					removed = state.items[index];
					return {
						...state,
						items: state.items.filter((_, i) => i !== index)
					};
				}
				return state;
			});
			return removed;
		},

		// Update quantity by name (fuzzy search)
		updateQuantityByName: (searchTerm: string, quantity: number): CartItem | null => {
			let updated: CartItem | null = null;
			update((state) => {
				const term = searchTerm.toLowerCase();
				const item = state.items.find(
					(i) => i.name.toLowerCase().includes(term) || i.sku.toLowerCase().includes(term)
				);
				if (item) {
					if (quantity <= 0) {
						updated = { ...item };
						return {
							...state,
							items: state.items.filter((i) => i.productId !== item.productId)
						};
					}
					item.quantity = quantity;
					updated = { ...item };
					return { ...state, items: [...state.items] };
				}
				return state;
			});
			return updated;
		},

		// ===== Voice Notes Methods =====

		// Set order note
		setNote: (note: string | null) => {
			update((state) => ({ ...state, note }));
		},

		// Set order priority
		setPriority: (priority: 'normal' | 'urgent') => {
			update((state) => ({ ...state, priority }));
		},

		// Get current state (for reading cart contents)
		getState: (): CartState => {
			return get({ subscribe });
		}
	};
}

export const cart = createCart();
