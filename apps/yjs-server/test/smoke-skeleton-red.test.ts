/**
 * [SA6 owned] T3-skeleton — AC7 真进程冒烟（设计 §5-T3 最小骨架）+ AC2 锁守卫。
 *
 * 覆盖（最小必要）：hub 启动序 `provisioned → listening(实际 port) → ready`（port 0
 * ephemeral 上报）；peer 静态 target 认证连接 + `verify-write` 收敛；hub `read`
 * 回读相等；SIGTERM 双进程 exit 0；同 rootDir 干净停机后重启可再 boot（锁文件随
 * 干净停机删除，R1 #5）且 durable 回读相等；共享活跃 root 的第二实例被 loud 拒绝；
 * SIGTERM 直达 app 进程（事件循环忙窗内送达仍完成排空链 → exit 0，CI run 35535478371
 * `test (24, 6)` 回归锚）。
 *
 * RED 基线：`apps/yjs-server/src/main.ts` 尚不存在（SA3 未实现）→ spawn 即刻失败，
 * 每个用例在等待 NDJSON 事件处抛「进程提前退出」错误。
 *
 * spawn 形态（CI 修复）：`node --import tsx <main.ts>` 直跑——`node_modules/.bin/tsx` CLI
 * 是包装进程，会给自己转发的信号设 30ms 回执窗（超时 SIGKILL 子进程 + exit 143），
 * 与「SIGTERM → 排空 → exit 0」契约无关且 flaky；详见 `spawnApp` 注释。
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { wsUpgrade } from './harness.ts';

const REPO_ROOT = fileURLToPath(new URL('../../..', import.meta.url));
const MAIN_TS = join(REPO_ROOT, 'apps', 'yjs-server', 'src', 'main.ts');

const VFSL_SCHEMA = { lang: 'vfsl', version: 1, id: 'notes-v1', text: 'type ROOT = { count: number; };\n' };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address === null || typeof address === 'string') {
        server.close(() => reject(new Error('no tcp address')));
        return;
      }
      const port = address.port;
      server.close(() => resolve(port));
    });
  });
}

interface Proc {
  child: ChildProcess;
  raw: string[];
  events: Array<Record<string, unknown>>;
  stderr: string[];
  exitCode: number | null;
}

const liveProcs: Proc[] = [];

/**
 * 直接以 `node --import tsx <main.ts>` 启动 app 进程（与 `root-lock-atomic-reclaim-red.test.ts`
 * 的 `fork(..., { execArgv: ['--import', 'tsx'] })` 既有先例同款；发布产物
 * `bin: nomicore-yjs-server` 也是 node 直跑 `dist/main.js`）。
 *
 * 不再用 `node_modules/.bin/tsx` CLI 直跑（CI run 35535478371 `test (24, 6)` 的
 * `peer exit code: expected 143 to be +0`）：tsx CLI 是**包装进程**——它自己再 spawn 一个
 * node 子进程执行 main.ts，并把收到的 SIGTERM/SIGINT 经内部 pipe「转达」给子进程，转达后
 * 只留 30ms 回执窗（tsx `cli.mjs` `relaySignals` → `waitForSignalFromChild`）；子进程回执
 * 迟到即 `child.kill('SIGKILL')` + 包装进程 `process.exit(128 + 15)` = **143**，应用进程的
 * 排空链（drain → dispose）被腰斩（`app-stopped` 永不出现）。回执依赖子进程事件循环被
 * 调度，30ms 在 CI 上是竞态窗：同一份产品代码的 run 35534499992 该 job 绿、run 35535478371
 * 该 job 红 ⟹ flaky，非产品缺陷（应用侧 SIGTERM 语义未变）。
 * node 直跑时信号直达应用自身的 SIGTERM handler，`drain → dispose → exit 0` 硬契约不受
 * 包装进程窗口约束；断言面（SIGTERM → exit 0、四事件序、锁守卫）逐字不变。
 *
 * 可选 `appNodeOptions` 是给 app 进程追加的 node 选项（测试专用注入缝——忙窗回归用例用
 * `--import <blocker>` 在不改产品代码的前提下制造「信号送达时事件循环正忙」）。
 */
function spawnApp(args: string[], appNodeOptions?: string): Proc {
  const env: NodeJS.ProcessEnv = { ...process.env };
  if (appNodeOptions !== undefined) {
    env.NODE_OPTIONS = `${process.env.NODE_OPTIONS ?? ''} ${appNodeOptions}`.trim();
  }
  const child = spawn(process.execPath, ['--import', 'tsx', MAIN_TS, ...args], {
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: REPO_ROOT,
    env,
  });
  const proc: Proc = { child, raw: [], events: [], stderr: [], exitCode: null };
  child.stdout!.on('data', (chunk: Buffer) => {
    for (const line of chunk.toString('utf8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      proc.raw.push(trimmed);
      try {
        proc.events.push(JSON.parse(trimmed) as Record<string, unknown>);
      } catch {
        proc.events.push({ __raw: trimmed });
      }
    }
  });
  child.stderr!.on('data', (chunk: Buffer) => {
    proc.stderr.push(chunk.toString('utf8'));
  });
  child.on('exit', (code) => {
    proc.exitCode = code;
  });
  liveProcs.push(proc);
  return proc;
}

async function waitForEvent(
  proc: Proc,
  predicate: (e: Record<string, unknown>) => boolean,
  timeoutMs: number,
  what: string,
): Promise<Record<string, unknown>> {
  const start = Date.now();
  for (;;) {
    const hit = proc.events.find(predicate);
    if (hit) return hit;
    if (proc.exitCode !== null) {
      throw new Error(
        `process exited with code ${proc.exitCode} before ${what}\nstderr:\n${proc.stderr.join('')}`,
      );
    }
    if (Date.now() - start > timeoutMs) {
      throw new Error(
        `timeout ${timeoutMs}ms waiting for ${what}\nstderr:\n${proc.stderr.join('')}`,
      );
    }
    await sleep(50);
  }
}

async function waitForExit(proc: Proc, timeoutMs: number, what: string): Promise<number> {
  const start = Date.now();
  while (proc.exitCode === null) {
    if (Date.now() - start > timeoutMs) {
      proc.child.kill('SIGKILL');
      throw new Error(`timeout ${timeoutMs}ms waiting for ${what} to exit`);
    }
    await sleep(50);
  }
  return proc.exitCode;
}

async function signalAndExpectExit(proc: Proc, signal: NodeJS.Signals, timeoutMs: number, expectedCode: number, what: string): Promise<void> {
  proc.child.kill(signal);
  const code = await waitForExit(proc, timeoutMs, what);
  expect(code, `${what} exit code`).toBe(expectedCode);
}

let opCounter = 0;
async function sendOp(proc: Proc, op: Record<string, unknown>, timeoutMs = 60_000): Promise<Record<string, unknown>> {
  const id = `sa6-${++opCounter}`;
  const request = { ...op, id };
  const serialized = JSON.stringify(request);
  await new Promise<void>((resolve, reject) => {
    proc.child.stdin!.write(serialized + '\n', (err) => (err ? reject(err) : resolve()));
  });
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const hit = proc.events.find((e) => e.event === 'reply' && e.id === id);
    if (hit) return hit;
    if (proc.exitCode !== null) {
      throw new Error(
        `process exited with code ${proc.exitCode} awaiting reply to ${serialized}\nstderr:\n${proc.stderr.join('')}`,
      );
    }
    await sleep(50);
  }
  throw new Error(`timeout ${timeoutMs}ms awaiting reply to ${serialized}`);
}

function writeConfig(dir: string, config: Record<string, unknown>): string {
  const path = join(dir, 'config.json');
  writeFileSync(path, JSON.stringify(config, null, 2));
  return path;
}

function hubConfigFile(rootDir: string, listenPort: number): Record<string, unknown> {
  return {
    role: 'hub',
    instanceId: 'hub-1',
    persistence: { kind: 'file', rootDir },
    hub: {
      listen: { host: '127.0.0.1', port: listenPort },
      tokens: { 'peer-1': 'token-1' },
      provision: [{ id: 'p1', ownerUserId: 'alice', schema: VFSL_SCHEMA, root: { count: 0 } }],
      authorization: [{ peerInstanceId: 'peer-1', provisionId: 'p1', read: true, submit: true }],
    },
  };
}

function peerConfig(hubUrl: string, namespaceId: string): Record<string, unknown> {
  return {
    role: 'peer',
    instanceId: 'peer-1',
    persistence: { kind: 'memory' },
    peer: {
      hub: { url: hubUrl, hubInstanceId: 'hub-1', token: 'token-1' },
      targets: [{ namespaceId, ownerUserId: 'alice' }],
    },
  };
}

const tmpDirs: string[] = [];
function makeTmpDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'yjs-server-smoke-'));
  tmpDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const proc of liveProcs) {
    if (proc.exitCode === null) {
      proc.child.kill('SIGKILL');
    }
  }
  liveProcs.length = 0;
  for (const dir of tmpDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

/**
 * 忙窗 blocker 源码（用例运行时写入 tmp dir，零新增仓内 fixture）：在 app 进程内周期
 * 阻塞事件循环 400ms（占空比 ≈96%），并在每个忙窗开始时广播 `busy-window-start` 事件。
 *
 * 守卫 `isAppProcess`：NODE_OPTIONS 是进程级注入——若被包装进程继承（旧 `tsx` CLI 形态
 * 的反证场景），忙窗会同时拖慢包装进程自身的回执判定，断言就不再度量「应用进程的信号
 * 处理」。忙窗只作用于被测 app 进程。
 */
const BUSY_WINDOW_BLOCKER_SOURCE = `
const isAppProcess = (process.argv[1] ?? '').endsWith('main.ts');
if (isAppProcess) {
  const block = (ms) => {
    const end = Date.now() + ms;
    while (Date.now() < end) { /* spin */ }
  };
  const announce = () => process.stdout.write(JSON.stringify({ event: 'busy-window-start' }) + '\\n');
  setTimeout(() => {
    announce();
    block(400);
    setInterval(() => {
      announce();
      block(400);
    }, 415);
  }, 900);
}
`;

describe('T3-skeleton real-process smoke (design §5-T3 minimized / AC7/AC2)', () => {
  it('deployable hub rejects missing and invalid bearer credentials before WebSocket upgrade', async () => {
    const hubRoot = makeTmpDir();
    const hubProc = spawnApp(['--config', writeConfig(hubRoot, hubConfigFile(hubRoot, 0))]);
    const listening = await waitForEvent(hubProc, (e) => e.event === 'listening', 60_000, 'hub listening');
    const port = listening.port as number;

    const missing = await wsUpgrade({ port });
    expect(missing.status).toBe(401);
    expect(missing.ws).toBeUndefined();

    const invalid = await wsUpgrade({
      port,
      headers: { Authorization: 'Bearer invalid-token' },
    });
    expect(invalid.status).toBe(403);
    expect(invalid.ws).toBeUndefined();

    const valid = await wsUpgrade({
      port,
      headers: { Authorization: 'Bearer token-1' },
    });
    expect(valid.status).toBe(101);
    valid.ws?.destroy();

    await signalAndExpectExit(hubProc, 'SIGTERM', 30_000, 0, 'hub');
  }, 90_000);

  it(
    'hub emits provisioned→listening(actual port)→ready; peer authenticates static target; verify-write converges to hub read; SIGTERM exits 0',
    async () => {
      const hubRoot = makeTmpDir();
      const hubProc = spawnApp(['--config', writeConfig(hubRoot, hubConfigFile(hubRoot, 0))]);

      const provisioned = await waitForEvent(hubProc, (e) => e.event === 'provisioned', 60_000, 'hub provisioned');
      const namespaceId = provisioned.namespaceId as string;
      expect(namespaceId).toMatch(/^ns-[0-9a-f]{32}$/);

      const listening = await waitForEvent(hubProc, (e) => e.event === 'listening', 60_000, 'hub listening');
      const actualPort = listening.port as number;
      expect(typeof actualPort).toBe('number');

      await waitForEvent(hubProc, (e) => e.event === 'ready', 60_000, 'hub ready');

      const order = hubProc.events
        .filter((e) => e.event === 'provisioned' || e.event === 'listening' || e.event === 'ready')
        .map((e) => e.event as string);
      expect(order).toEqual(['provisioned', 'listening', 'ready']);

      const peerProc = spawnApp(['--config', writeConfig(makeTmpDir(), peerConfig(`ws://127.0.0.1:${actualPort}/replication`, namespaceId))]);
      await waitForEvent(peerProc, (e) => e.event === 'ready', 60_000, 'peer ready');

      const writeReply = await sendOp(peerProc, {
        op: 'verify-write',
        namespaceId,
        set: ['count'],
        path: ['count'],
        value: 1,
        timeoutMs: 30_000,
      }, 60_000);
      expect(writeReply.ok).toBe(true);

      const readReply = await sendOp(hubProc, { op: 'read', namespaceId, path: ['count'] }, 20_000);
      expect(readReply.ok).toBe(true);
      expect(readReply.value).toBe(1);

      await signalAndExpectExit(hubProc, 'SIGTERM', 30_000, 0, 'hub');
      await signalAndExpectExit(peerProc, 'SIGTERM', 30_000, 0, 'peer');
    },
    180_000,
  );

  it(
    'clean shutdown releases the rootDir lock: same rootDir restarts and reads back the durable value',
    async () => {
      const hubRoot = makeTmpDir();
      const port = await freePort();
      const configPath = writeConfig(hubRoot, hubConfigFile(hubRoot, port));

      const hubProc = spawnApp(['--config', configPath]);
      const provisioned = await waitForEvent(hubProc, (e) => e.event === 'provisioned', 60_000, 'hub provisioned (restart test)');
      const namespaceId = provisioned.namespaceId as string;
      await waitForEvent(hubProc, (e) => e.event === 'ready', 60_000, 'hub ready (restart test)');

      const peerProc = spawnApp(['--config', writeConfig(makeTmpDir(), peerConfig(`ws://127.0.0.1:${port}/replication`, namespaceId))]);
      await waitForEvent(peerProc, (e) => e.event === 'ready', 60_000, 'peer ready (restart test)');

      const writeReply = await sendOp(peerProc, { op: 'verify-write', namespaceId, set: ['count'], path: ['count'], value: 41, timeoutMs: 30_000 }, 60_000);
      expect(writeReply.ok).toBe(true);

      await signalAndExpectExit(hubProc, 'SIGTERM', 30_000, 0, 'hub (first boot)');
      await signalAndExpectExit(peerProc, 'SIGTERM', 30_000, 0, 'peer (first boot)');

      // 同 rootDir 重启（直引形式 authorization 指向首 boot 捕获的 nsId——生产主路径）：
      // 干净停机已删锁 → 成功 boot（R1 #5 隐证），且 durable 值回读相等。
      const restartConfig = {
        role: 'hub',
        instanceId: 'hub-1',
        persistence: { kind: 'file', rootDir: hubRoot },
        hub: {
          listen: { host: '127.0.0.1', port },
          tokens: { 'peer-1': 'token-1' },
          authorization: [
            { peerInstanceId: 'peer-1', namespaceId, ownerUserId: 'alice', read: true, submit: true },
          ],
        },
      };
      const hubProc2 = spawnApp(['--config', writeConfig(makeTmpDir(), restartConfig)]);
      await waitForEvent(hubProc2, (e) => e.event === 'ready', 60_000, 'hub ready (restart)');
      const readReply = await sendOp(hubProc2, { op: 'read', namespaceId, path: ['count'] }, 20_000);
      expect(readReply.ok).toBe(true);
      expect(readReply.value).toBe(41);

      await signalAndExpectExit(hubProc2, 'SIGTERM', 30_000, 0, 'hub (restart)');
    },
    180_000,
  );

  it(
    'a second instance sharing an active file root is rejected loudly (lock guard, AC2)',
    async () => {
      const hubRoot = makeTmpDir();
      const hub1 = spawnApp(['--config', writeConfig(hubRoot, hubConfigFile(hubRoot, 0))]);
      await waitForEvent(hub1, (e) => e.event === 'ready', 60_000, 'hub1 ready (lock test)');

      // 第二实例：不同 instanceId、同一活跃 rootDir（共享 root unsupported）。
      const secondConfig = {
        ...hubConfigFile(hubRoot, 0),
        instanceId: 'hub-2',
      };
      const hub2 = spawnApp(['--config', writeConfig(makeTmpDir(), secondConfig)]);
      const exitCode = await waitForExit(hub2, 30_000, 'second instance');
      expect(exitCode).toBe(1);
      const everything = [...hub2.raw, ...hub2.stderr].join('\n');
      expect(everything).toMatch(/\.nomicore-lock\.json|lock/i);

      await signalAndExpectExit(hub1, 'SIGTERM', 30_000, 0, 'hub1 (lock test)');
    },
    180_000,
  );

  it(
    'SIGTERM is delivered to the app process itself: a busy event loop still completes the drain chain and exits 0',
    async () => {
      // 回归锚（CI run 35535478371 `test (24, 6)`：`peer exit code: expected 143 to be +0`）：
      // 忙窗 blocker 由用例运行时写入 tmp dir（零新增仓内 fixture），经 NODE_OPTIONS
      // `--import` 注入 app 进程；它在每个忙窗开始时广播 NDJSON 事件，用例据此把 SIGTERM
      // 精确送进「事件循环正忙」窗口。信号直达应用自身 handler ⟹ 阻塞结束即继续
      // `drain → dispose → app-stopped → exit 0`。
      // 反证（旧 tsx CLI 包装形态 + 同一 blocker）：包装进程 30ms 回执窗超时 →
      // SIGKILL 子进程 + `process.exit(143)`，`app-stopped` 缺失 ⟹ 本用例红。
      const blockerDir = makeTmpDir();
      const blockerPath = join(blockerDir, 'busy-window.mjs');
      writeFileSync(blockerPath, BUSY_WINDOW_BLOCKER_SOURCE);

      const hubRoot = makeTmpDir();
      const hubProc = spawnApp(
        ['--config', writeConfig(hubRoot, hubConfigFile(hubRoot, 0))],
        `--import ${blockerPath}`,
      );
      await waitForEvent(hubProc, (e) => e.event === 'ready', 60_000, 'hub ready (busy window)');
      await waitForEvent(hubProc, (e) => e.event === 'busy-window-start', 60_000, 'busy window start');
      await sleep(50); // 落进 400ms 忙窗内（广播后 50ms）
      await signalAndExpectExit(hubProc, 'SIGTERM', 30_000, 0, 'hub (busy window)');
      expect(
        hubProc.events.some((e) => e.event === 'app-stopped'),
        'clean shutdown chain completed (app-stopped)',
      ).toBe(true);
      // Owner 评论 5751613018 硬契约在忙窗下同样成立：dispose 之前先完成式排空
      // （`persistence-disposed` 先于 `app-stopped`）。
      const tailOrder = hubProc.events
        .filter((e) => e.event === 'persistence-disposed' || e.event === 'app-stopped')
        .map((e) => e.event as string);
      expect(tailOrder).toEqual(['persistence-disposed', 'app-stopped']);
    },
    120_000,
  );
});
