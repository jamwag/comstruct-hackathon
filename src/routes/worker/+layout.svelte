<script lang="ts">
	import { enhance } from '$app/forms';
	import type { Snippet } from 'svelte';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: Snippet } = $props();
</script>

<!-- Mobile-first worker layout -->
<div class="min-h-screen bg-gray-100">
	<header class="bg-blue-600 text-white px-4 py-3 flex justify-between items-center">
		<h1 class="text-lg font-bold">ComStruct</h1>
		<div class="flex items-center gap-3">
			<span class="text-sm">{data.user.username}</span>
			<form method="post" action="/logout" use:enhance>
				<button class="text-sm bg-blue-700 px-3 py-1 rounded hover:bg-blue-800 transition-colors">
					Logout
				</button>
			</form>
		</div>
	</header>

	<nav class="bg-white border-b px-4 py-2 flex gap-4">
		<a href="/worker" class="text-blue-600 font-medium hover:underline">Dashboard</a>
	</nav>

	<main class="p-4">
		{@render children()}
	</main>
</div>
