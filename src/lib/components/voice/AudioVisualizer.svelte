<script lang="ts">
	import { onMount } from 'svelte';

	interface Props {
		stream: MediaStream | null;
		isActive: boolean;
	}

	let { stream, isActive }: Props = $props();

	let canvas: HTMLCanvasElement;
	let animationId: number;
	let analyser: AnalyserNode | null = null;
	let audioContext: AudioContext | null = null;

	onMount(() => {
		return () => {
			if (animationId) {
				cancelAnimationFrame(animationId);
			}
			if (audioContext) {
				audioContext.close();
			}
		};
	});

	$effect(() => {
		if (stream && isActive && canvas) {
			startVisualization();
		} else {
			stopVisualization();
		}
	});

	function startVisualization() {
		if (!stream || !canvas) return;

		audioContext = new AudioContext();
		analyser = audioContext.createAnalyser();
		analyser.fftSize = 256;

		const source = audioContext.createMediaStreamSource(stream);
		source.connect(analyser);

		const bufferLength = analyser.frequencyBinCount;
		const dataArray = new Uint8Array(bufferLength);

		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		const draw = () => {
			if (!isActive || !analyser) {
				stopVisualization();
				return;
			}

			animationId = requestAnimationFrame(draw);

			analyser.getByteFrequencyData(dataArray);

			const width = canvas.width;
			const height = canvas.height;

			// Clear canvas
			ctx.fillStyle = 'rgb(243, 244, 246)'; // gray-100
			ctx.fillRect(0, 0, width, height);

			// Draw bars
			const barCount = 12;
			const barWidth = (width / barCount) * 0.6;
			const gap = (width / barCount) * 0.4;
			const step = Math.floor(bufferLength / barCount);

			for (let i = 0; i < barCount; i++) {
				const value = dataArray[i * step];
				const barHeight = (value / 255) * height * 0.8;

				const x = i * (barWidth + gap) + gap / 2;
				const y = (height - barHeight) / 2;

				// Gradient from blue to cyan
				const hue = 200 + (i / barCount) * 20;
				ctx.fillStyle = `hsl(${hue}, 80%, 50%)`;

				// Rounded rectangle
				ctx.beginPath();
				ctx.roundRect(x, y, barWidth, barHeight, 4);
				ctx.fill();
			}
		};

		draw();
	}

	function stopVisualization() {
		if (animationId) {
			cancelAnimationFrame(animationId);
			animationId = 0;
		}

		// Draw idle state
		if (canvas) {
			const ctx = canvas.getContext('2d');
			if (ctx) {
				const width = canvas.width;
				const height = canvas.height;

				ctx.fillStyle = 'rgb(243, 244, 246)';
				ctx.fillRect(0, 0, width, height);

				// Draw static bars at minimum height
				const barCount = 12;
				const barWidth = (width / barCount) * 0.6;
				const gap = (width / barCount) * 0.4;

				for (let i = 0; i < barCount; i++) {
					const x = i * (barWidth + gap) + gap / 2;
					const barHeight = 8;
					const y = (height - barHeight) / 2;

					ctx.fillStyle = 'rgb(209, 213, 219)'; // gray-300
					ctx.beginPath();
					ctx.roundRect(x, y, barWidth, barHeight, 4);
					ctx.fill();
				}
			}
		}
	}
</script>

<canvas bind:this={canvas} width="200" height="60" class="w-full h-15 rounded-lg"></canvas>
