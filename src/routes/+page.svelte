<svelte:head>
	<title>ComStruct - C-Materials Ordering</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center bg-gray-50 px-4">
	<div class="max-w-lg w-full text-center space-y-8">
		<div>
			<h1 class="text-4xl font-bold text-gray-900">ComStruct</h1>
			<p class="mt-3 text-lg text-gray-600">
				Simple C-materials ordering for construction sites
			</p>
		</div>

		<div class="bg-white rounded-lg shadow p-6 text-left">
			<h2 class="text-lg font-semibold text-gray-900 mb-3">What are C-materials?</h2>
			<p class="text-gray-600 text-sm">
				Low-value consumables and site supplies: screws, plugs, tape, PPE, gloves, small tools.
				They're only 5% of spend but 60% of all orders.
			</p>
		</div>

		<div class="flex flex-col sm:flex-row gap-4 justify-center">
			<a
				href="/login"
				class="px-6 py-3 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 transition-colors"
			>
				Sign In
			</a>
			<a
				href="/register"
				class="px-6 py-3 bg-white text-blue-600 font-medium rounded-md border border-blue-600 hover:bg-blue-50 transition-colors"
			>
				Create Account
			</a>
		</div>
	</div>
</div>
