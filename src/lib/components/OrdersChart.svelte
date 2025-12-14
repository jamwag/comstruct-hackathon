<script lang="ts">
	import { onMount, onDestroy, untrack } from 'svelte';
	import { Chart, registerables } from 'chart.js';

	Chart.register(...registerables);

	type DailyData = {
		date: string;
		orderCount: number;
		totalSpend: number;
	};

	let { data }: { data: DailyData[] } = $props();

	let canvas = $state<HTMLCanvasElement | null>(null);
	let chart: Chart | null = null;

	function formatDate(dateStr: string, includeYear = false): string {
		const date = new Date(dateStr);
		if (includeYear) {
			return date.toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: '2-digit' });
		}
		return date.toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit' });
	}

	function createChart() {
		if (!canvas || data.length === 0) return;

		// For longer ranges, include year in date and show fewer ticks
		const includeYear = data.length > 60;
		const maxTicks = data.length > 180 ? 12 : data.length > 60 ? 15 : 10;

		const labels = data.map(d => formatDate(d.date, includeYear));
		const orderCounts = data.map(d => d.orderCount);
		const spendData = data.map(d => d.totalSpend / 100); // Convert cents to CHF

		// Thinner lines for longer ranges
		const borderWidth = data.length > 60 ? 1.5 : 2;
		const pointRadius = data.length > 60 ? 0 : 3;

		chart = new Chart(canvas, {
			type: 'line',
			data: {
				labels,
				datasets: [
					{
						label: 'Orders',
						data: orderCounts,
						borderColor: 'rgb(59, 130, 246)',
						backgroundColor: 'rgba(59, 130, 246, 0.1)',
						fill: true,
						tension: 0.3,
						borderWidth,
						pointRadius,
						yAxisID: 'y'
					},
					{
						label: 'Spend (CHF)',
						data: spendData,
						borderColor: 'rgb(34, 197, 94)',
						backgroundColor: 'rgba(34, 197, 94, 0.1)',
						fill: true,
						tension: 0.3,
						borderWidth,
						pointRadius,
						yAxisID: 'y1'
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				interaction: {
					mode: 'index',
					intersect: false
				},
				plugins: {
					legend: {
						position: 'top',
						labels: {
							usePointStyle: true,
							padding: 15
						}
					},
					tooltip: {
						callbacks: {
							label: function(context) {
								const label = context.dataset.label || '';
								const value = context.parsed.y ?? 0;
								if (label === 'Spend (CHF)') {
									return `${label}: CHF ${value.toFixed(2)}`;
								}
								return `${label}: ${value}`;
							}
						}
					}
				},
				scales: {
					x: {
						grid: {
							display: false
						},
						ticks: {
							maxRotation: 45,
							minRotation: 45,
							maxTicksLimit: maxTicks
						}
					},
					y: {
						type: 'linear',
						display: true,
						position: 'left',
						title: {
							display: true,
							text: 'Orders',
							color: 'rgb(59, 130, 246)'
						},
						ticks: {
							color: 'rgb(59, 130, 246)',
							stepSize: 1
						},
						grid: {
							color: 'rgba(0, 0, 0, 0.05)'
						},
						beginAtZero: true
					},
					y1: {
						type: 'linear',
						display: true,
						position: 'right',
						title: {
							display: true,
							text: 'CHF',
							color: 'rgb(34, 197, 94)'
						},
						ticks: {
							color: 'rgb(34, 197, 94)',
							callback: function(value) {
								return 'CHF ' + value;
							}
						},
						grid: {
							drawOnChartArea: false
						},
						beginAtZero: true
					}
				}
			}
		});
	}

	onMount(() => {
		createChart();
	});

	onDestroy(() => {
		if (chart) {
			chart.destroy();
			chart = null;
		}
	});

	// Recreate chart when data changes
	$effect(() => {
		// Track data changes
		const currentData = data;
		untrack(() => {
			if (currentData && chart) {
				chart.destroy();
				createChart();
			}
		});
	});
</script>

<div class="h-64">
	{#if data.length === 0}
		<div class="h-full flex items-center justify-center text-gray-500">
			No order data available for the last 30 days
		</div>
	{:else}
		<canvas bind:this={canvas}></canvas>
	{/if}
</div>
