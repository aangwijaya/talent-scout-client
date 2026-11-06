import { USE_MOCK } from '$app/env/private';
import { mockApi } from './mock';
import { realApi } from './real';

export const api = USE_MOCK ? mockApi : realApi;

export { ApiError } from './types';
export type * from './types';
