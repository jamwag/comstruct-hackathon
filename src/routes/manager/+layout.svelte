<script lang="ts">
	import { enhance } from '$app/forms';
	import type { Snippet } from 'svelte';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: Snippet } = $props();
</script>

<!-- Manager dashboard layout -->
<div class="min-h-screen bg-gray-50 flex">
	<aside class="w-64 bg-white border-r min-h-screen p-4 flex flex-col">
		<h1 class="text-xl font-bold text-gray-900 mb-6">ComStruct</h1>
		<nav class="space-y-1 flex-1">
			<a
				href="/manager"
				class="block px-3 py-2 rounded-md hover:bg-gray-100 text-gray-700 font-medium"
			>
				Dashboard
			</a>
			<a
				href="/manager/projects"
				class="block px-3 py-2 rounded-md hover:bg-gray-100 text-gray-700 font-medium"
			>
				Projects
			</a>
			<a
				href="/manager/suppliers"
				class="block px-3 py-2 rounded-md hover:bg-gray-100 text-gray-700 font-medium"
			>
				Suppliers
			</a>
			<a
				href="/manager/products"
				class="block px-3 py-2 rounded-md hover:bg-gray-100 text-gray-700 font-medium"
			>
				Products
			</a>
		</nav>
		<div class="border-t pt-4">
			<div class="text-sm text-gray-600 mb-2">{data.user.username}</div>
			<form method="post" action="/logout" use:enhance>
				<button
					class="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md"
				>
					Sign out
				</button>
			</form>
		</div>
	</aside>

	<div class="flex-1">
		<header class="bg-white border-b px-6 py-4">
			<h2 class="text-lg font-semibold text-gray-900">Manager Portal</h2>
		</header>

		<main class="p-6">
			{@render children()}
		</main>
	</div>
</div>
