import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	API_BASE_URL: {
		description: 'Go API base URL; unused in mock mode',
		schema: (value) => value
	},
	USE_MOCK: {
		description: '`true` swaps the API client for the mock implementation',
		schema: (value) => value === 'true'
	}
});
