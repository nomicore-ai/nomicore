/**
 * SA6 红灯锚定（类型面）— issue #412（persistence：公开完成式排空 API（drain）+
 * retryDelayMs 与 debounceMs 解耦）。
 *
 * 锚定机制（vitest --typecheck 下红/绿翻转；运行时行为锚见
 * persistence-issue-412-drain-red.test.ts）：
 * - 【红】`MemoryPersistence` / `FilePersistence`（公开 adapter 面，消费方
 *   `runtime.persistenceFiber` 拆除前调用的实例面）必须暴露完成式排空入口
 *   `drain(targets?)`——可选参数只 drain 指定 (owner, docId) 集合。基线上不存在
 *   → 条件类型求值 never → `true` 赋值 TS2322 → 红；实现后 → 绿。
 * - 【红】`PersistenceSchedule` 必须暴露独立 `retryDelayMs` 配置键
 *   （`keyof PersistenceSchedule` ∋ 'retryDelayMs'——optional 或 required 皆可，
 *   放置面由设计冻结）；「解析结果必含具体值 + 缺省 = debounceMs」由运行时锚
 *   2d/2b 验证（解析层基线上 undefined → 行为红）。基线上无该键 → never → 红。
 * - 【绿（保持性守卫）】`DocPersistence` 仍可被既有三成员字面量满足
 *   （createDoc/loadDoc/saveDoc——13 个既有 stub 与 wrapIo 字面量先例）：
 *   drain 若被建模为 `DocPersistence` 的 **required** 成员，本守卫会红——
 *   放置面必须是 optional 成员（或仅落在 adapter 类面），不得把新能力做成
 *   既有一切实现方的编译期必填（ADR-0006「importDoc/archiveDoc optional 成员 +
 *   派生接口 required 保证面」先例）。
 * - 【绿（保持性守卫）】既有 createDoc/loadDoc/saveDoc 签名与 `DocPersistence`
 *   实现关系不变（Memory/File 仍满足 `DocPersistence`）。
 *
 * 临时形状声明（待设计冻结；仅调用点形状，不改语义）：
 * `drain(targets?: readonly { owner: User; docId: string }[])` 的返回类型锚为
 * `Promise<unknown>`（`await persistence.drain()` 的 issue 用法；更丰富的返回值
 * 形状不被本锚禁止，但零参全量语义与可选目标集合语义被本锚与运行时锚共同冻结）。
 */
import { describe, it } from 'vitest';
import type * as Y from 'yjs';
import type {
  DocHandle,
  DocPersistence,
  FilePersistence,
  MemoryPersistence,
  PersistenceSchedule,
  User,
} from '@nomicore/persistence';

/** drain 的可选参数目标（issue「只 drain 指定 key 集合」；公开 key = (owner, docId)）。 */
type PersistenceDrainTarget = Readonly<{ owner: User; docId: string }>;

type HasDrain<T> = T extends {
  drain(targets?: readonly PersistenceDrainTarget[]): Promise<unknown>;
}
  ? true
  : never;

type HasRetryDelayMsKey<T> = 'retryDelayMs' extends keyof T ? true : never;

type HasCreateLoadSave<T> = T extends {
  createDoc(owner: User, docId: string, doc: Y.Doc): Promise<DocHandle>;
  loadDoc(owner: User, docId: string): Promise<DocHandle | null>;
  saveDoc(handle: DocHandle): Promise<void>;
}
  ? true
  : never;

/** 既有三成员 adapter 字面量（ADR-0006 先例：新能力不得成为 DocPersistence 必填面）。 */
const legacyThreeMemberAdapter: DocPersistence = {
  async createDoc(_owner: User, _docId: string, _doc: Y.Doc): Promise<DocHandle> {
    throw new Error('unused');
  },
  async loadDoc(_owner: User, _docId: string): Promise<DocHandle | null> {
    return null;
  },
  async saveDoc(_handle: DocHandle): Promise<void> {},
};
void legacyThreeMemberAdapter;

describe('类型面：drain（issue #412 公共完成式排空入口；可选参数为 SA6 最小提案形状）', () => {
  it('MemoryPersistence 暴露 drain(targets?)', () => {
    const anchored: HasDrain<MemoryPersistence> = true;
    void anchored;
  });

  it('FilePersistence 暴露 drain(targets?)', () => {
    const anchored: HasDrain<FilePersistence> = true;
    void anchored;
  });
});

describe('类型面：PersistenceSchedule.retryDelayMs（issue #412 问题 2 解耦配置）', () => {
  it("PersistenceSchedule 类型面暴露 retryDelayMs 配置键（optional/required 放置由设计冻结）", () => {
    const anchored: HasRetryDelayMsKey<PersistenceSchedule> = true;
    void anchored;
  });
});

describe('类型面：保持性守卫（基线已满足，预期保持绿）', () => {
  it('DocPersistence 三成员字面量仍合法（drain 不得成为 DocPersistence 必填成员）', () => {
    const anchored: HasCreateLoadSave<DocPersistence> = true;
    void anchored;
  });

  it('MemoryPersistence / FilePersistence 仍满足 DocPersistence（实现关系不变）', () => {
    type MemoryIsDocPersistence = MemoryPersistence extends DocPersistence ? true : never;
    type FileIsDocPersistence = FilePersistence extends DocPersistence ? true : never;
    const memoryAnchored: MemoryIsDocPersistence = true;
    const fileAnchored: FileIsDocPersistence = true;
    void memoryAnchored;
    void fileAnchored;
  });
});
