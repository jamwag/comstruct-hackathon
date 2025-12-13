import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export interface CartItem {
	productId: string;
	name: string;
	sku: string;
	quantity: number;
	pricePerUnit: number; // in cents
	unit: string;
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

// Create the cart store
function createCart() {
	const { subscribe, set, update } = writable<CartItem[]>(loadCart());

	// Persist to localStorage on changes
	if (browser) {
		subscribe((items) => {
			localStorage.setItem('cart', JSON.stringify(items));
		});
	}

	return {
		subscribe,
		addItem: (item: Omit<CartItem, 'quantity'>, quantity: number = 1) => {
			update((items) => {
				const existing = items.find((i) => i.productId === item.productId);
				if (existing) {
					existing.quantity += quantity;
					return [...items];
				}
				return [...items, { ...item, quantity }];
			});
		},
		updateQuantity: (productId: string, quantity: number) => {
			update((items) => {
				if (quantity <= 0) {
					return items.filter((i) => i.productId !== productId);
				}
				const item = items.find((i) => i.productId === productId);
				if (item) {
					item.quantity = quantity;
				}
				return [...items];
			});
		},
		removeItem: (productId: string) => {
			update((items) => items.filter((i) => i.productId !== productId));
		},
		clear: () => {
			set([]);
		},
		getTotal: (items: CartItem[]) => {
			return items.reduce((sum, item) => sum + item.pricePerUnit * item.quantity, 0);
		},
		getItemCount: (items: CartItem[]) => {
			return items.reduce((sum, item) => sum + item.quantity, 0);
		}
	};
}

export const cart = createCart();
