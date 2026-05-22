import './env.js';
import { createApp } from './app.js';

const PORT = Number(process.env.API_PORT ?? 4000);

const app = createApp();

app.listen(PORT, () => {
  console.log(`[api] Mazare3 API listening on http://localhost:${PORT}`);
});
