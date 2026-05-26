process.env.PLAYWRIGHT_API_URL ??= 'http://localhost:4010/api/v1';

import { waitForApiHealth } from './helpers/api.js';

export default async function globalSetup() {
  await waitForApiHealth();
}
