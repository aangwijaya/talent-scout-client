import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	API_BASE_URL: {
		description: 'Go API base URL; unused in mock mode',
		schema: (value) => value
	},
	BFF_SHARED_SECRET: {
		description: 'Sent as `X-BFF-Secret` so the Go API trusts the forwarded applicant IP',
		schema: (value) => value
	},
	USE_MOCK: {
		description: '`true` swaps the API client for the mock implementation',
		schema: (value) => value === 'true'
	}
});
