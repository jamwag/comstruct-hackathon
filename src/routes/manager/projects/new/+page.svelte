<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
</script>

<svelte:head>
	<title>New Project - ComStruct</title>
</svelte:head>

<div class="max-w-xl">
	<div class="mb-6">
		<a href="/manager" class="text-blue-600 hover:underline text-sm">&larr; Back to Dashboard</a>
	</div>

	<div class="bg-white rounded-lg shadow p-6">
		<h2 class="text-xl font-bold text-gray-900 mb-6">Create New Project</h2>

		<form method="post" use:enhance class="space-y-4">
			<div>
				<label for="name" class="block text-sm font-medium text-gray-700">Project Name</label>
				<input
					id="name"
					name="name"
					type="text"
					required
					placeholder="e.g., Office Building Munich"
					class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
				/>
			</div>

			<div>
				<label for="address" class="block text-sm font-medium text-gray-700">Address (optional)</label>
				<input
					id="address"
					name="address"
					type="text"
					placeholder="e.g., Leopoldstraße 1, 80802 München"
					class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
				/>
			</div>

			{#if form?.message}
				<p class="text-red-600 text-sm">{form.message}</p>
			{/if}

			<div class="flex gap-3 pt-4">
				<button
					type="submit"
					class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
				>
					Create Project
				</button>
				<a
					href="/manager"
					class="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
				>
					Cancel
				</a>
			</div>
		</form>
	</div>
</div>
