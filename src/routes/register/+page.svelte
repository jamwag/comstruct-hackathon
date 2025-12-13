<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
	let selectedRole = $state<'worker' | 'manager'>('worker');
</script>

<svelte:head>
	<title>Register - ComStruct</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center bg-gray-50 px-4">
	<div class="max-w-md w-full space-y-8">
		<div class="text-center">
			<h1 class="text-3xl font-bold text-gray-900">Create Account</h1>
			<p class="mt-2 text-gray-600">Join ComStruct</p>
		</div>

		<form method="post" use:enhance class="space-y-6">
			<!-- Role Toggle -->
			<fieldset>
				<legend class="block text-sm font-medium text-gray-700 mb-2">I am a...</legend>
				<div class="flex rounded-lg border border-gray-300 overflow-hidden">
					<button
						type="button"
						onclick={() => (selectedRole = 'worker')}
						class="flex-1 py-3 text-center transition-colors {selectedRole === 'worker'
							? 'bg-blue-600 text-white'
							: 'bg-white text-gray-700 hover:bg-gray-50'}"
					>
						Worker / Foreman
					</button>
					<button
						type="button"
						onclick={() => (selectedRole = 'manager')}
						class="flex-1 py-3 text-center transition-colors {selectedRole === 'manager'
							? 'bg-blue-600 text-white'
							: 'bg-white text-gray-700 hover:bg-gray-50'}"
					>
						Manager / Procurement
					</button>
				</div>
			</fieldset>
			<input type="hidden" name="role" value={selectedRole} />

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
					autocomplete="new-password"
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
				Create Account
			</button>

			<p class="text-center text-sm text-gray-600">
				Already have an account?
				<a href="/login" class="text-blue-600 hover:underline">Sign in</a>
			</p>
		</form>
	</div>
</div>
