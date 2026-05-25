import { waitForApiHealth } from './helpers/api.js';

export default async function globalSetup() {
  process.env.PLAYWRIGHT_API_URL ??= 'http://localhost:4010/api/v1';
  await waitForApiHealth();
}
