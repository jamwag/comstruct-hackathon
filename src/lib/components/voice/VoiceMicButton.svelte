<script lang="ts">
	import AudioVisualizer from './AudioVisualizer.svelte';
	import TranscriptionDisplay from './TranscriptionDisplay.svelte';
	import ProductRecommendations, { type IndexedProduct } from './ProductRecommendations.svelte';
	import { cart } from '$lib/stores/cart';

	// Type definitions for the voice processing API response
	interface ProductMatch {
		id: string;
		name: string;
		sku: string;
		description: string | null;
		unit: string;
		pricePerUnit: number;
		categoryName: string | null;
		matchScore: number;
		matchReason: string;
	}

	interface Recommendation {
		forItem: string;
		quantity: number;
		products: ProductMatch[];
	}

	// Context product for tracking displayed products
	interface ContextProduct {
		index: number;
		productId: string;
		productName: string;
		sku: string;
		pricePerUnit: number;
		unit: string;
	}

	// Response types from the API
	interface NewSearchResult {
		transcription: string;
		intentType: 'new_search';
		intent: {
			items: Array<{
				description: string;
				quantity: number;
				confidence: number;
			}>;
		};
		recommendations: Recommendation[];
		noMatchMessage: string | null;
	}

	interface SelectProductResult {
		transcription: string;
		intentType: 'select_product';
		addedToCart: {
			productId: string;
			productName: string;
			sku: string;
			pricePerUnit: number;
			unit: string;
			quantity: number;
			confirmationMessage: string;
		};
	}

	interface AddAllResult {
		transcription: string;
		intentType: 'add_all';
		addedProducts: Array<{
			productId: string;
			productName: string;
			sku: string;
			pricePerUnit: number;
			unit: string;
			quantity: number;
		}>;
		confirmationMessage: string;
	}

	interface ClearResult {
		transcription: string;
		intentType: 'clear';
	}

	interface ErrorResult {
		transcription: string;
		intentType: 'error';
		errorMessage: string;
	}

	type ProcessedVoiceResult =
		| NewSearchResult
		| SelectProductResult
		| AddAllResult
		| ClearResult
		| ErrorResult;

	type VoiceState = 'idle' | 'listening' | 'processing' | 'results' | 'error';

	interface Props {
		projectId: string | null;
		disabled?: boolean;
	}

	let { projectId, disabled = false }: Props = $props();

	// State
	let state = $state<VoiceState>('idle');
	let transcription = $state('');
	let recommendations = $state<Recommendation[]>([]);
	let errorMessage = $state('');
	let noMatchMessage = $state<string | null>(null);
	let feedbackMessage = $state<string | null>(null);

	// Conversation context - tracks displayed products for follow-up commands
	let conversationContext = $state<{
		products: ContextProduct[];
	} | null>(null);

	// Audio recording
	let mediaStream = $state<MediaStream | null>(null);
	let mediaRecorder: MediaRecorder | null = null;
	let audioChunks: Blob[] = [];

	// TTS audio element
	let audioElement: HTMLAudioElement | null = null;

	const isListening = $derived(state === 'listening');
	const isProcessing = $derived(state === 'processing');
	const showResults = $derived(state === 'results' && recommendations.length > 0);
	const canInteract = $derived(!disabled && projectId !== null);

	// Handler for when products are indexed by ProductRecommendations
	function handleProductsIndexed(indexed: IndexedProduct[]) {
		if (indexed.length > 0) {
			conversationContext = {
				products: indexed.map((p) => ({
					index: p.index,
					productId: p.productId,
					productName: p.productName,
					sku: p.sku,
					pricePerUnit: p.pricePerUnit,
					unit: p.unit
				}))
			};
		}
	}

	async function startRecording() {
		if (!canInteract) {
			errorMessage = projectId === null ? 'Please select a project first' : 'Voice ordering is disabled';
			state = 'error';
			return;
		}

		try {
			// Request microphone access
			const stream = await navigator.mediaDevices.getUserMedia({
				audio: {
					echoCancellation: true,
					noiseSuppression: true,
					autoGainControl: true
				}
			});

			mediaStream = stream;
			audioChunks = [];

			// Create MediaRecorder
			mediaRecorder = new MediaRecorder(stream, {
				mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
					? 'audio/webm;codecs=opus'
					: 'audio/webm'
			});

			mediaRecorder.ondataavailable = (event) => {
				if (event.data.size > 0) {
					audioChunks.push(event.data);
				}
			};

			mediaRecorder.onstop = () => {
				processRecording();
			};

			// Start recording
			mediaRecorder.start(100); // Collect data every 100ms
			state = 'listening';

			// Haptic feedback
			if (navigator.vibrate) {
				navigator.vibrate(50);
			}
		} catch (err) {
			console.error('Failed to start recording:', err);
			errorMessage = 'Could not access microphone. Please check permissions.';
			state = 'error';
		}
	}

	function stopRecording() {
		if (mediaRecorder && mediaRecorder.state === 'recording') {
			mediaRecorder.stop();
		}

		if (mediaStream) {
			mediaStream.getTracks().forEach((track) => track.stop());
			mediaStream = null;
		}

		// Haptic feedback
		if (navigator.vibrate) {
			navigator.vibrate([50, 50, 50]);
		}
	}

	async function processRecording() {
		if (audioChunks.length === 0) {
			state = 'idle';
			return;
		}

		state = 'processing';
		feedbackMessage = null;

		try {
			// Create audio blob
			const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });

			// Send to server for processing with conversation context
			const formData = new FormData();
			formData.append('audio', audioBlob, 'recording.webm');
			formData.append('projectId', projectId!);

			// Include conversation context if we have products displayed
			if (conversationContext && conversationContext.products.length > 0) {
				formData.append('conversationContext', JSON.stringify(conversationContext));
			}

			const response = await fetch('/api/voice/process', {
				method: 'POST',
				body: formData
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(errorData.message || `Server error: ${response.status}`);
			}

			const result: ProcessedVoiceResult = await response.json();

			// Handle different intent types
			switch (result.intentType) {
				case 'new_search': {
					const searchResult = result as NewSearchResult;
					transcription = searchResult.transcription;
					recommendations = searchResult.recommendations;
					noMatchMessage = searchResult.noMatchMessage;
					state = 'results';

					// Clear previous context since we have new results
					// Context will be rebuilt when ProductRecommendations indexes products

					// If no matches found, play TTS feedback
					if (noMatchMessage) {
						playTTSFeedback(noMatchMessage);
					}
					break;
				}

				case 'select_product': {
					const selectResult = result as SelectProductResult;
					transcription = selectResult.transcription;

					// Add product to cart
					cart.addItem(
						{
							productId: selectResult.addedToCart.productId,
							name: selectResult.addedToCart.productName,
							sku: selectResult.addedToCart.sku,
							pricePerUnit: selectResult.addedToCart.pricePerUnit,
							unit: selectResult.addedToCart.unit
						},
						selectResult.addedToCart.quantity
					);

					// Show feedback message and play TTS
					feedbackMessage = selectResult.addedToCart.confirmationMessage;
					playTTSFeedback(selectResult.addedToCart.confirmationMessage);

					// Keep results displayed, stay in results state
					state = 'results';

					// Haptic feedback for successful add
					if (navigator.vibrate) {
						navigator.vibrate([100, 50, 100]);
					}
					break;
				}

				case 'add_all': {
					const addAllResult = result as AddAllResult;
					transcription = addAllResult.transcription;

					// Add all products to cart
					for (const product of addAllResult.addedProducts) {
						cart.addItem(
							{
								productId: product.productId,
								name: product.productName,
								sku: product.sku,
								pricePerUnit: product.pricePerUnit,
								unit: product.unit
							},
							product.quantity
						);
					}

					// Show feedback and play TTS
					feedbackMessage = addAllResult.confirmationMessage;
					playTTSFeedback(addAllResult.confirmationMessage);

					// Clear results after adding all
					clearResults();
					break;
				}

				case 'clear': {
					transcription = (result as ClearResult).transcription;
					clearResults();
					break;
				}

				case 'error': {
					const errorResult = result as ErrorResult;
					transcription = errorResult.transcription;
					errorMessage = errorResult.errorMessage;
					state = 'error';

					// Play error message via TTS
					playTTSFeedback(errorResult.errorMessage);
					break;
				}

				default: {
					// Fallback for unknown intent type - treat as new search
					transcription = result.transcription;
					state = 'results';
				}
			}
		} catch (err) {
			console.error('Processing error:', err);
			errorMessage = err instanceof Error ? err.message : 'Failed to process voice input';
			state = 'error';
		}
	}

	async function playTTSFeedback(text: string) {
		try {
			const response = await fetch('/api/voice/tts', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ text })
			});

			if (!response.ok) {
				console.error('TTS failed:', response.status);
				return;
			}

			const audioBlob = await response.blob();
			const audioUrl = URL.createObjectURL(audioBlob);

			if (audioElement) {
				audioElement.pause();
			}

			audioElement = new Audio(audioUrl);
			audioElement.play().catch((err) => console.error('Failed to play TTS:', err));

			// Clean up URL after playback
			audioElement.onended = () => {
				URL.revokeObjectURL(audioUrl);
			};
		} catch (err) {
			console.error('TTS error:', err);
		}
	}

	function handleMicClick() {
		if (state === 'listening') {
			stopRecording();
		} else if (state === 'idle' || state === 'error' || state === 'results') {
			// DON'T clear recommendations/context - let the API decide based on intent
			// Only clear transient state
			errorMessage = '';
			feedbackMessage = null;
			noMatchMessage = null;
			startRecording();
		}
	}

	function clearResults() {
		state = 'idle';
		transcription = '';
		recommendations = [];
		errorMessage = '';
		noMatchMessage = null;
		feedbackMessage = null;
		conversationContext = null;
	}

	function getMicButtonClasses(): string {
		const base = 'w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-lg';

		if (!canInteract) {
			return `${base} bg-gray-300 cursor-not-allowed`;
		}

		switch (state) {
			case 'listening':
				return `${base} bg-red-500 hover:bg-red-600 active:scale-95 animate-pulse`;
			case 'processing':
				return `${base} bg-blue-400 cursor-wait`;
			case 'error':
				return `${base} bg-yellow-500 hover:bg-yellow-600 active:scale-95`;
			default:
				return `${base} bg-blue-600 hover:bg-blue-700 active:scale-95`;
		}
	}
</script>

<div class="space-y-4">
	<!-- Main mic button area -->
	<div class="flex flex-col items-center gap-4">
		<!-- Mic button -->
		<button
			onclick={handleMicClick}
			disabled={!canInteract || state === 'processing'}
			class={getMicButtonClasses()}
			aria-label={state === 'listening' ? 'Stop recording' : 'Start voice order'}
		>
			{#if state === 'processing'}
				<!-- Loading spinner -->
				<svg class="animate-spin h-10 w-10 text-white" viewBox="0 0 24 24" fill="none">
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
					></circle>
					<path
						class="opacity-75"
						fill="currentColor"
						d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
					></path>
				</svg>
			{:else if state === 'listening'}
				<!-- Stop icon -->
				<svg class="h-10 w-10 text-white" fill="currentColor" viewBox="0 0 24 24">
					<rect x="6" y="6" width="12" height="12" rx="2" />
				</svg>
			{:else}
				<!-- Microphone icon -->
				<svg class="h-10 w-10 text-white" fill="currentColor" viewBox="0 0 24 24">
					<path
						d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"
					/>
				</svg>
			{/if}
		</button>

		<!-- Status text -->
		<div class="text-center">
			{#if !canInteract}
				<p class="text-gray-500 text-sm">
					{projectId === null ? 'Select a project to enable voice ordering' : 'Voice ordering disabled'}
				</p>
			{:else if state === 'listening'}
				<p class="text-red-600 font-medium">Tap to stop recording</p>
			{:else if state === 'processing'}
				<p class="text-blue-600 font-medium">Processing...</p>
			{:else if state === 'error'}
				<p class="text-yellow-600 font-medium">Tap to try again</p>
			{:else if showResults}
				<p class="text-gray-600">Say a number to order, or search for something new</p>
			{:else}
				<p class="text-gray-600">Tap and tell me what you need</p>
			{/if}
		</div>
	</div>

	<!-- Audio visualizer -->
	{#if state === 'listening'}
		<AudioVisualizer stream={mediaStream} isActive={isListening} />
	{/if}

	<!-- Transcription display -->
	{#if transcription || isListening || isProcessing}
		<TranscriptionDisplay text={transcription} {isProcessing} {isListening} />
	{/if}

	<!-- Feedback message (for successful actions) -->
	{#if feedbackMessage}
		<div class="bg-green-50 border border-green-200 rounded-lg p-4">
			<div class="flex items-center gap-2 text-green-700">
				<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
				</svg>
				<span>{feedbackMessage}</span>
			</div>
		</div>
	{/if}

	<!-- Error message -->
	{#if state === 'error' && errorMessage}
		<div class="bg-red-50 border border-red-200 rounded-lg p-4">
			<div class="flex items-center gap-2 text-red-700">
				<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
					/>
				</svg>
				<span>{errorMessage}</span>
			</div>
		</div>
	{/if}

	<!-- No match message (separate from error) -->
	{#if state === 'results' && noMatchMessage && recommendations.every((r) => r.products.length === 0)}
		<div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
			<div class="flex items-start gap-3">
				<svg class="h-6 w-6 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
				</svg>
				<div>
					<p class="text-yellow-800">{noMatchMessage}</p>
					<button
						onclick={clearResults}
						class="mt-2 text-sm text-yellow-700 underline hover:text-yellow-900"
					>
						Try a different search
					</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Product recommendations -->
	{#if showResults}
		<ProductRecommendations
			{recommendations}
			onClear={clearResults}
			onProductsIndexed={handleProductsIndexed}
		/>
	{/if}
</div>
