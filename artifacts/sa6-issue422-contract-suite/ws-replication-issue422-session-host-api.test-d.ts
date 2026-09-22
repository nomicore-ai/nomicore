/**
 * 临时 SA6 runner-trigger 探针（类型面）—— issue #422：`listen: false` 配置联合 +
 * `nomicoreHubSessionHost` 服务签名 test-d 锁定。实现票按同一路径/同一断言交付最终版；
 * SA6 采集 runner 证据后删除（见契约 §16）。
 *
 * 红因（HEAD）：`HubReplicationPluginConfig['listen']` 不含 `false`；公共入口无
 * `NOMICORE_HUB_SESSION_HOST_SERVICE` / `requireHubSessionHost` / `HubSessionHostService` /
 * `HubSessionHostStatus` ⇒ vitest `--typecheck` 报 TypeCheckError（同 `tsc -p
 * packages/ws-replication/tsconfig.json`）。
 */
import type { Context } from '@deepseek-ai/cordis';
import { describe, expectTypeOf, it } from 'vitest';
import {
  createHubReplicationPlugin,
  requireHubSessionHost,
  NOMICORE_HUB_SESSION_HOST_SERVICE,
  type HubReplicationPluginConfig,
  type HubSessionHandle,
  type HubSessionHost,
  type HubSessionHostService,
  type HubSessionHostStatus,
} from '@nomicore/ws-replication';

declare const service: HubSessionHostService;
declare const ctx: Context;

describe('@422 types：listen:false 配置联合与服务签名', () => {
  it('配置联合接受 false 与既有 listen 设置；服务面逐成员冻结', () => {
    expectTypeOf<false>().toMatchTypeOf<HubReplicationPluginConfig['listen']>();
    expectTypeOf<HubReplicationPluginConfig['listen']>()
      .toMatchTypeOf<{ readonly host: string; readonly port: number; readonly path?: string } | false>();

    const noListen: HubReplicationPluginConfig = { listen: false };
    const listen: HubReplicationPluginConfig = { listen: { host: '127.0.0.1', port: 0 } };
    expectTypeOf(noListen).toMatchTypeOf<HubReplicationPluginConfig>();
    expectTypeOf(listen).toMatchTypeOf<HubReplicationPluginConfig>();
    expectTypeOf(createHubReplicationPlugin(noListen, {})).toBeObject();

    expectTypeOf(NOMICORE_HUB_SESSION_HOST_SERVICE).toEqualTypeOf<'nomicoreHubSessionHost'>();
    expectTypeOf(requireHubSessionHost).parameter(0).not.toBeAny();
    expectTypeOf(requireHubSessionHost).returns.toEqualTypeOf<HubSessionHostService>();
    expectTypeOf<HubSessionHostService>().toMatchTypeOf<HubSessionHost>();
    expectTypeOf<HubSessionHostService['open']>().returns.toEqualTypeOf<HubSessionHandle>();
    expectTypeOf<HubSessionHostService['status']>().toEqualTypeOf<HubSessionHostStatus>();
    expectTypeOf<HubSessionHostStatus['state']>().toEqualTypeOf<'ready' | 'stopped'>();
    expectTypeOf<HubSessionHostStatus['sessions']>().toEqualTypeOf<number>();
    expectTypeOf<HubSessionHostService['stop']>().returns.toEqualTypeOf<Promise<void>>();
    expectTypeOf(ctx.get('nomicoreHubSessionHost')).toEqualTypeOf<HubSessionHostService | undefined>();
  });

  it('负控：伪值形态 / 服务面混入连接级成员必须类型错', () => {
    // @ts-expect-error 字符串伪值不得进入配置联合
    const badString: HubReplicationPluginConfig = { listen: 'false' };
    // @ts-expect-error 数字 0（falsy 陷阱）不得进入配置联合
    const badZero: HubReplicationPluginConfig = { listen: 0 };
    // @ts-expect-error null 不得进入配置联合
    const badNull: HubReplicationPluginConfig = { listen: null };
    // @ts-expect-error undefined（缺省 ≠ 免 listen）不得进入配置联合
    const badUndefined: HubReplicationPluginConfig = { listen: undefined };
    // @ts-expect-error 嵌套拼写变体键不得通过
    const badNested: HubReplicationPluginConfig = { listen: { host: '127.0.0.1', port: 0, lisen: false } };
    // @ts-expect-error SessionHost 服务无 requestReauth（连接级职责不混入）
    service.requestReauth('peer-one');
    // @ts-expect-error 状态闭联合不接受任意字符串
    const badState: HubSessionHostStatus['state'] = 'running';
    void badString;
    void badZero;
    void badNull;
    void badUndefined;
    void badNested;
    void badState;
  });
});
