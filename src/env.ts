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
	DEMO_PASSWORD: {
		description:
			'Public demo only: shown on the login page and turns on the apply-page notice. Display only; sign-in still checks the Go API',
		schema: (value) => value
	},
	USE_MOCK: {
		description: '`true` swaps the API client for the mock implementation',
		schema: (value) => value === 'true'
	}
});
