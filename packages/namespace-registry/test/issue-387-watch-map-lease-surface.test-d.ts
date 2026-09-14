/**
 * issue #387（ADR 0030 T1）类型层红灯契约 —— lease 公共面 `watchMap` 签名与
 * 通知/定位符/句柄结构（`*.test-d.ts` 先例 = 窗口读 #369 lease surface）。
 *
 * 契约来源：issue #387 AC1/AC4/AC10；ADR 0030 §1（公共面）/§4（通知流三 kind 与
 * `{path,key}` 定位符）/§7（registry 承载 lease 公共面与类型别名）；
 * SA6 报告 §12.1 绑定 B-1/B-2/B-5。
 *
 * 类型纪律：只用 ADR 冻结的成员名 `watchMap` 做成员查找，其余类型全部**结构推导**
 * （Parameters / ReturnType / Extract），不引用未冻结的别名名 —— 别名命名属 SA1
 * 设计自由（B-5），本文件不预设。
 *
 * 红灯机理（HEAD `6df1c61`）：`NamespaceLease` 无 `watchMap` 成员 → 别名行 TS2339，
 * 下游推导全部红；实现后本文件转绿。
 */
import { describe, it } from 'vitest';
import type { NamespaceLease } from '@nomicore/namespace-registry';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type AssertTrue<T extends true> = T;

// —— 结构推导（零别名名预设） ——
type WatchMap = NamespaceLease['watchMap'];
type WatchPath = Parameters<WatchMap>[0];
type WatchListener = Parameters<WatchMap>[1];
type WatchHandle = ReturnType<WatchMap>;
type WatchNotification = Parameters<WatchListener>[0];
type WatchDataNotification = Extract<WatchNotification, { kind: 'data' }>;
type WatchChange = WatchDataNotification['changes'][number];

// —— 绑定 B-2：`watchMap(path, listener, options?)`（回调为位置参数，前两参必填） ——
type _twoArgCallAccepted = AssertTrue<Equal<[WatchPath, WatchListener] extends Parameters<WatchMap> ? true : false, true>>;
type _pathParam = AssertTrue<Equal<Parameters<WatchMap>[0], WatchPath>>;
type _listenerParam = AssertTrue<Equal<Parameters<WatchMap>[1], WatchListener>>;
// 回调形状：恰一参（通知），返回 void（ADR 0030 §6 回调 throw 隔离的前提面）
type _listenerArity = AssertTrue<Equal<Parameters<WatchListener>, [WatchNotification]>>;
type _listenerReturnsVoid = AssertTrue<Equal<ReturnType<WatchListener>, void>>;

// —— 路径面与既有读面同源（ADR 0030 §3：path 偏离 schema 判定复用 readMap 口径） ——
type _pathMirrorsReadMap = AssertTrue<Equal<WatchPath, Parameters<NamespaceLease['readMap']>[0]>>;

// —— 句柄 B-1：恰 `{unsubscribe}`，幂等退订函数 ——
type _handleKeys = AssertTrue<Equal<keyof WatchHandle, 'unsubscribe'>>;
type _handleUnsubscribe = AssertTrue<Equal<WatchHandle['unsubscribe'], () => void>>;

// —— 通知流 B-6：data 分支恰三键 `{kind,origin,changes}`；origin 两态 ——
type _dataKindAccepted = AssertTrue<Equal<'data' extends WatchNotification['kind'] ? true : false, true>>;
type _dataKeys = AssertTrue<Equal<keyof WatchDataNotification, 'kind' | 'origin' | 'changes'>>;
type _dataKind = AssertTrue<Equal<WatchDataNotification['kind'], 'data'>>;
type _dataOrigin = AssertTrue<Equal<WatchDataNotification['origin'], 'local' | 'replication'>>;

// —— 定位符 B-7：恰 `{path,key}`；`[...path, key]` 可直接拼 readData 路径 ——
type _changeKeys = AssertTrue<Equal<keyof WatchChange, 'key' | 'path'>>;
type _changeKey = AssertTrue<Equal<WatchChange['key'], string>>;
type _changePath = AssertTrue<Equal<WatchChange['path'], WatchPath>>;
type _changePathComposes = AssertTrue<
  Equal<[...WatchChange['path'], WatchChange['key']] extends readonly (string | number)[] ? true : false, true>
>;

export type WatchMapSurfaceAssertions = {
  readonly twoArgCallAccepted: _twoArgCallAccepted;
  readonly pathParam: _pathParam;
  readonly listenerParam: _listenerParam;
  readonly listenerArity: _listenerArity;
  readonly listenerReturnsVoid: _listenerReturnsVoid;
  readonly pathMirrorsReadMap: _pathMirrorsReadMap;
  readonly handleKeys: _handleKeys;
  readonly handleUnsubscribe: _handleUnsubscribe;
  readonly dataKindAccepted: _dataKindAccepted;
  readonly dataKeys: _dataKeys;
  readonly dataKind: _dataKind;
  readonly dataOrigin: _dataOrigin;
  readonly changeKeys: _changeKeys;
  readonly changeKey: _changeKey;
  readonly changePath: _changePath;
  readonly changePathComposes: _changePathComposes;
};

declare const lease: NamespaceLease;

describe('NamespaceLease 暴露 watchMap 无谓词公共面（ADR 0030 §1；B-2/B-6/B-7）', () => {
  it('正例：无谓词建立、data 分支窄化、定位符拼路径回环、恰 {unsubscribe} 句柄', () => {
    const handle = lease.watchMap(['tasks'], (notification) => {
      if (notification.kind === 'data') {
        const origin: 'local' | 'replication' = notification.origin;
        const changes: ReadonlyArray<{
          readonly path: readonly (string | number)[];
          readonly key: string;
        }> = notification.changes;
        for (const change of changes) {
          const nextPath: readonly (string | number)[] = [...change.path, change.key];
          void nextPath;
        }
        void origin;
      }
      void notification;
    });
    const unsubscribe: () => void = handle.unsubscribe;
    unsubscribe();
    unsubscribe(); // 幂等退订的静态面：重复调用合法
  });

  it('负例 fail closed：缺 path / 缺回调 / 非函数回调 / 非数组 path', () => {
    // @ts-expect-error path 必填（ADR 0030 §1）
    lease.watchMap();
    // @ts-expect-error 订阅回调必填（B-2：回调为位置参数）
    lease.watchMap(['tasks']);
    // @ts-expect-error 回调必须是函数
    lease.watchMap(['tasks'], 'not-a-listener');
    // @ts-expect-error path 必须是数组（对齐 readMap 路径面）
    lease.watchMap('tasks', () => {});
  });
});
