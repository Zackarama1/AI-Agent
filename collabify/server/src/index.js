import { config } from './config.js';
import { openDatabase } from './db.js';
import { createApp } from './app.js';

const db = openDatabase();
const app = createApp(db);

app.listen(config.port, () => {
  console.log(`Collabify API listening on http://localhost:${config.port} (payments: ${config.paymentProvider}, commission: ${config.commissionRate * 100}%)`);
});
