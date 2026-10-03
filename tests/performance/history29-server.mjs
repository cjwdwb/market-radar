// 隔离夹具进程：本地SQLite与正式构建，绝不采集或访问生产。
import { writeFileSync, mkdirSync } from 'node:fs';
import { localHistoryFixture } from '../fixtures/history29-local.mjs';
import { startWorkbench } from '../../scripts/history-workbench.mjs';
const end = Math.floor(Date.now() / 900000) * 900000;
const f = await localHistoryFixture(null, { count: 30000, end, second: true });
const session = await startWorkbench({ snapshotName: f.name('snapshot'), owner: f.owner, journalName: f.name('browser-journal.sqlite'), token: 'fixture-only-history29-browser-session', upstream: 'http://127.0.0.1:5296', port: 5297 });
mkdirSync('outputs/stage29c', { recursive: true });
writeFileSync('outputs/stage29c/browser-fixture.json', JSON.stringify({ identity: 'fixture', from: f.from, end, count: 30000, source: f.source, asset: f.asset, snapshot: f.snapshot, dir: f.dir, url: session.url }, null, 2));
console.log(JSON.stringify({ url: session.url, data: 'fixture', count: 30000, deadlineMinutes: 20 }));
process.on('SIGINT', () => void session.close()); process.on('SIGTERM', () => void session.close());
