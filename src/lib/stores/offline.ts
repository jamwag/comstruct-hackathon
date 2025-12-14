import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';

export interface QueuedOrder {
	id: string;
	projectId: string;
	items: Array<{
		productId: string;
		name: string;
		sku: string;
		quantity: number;
		pricePerUnit: number;
		unit: string;
	}>;
	notes: string | null;
	priority: 'normal' | 'urgent';
	queuedAt: number;
	retryCount: number;
	kitName?: string; // Optional - set if this was a kit order
}

interface OfflineState {
	isOnline: boolean;
	pendingOrders: QueuedOrder[];
	isSyncing: boolean;
}

const STORAGE_KEY = 'offline_queue';

function generateId(): string {
	return crypto.randomUUID();
}

function loadQueue(): QueuedOrder[] {
	if (browser) {
		const stored = localStorage.getItem(STORAGE_KEY);
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

function saveQueue(orders: QueuedOrder[]) {
	if (browser) {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
	}
}

function createOfflineStore() {
	const initialState: OfflineState = {
		isOnline: browser ? navigator.onLine : true,
		pendingOrders: loadQueue(),
		isSyncing: false
	};

	const { subscribe, set, update } = writable<OfflineState>(initialState);

	// Set up event listeners for online/offline
	if (browser) {
		window.addEventListener('online', () => {
			update((state) => ({ ...state, isOnline: true }));
			// Auto-process queue when coming back online
			processQueue();
		});

		window.addEventListener('offline', () => {
			update((state) => ({ ...state, isOnline: false }));
		});

		// Retry when page becomes visible (user returns to tab)
		document.addEventListener('visibilitychange', () => {
			if (document.visibilityState === 'visible') {
				update((state) => ({ ...state, isOnline: navigator.onLine }));
				processQueue();
			}
		});

		// Periodic retry every 30 seconds for any pending orders
		setInterval(() => {
			const state = get({ subscribe });
			if (state.pendingOrders.length > 0 && !state.isSyncing && navigator.onLine) {
				console.log('[Offline] Periodic retry triggered');
				processQueue();
			}
		}, 30000);
	}

	async function processQueue() {
		const state = get({ subscribe });

		// Use navigator.onLine directly to avoid race condition with store update
		if (!navigator.onLine || state.isSyncing || state.pendingOrders.length === 0) {
			return;
		}

		update((s) => ({ ...s, isSyncing: true }));

		const ordersToProcess = [...state.pendingOrders];
		const successfulIds: string[] = [];
		const failedOrders: QueuedOrder[] = [];

		for (const order of ordersToProcess) {
			try {
				const response = await fetch('/api/orders', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					credentials: 'include', // Ensure cookies are sent
					body: JSON.stringify({
						projectId: order.projectId,
						items: order.items.map((item) => ({
							productId: item.productId,
							quantity: item.quantity
						})),
						notes: order.kitName ? `${order.kitName}${order.notes ? ` - ${order.notes}` : ''}` : order.notes,
						priority: order.priority
					})
				});

				if (response.ok) {
					successfulIds.push(order.id);
					console.log(`[Offline] Order ${order.id} synced successfully`);
				} else {
					// Server rejected - increment retry count
					console.warn(`[Offline] Order ${order.id} failed with status ${response.status}`);
					failedOrders.push({
						...order,
						retryCount: order.retryCount + 1
					});
				}
			} catch (err) {
				// Network error - keep in queue for retry
				console.error(`[Offline] Order ${order.id} network error:`, err);
				failedOrders.push({
					...order,
					retryCount: order.retryCount + 1
				});
			}
		}

		// Update state and persist
		const remainingOrders = failedOrders.filter((o) => o.retryCount < 5); // Max 5 retries
		saveQueue(remainingOrders);

		console.log(`[Offline] Sync complete: ${successfulIds.length} succeeded, ${remainingOrders.length} remaining`);

		update((s) => ({
			...s,
			pendingOrders: remainingOrders,
			isSyncing: false
		}));

		return successfulIds.length;
	}

	function queueOrder(order: Omit<QueuedOrder, 'id' | 'queuedAt' | 'retryCount'>): string {
		const id = generateId();
		const queuedOrder: QueuedOrder = {
			...order,
			id,
			queuedAt: Date.now(),
			retryCount: 0
		};

		update((state) => {
			const newOrders = [...state.pendingOrders, queuedOrder];
			saveQueue(newOrders);
			return { ...state, pendingOrders: newOrders };
		});

		return id;
	}

	function removeFromQueue(id: string) {
		update((state) => {
			const newOrders = state.pendingOrders.filter((o) => o.id !== id);
			saveQueue(newOrders);
			return { ...state, pendingOrders: newOrders };
		});
	}

	function getPendingCount(): number {
		return get({ subscribe }).pendingOrders.length;
	}

	function getIsOnline(): boolean {
		return get({ subscribe }).isOnline;
	}

	return {
		subscribe,
		queueOrder,
		processQueue,
		removeFromQueue,
		getPendingCount,
		getIsOnline
	};
}

export const offlineStore = createOfflineStore();
