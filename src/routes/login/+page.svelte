<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
</script>

<svelte:head>
	<title>Login - ComStruct</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center bg-gray-50 px-4">
	<div class="max-w-md w-full space-y-8">
		<div class="text-center">
			<h1 class="text-3xl font-bold text-gray-900">Sign In</h1>
			<p class="mt-2 text-gray-600">Welcome back to ComStruct</p>
		</div>

		<form method="post" use:enhance class="space-y-6">
			<div>
				<label for="username" class="block text-sm font-medium text-gray-700">Username</label>
				<input
					id="username"
					name="username"
					type="text"
					required
					autocomplete="username"
					class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
				/>
			</div>

			<div>
				<label for="password" class="block text-sm font-medium text-gray-700">Password</label>
				<input
					id="password"
					name="password"
					type="password"
					required
					autocomplete="current-password"
					class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
				/>
			</div>

			{#if form?.message}
				<p class="text-red-600 text-sm">{form.message}</p>
			{/if}

			<button
				type="submit"
				class="w-full rounded-md bg-blue-600 py-3 text-white font-medium hover:bg-blue-700 transition-colors"
			>
				Sign In
			</button>

			<p class="text-center text-sm text-gray-600">
				Don't have an account?
				<a href="/register" class="text-blue-600 hover:underline">Register</a>
			</p>
		</form>
	</div>
</div>
