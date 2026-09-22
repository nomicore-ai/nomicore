/**
 * SA6 issue #422 —— 因果/可达性探针（oracle feasibility；零生产改动）。
 *
 * 目的：证明契约 §12（runtime 验收测试）的**正向断言在目标实现下可达**，且断言对象是真实
 * 行为而非空跑：把与契约测试**同一形态**的最小 OPEN 回合，经**既有公共面**
 * `createHubSessionHost`（#420 已发布）驱动一遍——
 *   registry 投影注入 / timer 注入（arm 计数）/ observer 注入 / OPEN_OK 出帧（占位 0）/
 *   close() → 通道终态 'closed'（观察者边沿）+ timer 清零；负控 = 授权投影 owner 不符 →
 *   零 OPEN_OK + 终局 ERROR。
 *
 * 关键事实（本探针实测，写进契约 §12.6）：**连接级 close（`handle.close()`）不发射
 * `settled` 信号**——`settled` 只在自然收口（CLOSE_NAMESPACE）与终局 failure 路径发射
 * （`hub-namespace.ts:509/1137/1699` 三入口）；`onConnectionClosed` 走 `setState('closed')`
 * （:1204-1212）不经 `notifySettled`。故 AC6「会话全部收口」的可观察面 = observer 的
 * `channel-state-changed{to:'closed'}` + 服务 sessions 计数 + timer 清零，**不得**以
 * `settled` 作为 stop 路径的收口判据（否则目标实现下亦不可达）。
 *
 * 运行：
 *   NODE_OPTIONS=--conditions=nomicore-source pnpm exec tsx \
 *     artifacts/sa6-issue422-causal-feasibility-probe.mts
 */
import { execFileSync } from 'node:child_process';

const results: Array<{ id: string; ok: boolean; detail: unknown }> = [];
function check(id: string, ok: boolean, detail: unknown = {}): void {
  results.push({ id, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id} ${JSON.stringify(detail)}`);
}
async function checkAsync(
  id: string,
  fn: () => Promise<{ ok: boolean; detail?: unknown }>,
): Promise<void> {
  try {
    const outcome = await fn();
    check(id, outcome.ok, outcome.detail ?? {});
  } catch (error) {
    check(id, false, { message: String(error) });
  }
}

const HERE = new URL('../', import.meta.url);
console.log(`INFO head ${execFileSync('git', ['rev-parse', 'HEAD']).toString().trim()}`);

const { decodeMessage, encodeMessage } = await import(
  new URL('packages/replication-protocol/src/index.ts', HERE).href
);
const { createHubSessionHost } = await import(
  new URL('packages/ws-replication/src/index.ts', HERE).href
);
const { resolveLimits, resolveTimeouts } = await import(
  new URL('packages/ws-replication/src/defaults.ts', HERE).href
);
const harness = await import(new URL('packages/ws-replication/test/harness.ts', HERE).href);

interface TimerProbe {
  readonly timer: { setTimeout(cb: () => void, ms: number): unknown; clearTimeout(handle: unknown): void };
  readonly active: Set<unknown>;
  readonly delays: number[];
  calls: number;
}

function makeTimer(): TimerProbe {
  const active = new Set<unknown>();
  const probe: TimerProbe = {
    active,
    delays: [],
    calls: 0,
    timer: {
      setTimeout(callback, delayMs) {
        probe.calls += 1;
        probe.delays.push(delayMs);
        const handle = setTimeout(() => {
          active.delete(handle);
          callback();
        }, delayMs);
        active.add(handle);
        return handle;
      },
      clearTimeout(handle) {
        active.delete(handle);
        clearTimeout(handle as NodeJS.Timeout);
      },
    },
  };
  return probe;
}

const node = await harness.makeNode('hub');
const fixture = await harness.makeHubNamespace(node);
const openCalls: Array<{ owner: unknown; namespaceId: unknown }> = [];
const registry = new Proxy(node.registry, {
  get(target, property, receiver) {
    if (property === 'open') {
      return async (...args: unknown[]) => {
        openCalls.push({ owner: args[0], namespaceId: args[1] });
        return await (target.open as (...inner: unknown[]) => Promise<unknown>)(...args);
      };
    }
    const value = Reflect.get(target, property, receiver) as unknown;
    return typeof value === 'function' ? (value as (...inner: unknown[]) => unknown).bind(target) : value;
  },
});

const events: Array<Record<string, unknown>> = [];
const timer = makeTimer();
const host = createHubSessionHost({
  registry,
  instanceId: harness.HUB_INSTANCE,
  limits: resolveLimits(undefined),
  timeouts: resolveTimeouts({ bootstrapTimeoutMs: 1234 }),
  timer: timer.timer,
  observer: (event: Record<string, unknown>) => {
    events.push(event);
  },
  clock: { now: () => harness.FIXED_MS },
});

function openRound(localOwner: unknown, connectionKey: string): {
  handle: Record<string, unknown>;
  frames: Uint8Array[];
  signals: Array<Record<string, unknown>>;
} {
  const frames: Uint8Array[] = [];
  const signals: Array<Record<string, unknown>> = [];
  const handle = host.open({
    connectionKey,
    remoteInstanceId: harness.PEER_INSTANCE,
    namespaceId: fixture.namespaceId,
    authorization: {
      ok: true,
      localOwner: localOwner as { userId: string },
      permissions: { read: true, submit: true },
    },
    selectedCapabilities: 0,
  }) as unknown as Record<string, unknown>;
  (handle.onFrame as (listener: (frame: Uint8Array, lane: string) => number) => void)((frame) => {
    frames.push(frame);
    return 1;
  });
  (handle.onSignal as (listener: (signal: Record<string, unknown>) => void) => void)((signal) => {
    signals.push(signal);
  });
  (handle.handleFrame as (frame: Uint8Array) => void)(
    encodeMessage(
      { kind: 'OPEN_NAMESPACE', namespaceId: fixture.namespaceId, hasLocalReplica: false },
      { sequence: 1 },
    ),
  );
  return { handle, frames, signals };
}

check('E0.factory-present', typeof createHubSessionHost === 'function', {
  typeof: typeof createHubSessionHost,
});

const round = openRound(harness.HUB_OWNER, 'conn-e1');
const kinds: string[] = [];
await checkAsync('E1a.open-ok-outbound', async () => {
  await harness.settleUntil(() => round.frames.length > 0, 'OPEN_OK (factory round)');
  for (const frame of round.frames) kinds.push(decodeMessage(frame).message.kind);
  return { ok: kinds.includes('OPEN_OK'), detail: { kinds } };
});
check(
  'E1b.outbound-placeholder-sequence-zero',
  round.frames.length > 0 && decodeMessage(round.frames[0]!).header.sequence === 0,
  { sequences: round.frames.map((frame) => decodeMessage(frame).header.sequence) },
);
check(
  'E1c.registry-projection-used',
  openCalls.length === 1 &&
    openCalls[0]?.namespaceId === fixture.namespaceId &&
    JSON.stringify(openCalls[0]?.owner) === JSON.stringify(harness.HUB_OWNER),
  { openCalls },
);
check('E1d.timer-armed-during-open', timer.calls > 0, {
  timerCalls: timer.calls,
  delays: timer.delays,
  armedNow: timer.active.size,
});
check(
  'E1f.config-timeouts-plumbed-to-session-timers',
  timer.delays.includes(1234),
  { delays: timer.delays, expectedConfigured: 1234 },
);
check(
  'E1e.observer-injection-observed',
  events.some((event) => event.side === 'hub'),
  { count: events.length, types: [...new Set(events.map((event) => event.type))] },
);

const closePromise = (round.handle.close as () => Promise<void>)();
const secondClose = (round.handle.close as () => Promise<void>)();
check('E2a.close-idempotent', closePromise === secondClose, { samePromise: closePromise === secondClose });
await checkAsync('E2b.close-resolves', async () => {
  await closePromise;
  return { ok: true };
});
check(
  'E2c.channel-terminal-closed-observed',
  events.some(
    (event) =>
      event.type === 'channel-state-changed' &&
      event.side === 'hub' &&
      event.namespaceId === fixture.namespaceId &&
      event.to === 'closed',
  ),
  {
    transitions: events
      .filter((event) => event.type === 'channel-state-changed')
      .map((event) => `${String(event.from)}->${String(event.to)}`),
  },
);
check('E2d.timers-cleared-after-close', timer.active.size === 0, { armedTimers: timer.active.size });
check(
  'E2e.no-settled-on-connection-close',
  round.signals.filter((signal) => signal.type === 'settled').length === 0,
  { signals: round.signals },
);

// ── E3：负控（owner 投影不符）→ 零 OPEN_OK + 终局 ERROR ──
await checkAsync('E3a.owner-mismatch-no-open-ok-and-error', async () => {
  const before = openCalls.length;
  const mismatch = openRound(harness.PEER_OWNER, 'conn-e3');
  await harness.settleUntil(
    () => mismatch.frames.some((frame) => decodeMessage(frame).message.kind === 'ERROR'),
    'ERROR for owner mismatch',
  );
  const mismatchKinds = mismatch.frames.map((frame) => decodeMessage(frame).message.kind);
  const codes = mismatch.frames
    .map((frame) => decodeMessage(frame).message)
    .filter((message) => message.kind === 'ERROR')
    .map((message) => (message as { code: string }).code);
  await (mismatch.handle.close as () => Promise<void>)();
  return {
    ok: !mismatchKinds.includes('OPEN_OK') && codes.includes('NAMESPACE_NOT_FOUND') && openCalls.length === before + 1,
    detail: { kinds: mismatchKinds, codes },
  };
});

const passed = results.filter((result) => result.ok).length;
console.log(`PROBE_RESULT ${passed}/${results.length}`);
console.log(`FAILED_IDS ${results.filter((result) => !result.ok).map((result) => result.id).join(',')}`);
process.exitCode = passed === results.length ? 0 : 1;
