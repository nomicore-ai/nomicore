/**
 * SA6 issue #422 —— 能力缺口诊断探针（只读现状 + 目标断言；零生产改动）。
 *
 * 目标面（issue #422 / ADR 0032 决策 5）：hub 插件 `listen: false` = 免 listen 模式——
 * 零 listener 合法装配、提供 `nomicoreHubSessionHost` 服务、不提供 `nomicoreHubReplication`、
 * 非法配置（含拼写/伪值变体）构造期响亮 TypeError、teardown 会话收口 + timer 清零。
 *
 * 每个 check 的 PASS 语义 = **目标期望成立**（HEAD 上多数 FAIL = 能力缺口 CONFIRMED）；
 * NC-* = 负控/回归面（HEAD 上应全 PASS，实现后必须保持 GREEN）。
 *
 * 运行：
 *   NODE_OPTIONS=--conditions=nomicore-source pnpm exec tsx \
 *     artifacts/sa6-issue422-capability-gap-probe.mts
 * 变异驱动可用环境覆盖指向源码副本（见同目录 mutation-driver）：
 *   SA6_PLUGIN_SRC / SA6_INDEX_SRC（file URL 或路径）
 * 期望失败集比对：SA6_EXPECT_FAIL=C1,C2,...（逗号分隔 check id；设了即做逐项相等断言）。
 */
import { execFileSync } from 'node:child_process';

const results: Array<{ id: string; ok: boolean; detail: unknown }> = [];
function check(id: string, ok: boolean, detail: unknown = {}): void {
  results.push({ id, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id} ${JSON.stringify(detail)}`);
}

const HERE = new URL('../', import.meta.url);
const PLUGIN_SRC = process.env.SA6_PLUGIN_SRC ?? new URL('packages/ws-replication/src/plugin.ts', HERE).href;
const INDEX_SRC = process.env.SA6_INDEX_SRC ?? new URL('packages/ws-replication/src/index.ts', HERE).href;

console.log(`INFO head ${execFileSync('git', ['rev-parse', 'HEAD']).toString().trim()}`);
console.log(`INFO pluginSrc ${PLUGIN_SRC}`);

// ── 相对导入（探针自身零裸导入；传递依赖按各自文件位置解析） ──
const { Context } = await import(
  new URL('packages/ws-replication/node_modules/@deepseek-ai/cordis/src/index.ts', HERE).href
);
const { provideClock } = await import(new URL('packages/clock/src/index.ts', HERE).href);
const { provideInstance } = await import(new URL('packages/instance/src/index.ts', HERE).href);
const { provideNomicoreRegistry } = await import(
  new URL('packages/namespace-registry/src/index.ts', HERE).href
);
const { decodeMessage, encodeMessage } = await import(
  new URL('packages/replication-protocol/src/index.ts', HERE).href
);
const { settleUntil } = await import(new URL('packages/ws-replication/test/harness.ts', HERE).href);
const harness = await import(new URL('packages/ws-replication/test/harness.ts', HERE).href);
const pluginModule = (await import(PLUGIN_SRC)) as Record<string, unknown>;
const publicEntry = (await import(INDEX_SRC)) as Record<string, unknown>;

// ═══════════════════════════ 夹具 ═══════════════════════════

function effectTimer(ctx: InstanceType<typeof Context>): {
  timeout(callback: () => void, delayMs: number): () => void;
  active: Set<() => void>;
  calls: number;
} {
  const active = new Set<() => void>();
  const root = ctx.root;
  const counter = { calls: 0 };
  return {
    active,
    get calls() {
      return counter.calls;
    },
    timeout(callback, delayMs) {
      counter.calls += 1;
      let dispose!: () => void;
      dispose = root.effect(() => {
        const handle = setTimeout(() => {
          active.delete(dispose);
          callback();
        }, delayMs);
        return () => {
          active.delete(dispose);
          clearTimeout(handle);
        };
      });
      active.add(dispose);
      return dispose;
    },
  };
}

interface CtxHandle {
  readonly ctx: InstanceType<typeof Context>;
  readonly timer: ReturnType<typeof effectTimer>;
  readonly observerEvents: Array<Record<string, unknown>>;
  readonly observerPresent: boolean;
}

function makeCtx(
  role: 'hub' | 'peer',
  registry: unknown,
  opts: { observer?: boolean } = {},
): CtxHandle {
  const ctx = new Context();
  const timer = effectTimer(ctx);
  const observerEvents: Array<Record<string, unknown>> = [];
  provideInstance(ctx, Object.freeze({ instanceId: `${role}-one`, role }));
  provideClock(ctx, { now: () => 1 });
  if (typeof ctx.root.timeout === 'function') ctx.provide('timer', timer as never);
  else {
    ctx.provide('timer', {
      ...timer,
      ctx: { root: { ...ctx.root, timeout: timer.timeout } },
    } as never);
  }
  provideNomicoreRegistry(ctx, registry as never);
  return { ctx, timer, observerEvents, observerPresent: opts.observer === true };
}

function observerOverride(events: Array<Record<string, unknown>>): (event: Record<string, unknown>) => void {
  return (event) => {
    events.push(event);
  };
}

// ═══════════════════════════ CAP-12：公共面能力门 ═══════════════════════════

const serviceName = pluginModule.NOMICORE_HUB_SESSION_HOST_SERVICE;
const requireSessionHost = publicEntry.requireHubSessionHost;
check(
  'CAP-12-public-entry-service-name-and-require-helper',
  serviceName === 'nomicoreHubSessionHost' && typeof requireSessionHost === 'function',
  {
    serviceName,
    requireHubSessionHost: typeof requireSessionHost,
    entryHasConstant: 'NOMICORE_HUB_SESSION_HOST_SERVICE' in publicEntry,
  },
);

// ═══════════════════════════ NC-3：非法 listen 形态构造期响亮拒绝（GREEN 基线，须保持） ═══════════════════════════

const VALID_LISTEN = { host: '127.0.0.1', port: 18_790 };
const okAdapter = { listen: async () => ({ close: async () => {} }) };

/** 非法 listen 形态清单（仅精确 `false` 才可选择免 listen；拼写/伪值一律响亮拒绝）。 */
const INVALID_LISTEN_FORMS: ReadonlyArray<readonly [string, unknown]> = [
  ['typo-key', undefined], // { lisen: false } —— 由下一行特判构造
  ['string-false', 'false'],
  ['number-0', 0],
  ['empty-string', ''],
  ['null', null],
  ['undefined-value', undefined],
  ['nan', Number.NaN],
  ['number-1', 1],
  ['true', true],
  ['empty-array', []],
  ['empty-object', {}],
  ['port-only', { port: 0 }],
  ['empty-host', { host: '', port: 0 }],
  ['port-out-of-range', { host: '127.0.0.1', port: 70_000 }],
  ['path-not-absolute', { host: '127.0.0.1', port: 0, path: 'nope' }],
  ['typo-nested', { host: '127.0.0.1', port: 0, typo: 1 }],
];

const createPlugin = pluginModule.createHubReplicationPlugin as
  | ((config: unknown, overrides?: unknown) => unknown)
  | undefined;

for (const [id, listenValue] of INVALID_LISTEN_FORMS) {
  if (typeof createPlugin !== 'function') {
    check(`NC-3-invalid-listen-${id}`, false, { reason: 'createHubReplicationPlugin absent' });
    continue;
  }
  const config = id === 'typo-key' ? { lisen: false } : { listen: listenValue };
  try {
    createPlugin(config, {});
    check(`NC-3-invalid-listen-${id}`, false, { threw: false, config: JSON.stringify(config) });
  } catch (error) {
    const typeOk = error instanceof TypeError;
    const messageOk = /hub replication/.test(String(error));
    check(`NC-3-invalid-listen-${id}`, typeOk && messageOk, {
      type: error?.constructor?.name,
      message: String(error),
    });
  }
}

// NC-3b（敏感性锚）：非法形态在「其余配置全部合法」时仍必须响亮拒绝——静默降级为
// 免 listen 的实现（falsy 陷阱）会让本组构造成功 ⇒ 本组红（NC-3 的消息面单独不足以判）。
for (const [id, listenValue] of INVALID_LISTEN_FORMS) {
  if (typeof createPlugin !== 'function') {
    check(`NC-3b-invalid-listen-with-full-overrides-${id}`, false, {
      reason: 'createHubReplicationPlugin absent',
    });
    continue;
  }
  const config =
    id === 'typo-key'
      ? { lisen: false, tokens: [], authorization: [] }
      : { listen: listenValue, tokens: [], authorization: [] };
  try {
    createPlugin(config, { listen: okAdapter });
    check(`NC-3b-invalid-listen-with-full-overrides-${id}`, false, {
      threw: false,
      silentDowngrade: true,
      config: JSON.stringify(config),
    });
  } catch (error) {
    check(`NC-3b-invalid-listen-with-full-overrides-${id}`, error instanceof TypeError, {
      type: error?.constructor?.name,
      message: String(error),
    });
  }
}

// ═══════════════════════════ NC-4：listen 模式既有要求链逐项不变（GREEN 基线，须保持） ═══════════════════════════

function expectThrow(id: string, fn: () => unknown, matcher: RegExp): void {
  try {
    fn();
    check(id, false, { threw: false });
  } catch (error) {
    check(id, error instanceof TypeError && matcher.test(String(error)), {
      type: error?.constructor?.name,
      message: String(error),
    });
  }
}

if (typeof createPlugin === 'function') {
  expectThrow(
    'NC-4a-listen-adapter-required',
    () => createPlugin({ listen: VALID_LISTEN }, {}),
    /listen adapter is required/,
  );
  expectThrow(
    'NC-4b-authentication-required',
    () => createPlugin({ listen: VALID_LISTEN }, { listen: okAdapter }),
    /authentication is required/,
  );
  expectThrow(
    'NC-4c-authorization-required',
    () => createPlugin({ listen: VALID_LISTEN, tokens: [] }, { listen: okAdapter }),
    /authorization is required/,
  );
  try {
    createPlugin({ listen: VALID_LISTEN, tokens: [], authorization: [] }, { listen: okAdapter });
    check('NC-4d-valid-listen-config-constructs', true, {});
  } catch (error) {
    check('NC-4d-valid-listen-config-constructs', false, { message: String(error) });
  }
  // NC-5：错误不得回显凭据值（既有纪律）。
  try {
    createPlugin({ listen: VALID_LISTEN, token: 'do-not-print' } as never, { listen: okAdapter });
    check('NC-5-error-does-not-echo-credentials', false, { threw: false });
  } catch (error) {
    check('NC-5-error-does-not-echo-credentials', !String(error).includes('do-not-print'), {
      message: String(error),
    });
  }
} else {
  for (const id of [
    'NC-4a-listen-adapter-required',
    'NC-4b-authentication-required',
    'NC-4c-authorization-required',
    'NC-4d-valid-listen-config-constructs',
    'NC-5-error-does-not-echo-credentials',
  ]) {
    check(id, false, { reason: 'createHubReplicationPlugin absent' });
  }
}

// ═══════════════════════════ CAP-1..11 / 13：免 listen 模式目标面 ═══════════════════════════

const noListenCtxNode = await harness.makeNode('hub');
const noListenFixture = await harness.makeHubNamespace(noListenCtxNode);
const registryOpenCalls: Array<{ localOwner: unknown; namespaceId: unknown }> = [];
const wrappedRegistry = new Proxy(noListenCtxNode.registry, {
  get(target, property, receiver) {
    if (property === 'open') {
      return async (...args: unknown[]) => {
        registryOpenCalls.push({ localOwner: args[0], namespaceId: args[1] });
        return await (target.open as (...inner: unknown[]) => Promise<unknown>)(...args);
      };
    }
    const value = Reflect.get(target, property, receiver) as unknown;
    return typeof value === 'function' ? (value as (...inner: unknown[]) => unknown).bind(target) : value;
  },
});

function assembleNoListen(opts: { listenerSpy?: unknown } = {}): {
  plugin: Record<string, unknown>;
  handle: CtxHandle;
} | undefined {
  if (typeof createPlugin !== 'function') return undefined;
  const handle = makeCtx('hub', wrappedRegistry, { observer: true });
  handle.observerEvents.length = 0;
  const overrides: Record<string, unknown> =
    opts.listenerSpy === undefined ? {} : { listen: opts.listenerSpy };
  if (opts.listenerSpy === undefined) {
    overrides.observer = observerOverride(handle.observerEvents);
  }
  const plugin = createPlugin({ listen: false, timeouts: { openTimeoutMs: 50 } }, overrides) as Record<
    string,
    unknown
  >;
  return { plugin, handle };
}

let noListenOk = false;
let noListenPlugin: Record<string, unknown> | undefined;
let noListenHandle: CtxHandle | undefined;
try {
  const assembled = assembleNoListen();
  if (assembled === undefined) throw new Error('createHubReplicationPlugin absent');
  noListenPlugin = assembled.plugin;
  noListenHandle = assembled.handle;
  check('CAP-1-listen-false-constructs-without-throw', true, {});
  noListenOk = true;
} catch (error) {
  check('CAP-1-listen-false-constructs-without-throw', false, {
    type: (error as Error)?.constructor?.name,
    message: String(error),
  });
}

if (!noListenOk || noListenPlugin === undefined || noListenHandle === undefined) {
  for (const id of [
    'CAP-2-session-host-service-published',
    'CAP-3-service-status-ready-zero-sessions',
    'CAP-4-service-open-real-session-open-ok',
    'CAP-5-session-uses-context-registry-projection',
    'CAP-6-session-uses-injected-observer',
    'CAP-7-session-uses-context-timer',
    'CAP-8-no-hub-replication-service',
    'CAP-9-plugin-replication-and-listener-undefined',
    'CAP-11-teardown-sessions-closed-timers-cleared',
    'CAP-13-require-helper-roundtrip-and-revoke',
  ]) {
    check(id, false, { reason: 'no-listen assembly unavailable (see CAP-1)' });
  }
} else {
  const { plugin, handle } = { plugin: noListenPlugin, handle: noListenHandle };
  const ctx = handle.ctx;
  let applied = false;
  let service: Record<string, unknown> | undefined;
  try {
    await (plugin.apply as (c: unknown) => Promise<void> | void)(ctx);
    applied = true;
    const rawService = ctx.get('nomicoreHubSessionHost' as never) as Record<string, unknown> | undefined;
    service = rawService;
    check(
      'CAP-2-session-host-service-published',
      rawService !== undefined && typeof rawService.open === 'function',
      {
        present: rawService !== undefined,
        open: typeof rawService?.open,
        requireHelperWorks:
          typeof requireSessionHost === 'function'
            ? (() => {
                try {
                  return (requireSessionHost as (c: unknown) => unknown)(ctx) === rawService;
                } catch {
                  return false;
                }
              })()
            : 'helper-absent',
      },
    );
    const statusValue = rawService?.status as Record<string, unknown> | undefined;
    check(
      'CAP-3-service-status-ready-zero-sessions',
      statusValue !== undefined &&
        statusValue.state === 'ready' &&
        statusValue.sessions === 0 &&
        Object.keys(statusValue).sort().join(',') === 'sessions,state',
      { status: statusValue },
    );
  } catch (error) {
    check('CAP-2-session-host-service-published', false, { message: String(error) });
    check('CAP-3-service-status-ready-zero-sessions', false, { message: String(error) });
  }

  if (applied && service !== undefined && typeof service.open === 'function') {
    // CAP-4/5/6/7：经服务开真会话（OPEN 回合）——registry 投影 / observer / timer 注入。
    const outFrames: Uint8Array[] = [];
    const signals: Array<Record<string, unknown>> = [];
    let openOk = false;
    try {
      const sessionHandle = (service.open as (input: unknown) => Record<string, unknown>)({
        connectionKey: 'conn-1',
        remoteInstanceId: harness.PEER_INSTANCE,
        namespaceId: noListenFixture.namespaceId,
        authorization: {
          ok: true,
          localOwner: harness.HUB_OWNER,
          permissions: { read: true, submit: true },
        },
        selectedCapabilities: 0,
      });
      (sessionHandle.onFrame as (listener: (frame: Uint8Array, lane: string) => number) => void)(
        (frame) => {
          outFrames.push(frame);
          return 1;
        },
      );
      (sessionHandle.onSignal as (listener: (signal: Record<string, unknown>) => void) => void)(
        (signal) => {
          signals.push(signal);
        },
      );
      (sessionHandle.handleFrame as (frame: Uint8Array) => void)(
        encodeMessage(
          { kind: 'OPEN_NAMESPACE', namespaceId: noListenFixture.namespaceId, hasLocalReplica: false },
          { sequence: 1 },
        ),
      );
      await settleUntil(() => outFrames.length > 0, 'OPEN_OK via session host service', 3_000);
      const kinds = outFrames.map((frame) => decodeMessage(frame).message.kind);
      openOk = kinds.includes('OPEN_OK');
      check('CAP-4-service-open-real-session-open-ok', openOk, { kinds });
      check(
        'CAP-5-session-uses-context-registry-projection',
        registryOpenCalls.length === 1 &&
          registryOpenCalls[0]?.namespaceId === noListenFixture.namespaceId &&
          JSON.stringify(registryOpenCalls[0]?.localOwner) === JSON.stringify(harness.HUB_OWNER),
        { calls: registryOpenCalls },
      );
      check(
        'CAP-6-session-uses-injected-observer',
        handle.observerEvents.some((event) => event.side === 'hub'),
        { count: handle.observerEvents.length, types: handle.observerEvents.map((e) => e.type) },
      );
      check('CAP-7-session-uses-context-timer', handle.timer.calls > 0, {
        timerCalls: handle.timer.calls,
        armedNow: handle.timer.active.size,
      });

      // CAP-11：teardown —— stop() 后会话收口（settled 恰一次）+ 状态 stopped/sessions 0 + timer 0。
      const stopResult = service.stop as (() => Promise<void>) | undefined;
      if (typeof stopResult !== 'function') {
        check('CAP-11-teardown-sessions-closed-timers-cleared', false, {
          reason: 'service.stop absent',
        });
      } else {
        await stopResult.call(service);
        await settleUntil(
          () =>
            handle.observerEvents.some(
              (event) =>
                event.type === 'channel-state-changed' &&
                event.side === 'hub' &&
                event.namespaceId === noListenFixture.namespaceId &&
                event.to === 'closed',
            ),
          'channel terminal closed after service.stop',
          1_000,
        );
        const closedEdges = handle.observerEvents
          .filter((event) => event.type === 'channel-state-changed')
          .map((event) => `${String(event.from)}->${String(event.to)}`);
        const statusAfter = service.status as Record<string, unknown>;
        let openAfterStopThrew = false;
        try {
          (service.open as (input: unknown) => unknown)({
            connectionKey: 'conn-2',
            remoteInstanceId: harness.PEER_INSTANCE,
            namespaceId: noListenFixture.namespaceId,
            authorization: {
              ok: true,
              localOwner: harness.HUB_OWNER,
              permissions: { read: true, submit: true },
            },
            selectedCapabilities: 0,
          });
        } catch {
          openAfterStopThrew = true;
        }
        // 注：连接级 close 不发射 settled（hub-namespace.ts:1204 不经 notifySettled；见
        // feasibility 探针 E2e）——「会话全部收口」判据 = 通道终态 'closed' + sessions 计数 + timer 清零。
        check(
          'CAP-11-teardown-sessions-closed-timers-cleared',
          closedEdges.includes('closing->closed') &&
            statusAfter.state === 'stopped' &&
            statusAfter.sessions === 0 &&
            handle.timer.active.size === 0 &&
            openAfterStopThrew,
          {
            closedEdges,
            statusAfter,
            armedTimers: handle.timer.active.size,
            openAfterStopThrew,
          },
        );
      }
    } catch (error) {
      for (const id of [
        'CAP-4-service-open-real-session-open-ok',
        'CAP-5-session-uses-context-registry-projection',
        'CAP-6-session-uses-injected-observer',
        'CAP-7-session-uses-context-timer',
        'CAP-11-teardown-sessions-closed-timers-cleared',
      ]) {
        check(id, false, { message: String(error) });
      }
    }
  } else {
    for (const id of [
      'CAP-4-service-open-real-session-open-ok',
      'CAP-5-session-uses-context-registry-projection',
      'CAP-6-session-uses-injected-observer',
      'CAP-7-session-uses-context-timer',
      'CAP-11-teardown-sessions-closed-timers-cleared',
    ]) {
      check(id, false, { reason: 'service unavailable' });
    }
  }

  // CAP-8：免 listen 模式零 nomicoreHubReplication 服务（含消费方不可用错误）。
  const hubServiceRaw = ctx.get('nomicoreHubReplication' as never);
  let requireHubThrew = 'n/a';
  try {
    (pluginModule.requireHubReplication as (c: unknown) => unknown)(ctx);
    requireHubThrew = 'no-throw';
  } catch (error) {
    requireHubThrew = /unavailable/.test(String(error)) ? 'unavailable' : String(error);
  }
  check(
    'CAP-8-no-hub-replication-service',
    hubServiceRaw === undefined && requireHubThrew === 'unavailable',
    { hubServiceRaw: hubServiceRaw === undefined ? 'undefined' : typeof hubServiceRaw, requireHubThrew },
  );

  // CAP-9：白盒面 listener/replication 恒 undefined（零 listener/零连接级对象）。
  check(
    'CAP-9-plugin-replication-and-listener-undefined',
    plugin.replication === undefined && plugin.listener === undefined,
    { replication: typeof plugin.replication, listener: typeof plugin.listener },
  );

  // CAP-13：require 助手在装配后返回同一服务；fiber 释放后不可用（反向 yield teardown）。
  let disposeOk = false;
  let helperRevoked = 'n/a';
  try {
    await ctx.fiber.dispose();
    disposeOk = true;
    if (typeof requireSessionHost === 'function') {
      try {
        (requireSessionHost as (c: unknown) => unknown)(ctx);
        helperRevoked = 'still-present';
      } catch (error) {
        helperRevoked = /unavailable/.test(String(error)) ? 'unavailable' : String(error);
      }
    } else {
      helperRevoked = 'helper-absent';
    }
  } catch (error) {
    helperRevoked = String(error);
  }
  check(
    'CAP-13-require-helper-roundtrip-and-revoke',
    disposeOk && helperRevoked === 'unavailable' && handle.timer.active.size === 0,
    { disposeOk, helperRevoked, armedTimers: handle.timer.active.size },
  );
}

// CAP-10：宿主仍注入 listen adapter 时，免 listen 模式必须零调用（不创建任何 listener）。
if (!noListenOk) {
  check('CAP-10-supplied-listener-adapter-never-called', false, {
    reason: 'no-listen assembly unavailable (see CAP-1)',
  });
} else {
  let listenSpyCalls = 0;
  const listenerSpy = {
    listen: async () => {
      listenSpyCalls += 1;
      return { close: async () => {} };
    },
  };
  try {
    const assembled = assembleNoListen({ listenerSpy });
    if (assembled === undefined) throw new Error('createHubReplicationPlugin absent');
    await (assembled.plugin.apply as (c: unknown) => Promise<void> | void)(assembled.handle.ctx);
    check('CAP-10-supplied-listener-adapter-never-called', listenSpyCalls === 0, {
      listenSpyCalls,
      listener: typeof assembled.plugin.listener,
    });
    await assembled.handle.ctx.fiber.dispose();
  } catch (error) {
    check('CAP-10-supplied-listener-adapter-never-called', false, { message: String(error) });
  }
}

// ═══════════════════════════ NC-1/NC-2：listen 模式服务面回归（GREEN 基线，须保持） ═══════════════════════════

{
  const node = await harness.makeNode('hub');
  await harness.makeHubNamespace(node);
  const handle = makeCtx('hub', node.registry);
  let listenCalls = 0;
  const listenerSpy = {
    listen: async () => {
      listenCalls += 1;
      return { port: 1, close: async () => {} };
    },
  };
  try {
    const plugin = createPlugin!(
      { listen: VALID_LISTEN, tokens: [], authorization: [] },
      { listen: listenerSpy, observer: observerOverride(handle.observerEvents) },
    ) as Record<string, unknown>;
    await (plugin.apply as (c: unknown) => Promise<void> | void)(handle.ctx);
    const hubService = handle.ctx.get('nomicoreHubReplication' as never) as
      | Record<string, unknown>
      | undefined;
    const hubStatus = hubService?.status as Record<string, unknown> | undefined;
    check(
      'NC-1-listen-mode-hub-service-and-listener',
      hubService !== undefined &&
        hubStatus?.state === 'ready' &&
        hubStatus?.connections === 0 &&
        listenCalls === 1 &&
        plugin.listener !== undefined,
      { status: hubStatus, listenCalls, listener: typeof plugin.listener },
    );
    const sessionHostRaw = handle.ctx.get('nomicoreHubSessionHost' as never);
    let requireSessionHostUnavailable = 'n/a';
    if (typeof requireSessionHost === 'function') {
      try {
        (requireSessionHost as (c: unknown) => unknown)(handle.ctx);
        requireSessionHostUnavailable = 'present';
      } catch (error) {
        requireSessionHostUnavailable = /unavailable/.test(String(error)) ? 'unavailable' : String(error);
      }
    }
    check(
      'NC-2-listen-mode-session-host-absent',
      sessionHostRaw === undefined && requireSessionHostUnavailable !== 'present',
      { sessionHostRaw: sessionHostRaw === undefined ? 'undefined' : typeof sessionHostRaw, requireSessionHostUnavailable },
    );
    await handle.ctx.fiber.dispose();
  } catch (error) {
    check('NC-1-listen-mode-hub-service-and-listener', false, { message: String(error) });
    check('NC-2-listen-mode-session-host-absent', false, { message: String(error) });
  }
}

// ═══════════════════════════ NC-6：零网络面补充结构门（GREEN 基线，须保持） ═══════════════════════════
{
  // AC2「零网络面」的行为面 = adapter 零调用 + plugin.listener undefined（CAP-9/CAP-10）；
  // 本项是**补充**结构判据（同 #420 C4a 的纪律）：包自身不得引入 socket/网络 API。
  const pattern = /node:(?:net|http|https|tls)\b|(?:from|require\()\s*['"]ws['"]|createServer\s*\(/u;
  const packageRoot = new URL('packages/ws-replication/', HERE);
  const fs = await import('node:fs');
  const packageJsonHit = pattern.test(fs.readFileSync(new URL('package.json', packageRoot), 'utf8'));
  const sourceHits = fs
    .readdirSync(new URL('src', packageRoot))
    .filter((name) => name.endsWith('.ts'))
    .filter((name) => pattern.test(fs.readFileSync(new URL(`src/${name}`, packageRoot), 'utf8')));
  check('NC-6-zero-network-face-structural-gate', !packageJsonHit && sourceHits.length === 0, {
    packageJsonHit,
    sourceHits,
  });
}

// ═══════════════════════════ 汇总 ═══════════════════════════

const passed = results.filter((result) => result.ok).length;
const failedIds = results.filter((result) => !result.ok).map((result) => result.id);
console.log(`PROBE_RESULT ${passed}/${results.length}`);
console.log(`FAILED_IDS ${failedIds.join(',')}`);

const expected = process.env.SA6_EXPECT_FAIL;
if (expected !== undefined) {
  const expectedIds = expected === '' ? [] : expected.split(',').sort();
  const actualIds = [...failedIds].sort();
  const equal = JSON.stringify(expectedIds) === JSON.stringify(actualIds);
  console.log(`EXPECTED_FAIL ${expectedIds.join(',')}`);
  console.log(`ACTUAL_FAIL   ${actualIds.join(',')}`);
  console.log(`MUTATION_MATCH ${equal ? 'yes' : 'NO'}`);
  process.exitCode = equal ? 0 : 1;
} else {
  process.exitCode = failedIds.length > 0 ? 0 : 1; // 未设期望时：有缺口=0（缺口已确认），全绿=1（缺口消失，需复核）
}
