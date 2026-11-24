import { resolve } from 'node:path';
process.env.DATABASE_PATH ||= resolve('data/entre-nos.sqlite');
process.env.HOSTNAME ||= '127.0.0.1';
await import('../.next/standalone/server.js');
