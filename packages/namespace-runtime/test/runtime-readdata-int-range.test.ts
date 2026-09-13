/**
 * #316 C3c（T-4）— readData 端到端：Int/Range 叶的语义 schema **投影文本**
 * （ADR 0016 + ADR 0020 决策 8；#364/ADR-0027 决策 1/2 交付形态换代）。
 *
 * 契约来源：SA6 §12.4 C3c（readData 组合面）+ SA1 设计 §7 T-4（自包含装置）+
 * #364 SA6 契约 CT-2/CT-7（文本一致性锚 + 文本隔离）。覆盖缺口：
 * `read-schema-projection.ts` 的 int/range 标量域在投影文本中的源文法呈现
 * （`Int<1, 100>` / 裸 `Int` / `Range<0.5, 1.5>` / `Record<string, T>` / union 展开 /
 * `Pattern<"…">`）与行尾 docs 归位。
 *
 * 装置说明（**文件内自包含**，不修改任何既有文件）：`TXT_316` / `seedRoot316` /
 * `makeHandle316` / `makeReadyRuntime316` 镜像包级共享 fixture
 * `readdata-schema-projection-fixture.ts:73-98` 的**构造配方**（memory persistence +
 * Y.Doc 三载体播种 + seam + 有界 poll），但载体值为本票 Int/Range 目标值——该共享
 * fixture 的 `makeHandle`/`makeReadyRuntime` 被 #273 载体数据（273 键集）锁定，不能
 * 承载本票预写值，故按 SA1 设计备选 6 方案 (b) 在新文件内私有构造；被只读复用的共享件
 * 仅 `./real-persistence-scheduler.js`（scheduler 自 issue #107 起为必填注入）。
 *
 * 断言纪律（#364 SA6 §12 头注）：只观察公共接缝 `readData`/`getStatus` 的运行时输出
 * （结果形状 / 投影文本 / 文本隔离 / 失败码与 path 回显）；oracle 只用公共 API 独立求值
 * （独立编译 `ENV_316` → `resolveSchemaAtPath` → `renderProjectionText` + 同格式头行）；
 * 不 skip / 不软化 / 不 grep 源码；文案不冻结（文本文法锚是交付行为）。装置失败全部
 * fail loud：META.docId 违约 → persistence 拒绝；schema 解析失败 → 有界 poll 超时（5s）红；
 * 播种遗漏 → 值断言红。无静默 fallback。
 */
import * as Y from 'yjs';
import { describe, expect, it } from 'vitest';
import { createMemoryPersistence } from '@nomicore/persistence';
import type { DocHandle, User } from '@nomicore/persistence';
import { compileSchemaEnvelope, renderProjectionText, resolveSchemaAtPath } from '@nomicore/vfsl';
import type { DerivedSchema } from '@nomicore/vfsl';
import { realPersistenceScheduler } from './real-persistence-scheduler.js';
import { createNamespaceRuntimeWithSeam } from '../src/runtime.js';
import type { NamespaceRuntime } from '../src/index.js';
// rebase 合流（#338/#364）：成功形状经统一 helper 集中化（readdata-ok-shape，
// #333/#336 单点；#364 起恒四键 + schema 为投影文本 string | null）。
import { expectReadDataOkKeys } from './helpers/readdata-ok-shape.js';
import type { ReadDataOkShape } from './helpers/readdata-ok-shape.js';

/** #316 私有 schema 文本：int（裸/区间）/ range / 数组元素 / Record 值 / union 叶 + pattern 配对面。 */
const TXT_316 = `
type ROOT = YMap<{
  /** 库存计数 */
  b: number & Int<1, 100>;
  bare: number & Int;
  c: number & Range<0.5, 1.5>;
  e: number & Int<0, 9>[];
  r: Record<string, number & Int<0, 9>>;
  u: number & Int<1, 3> | string;
  p: string & Pattern<"^a+$">;
}>;
`.trim();

const ENV_316 = { lang: 'vfsl', version: 1, id: 'ns-316', text: TXT_316 } as const;
const DOC_ID_316 = 'ns-316';
const OWNER_316: User = { userId: 'u-316' };

/** ROOT 载体播种（runtime 构造前、`createDoc` 之前——与共享 fixture 同款构造时点）。 */
function seedRoot316(root: Y.Map<unknown>): void {
  root.set('b', 50);
  root.set('bare', 7);
  root.set('c', 1);
  const e = new Y.Array<number>();
  e.push([4, 7]);
  root.set('e', e);
  const r = new Y.Map<number>();
  r.set('k', 5);
  root.set('r', r);
  root.set('u', 2);
  root.set('p', 'aaa');
}

/** 经 MemoryPersistence 构造带 SCHEMA/META/ROOT 三载体的 DocHandle（配方镜像见文件头注）。 */
async function makeHandle316(): Promise<DocHandle> {
  const persistence = createMemoryPersistence({ scheduler: realPersistenceScheduler });
  const doc = new Y.Doc();
  const schema = doc.getMap('SCHEMA');
  for (const [k, v] of Object.entries(ENV_316)) schema.set(k, v);
  const meta = doc.getMap('META');
  meta.set('docId', DOC_ID_316); // 必须与 createDoc 的 docId 一致（persistence 契约组）
  meta.set('createdAt', 1_700_000_000_000);
  seedRoot316(doc.getMap('ROOT'));
  return persistence.createDoc(OWNER_316, DOC_ID_316, doc);
}

/** 构造 runtime 并等待 P0 结算到 ready（有界 5s，超时即红——fail loud，不静默跳过）。 */
async function makeReadyRuntime316(): Promise<NamespaceRuntime> {
  const handle = await makeHandle316();
  const runtime = createNamespaceRuntimeWithSeam({ handle });
  await expect.poll(() => runtime.getStatus().schema.state, { interval: 10, timeout: 5_000 }).toBe('ready');
  return runtime;
}

type ReadOkResult = ReadDataOkShape;

/** 可变视图（仅隔离用例的敌意调用方 mutation 探针；形状仍由 `ReadDataOkShape` 锚定）。 */
type MutableOkResult = { -readonly [K in keyof ReadOkResult]: ReadOkResult[K] };

/** 单点窄化：readData ok:false → loud throw（绝不假绿）。 */
function readOk(runtime: NamespaceRuntime, path: readonly (string | number)[]): MutableOkResult {
  const r = runtime.readData(path);
  if (!r.ok) {
    throw new Error(`契约前提失败：readData(${JSON.stringify(path)}) 应成功，实际 code=${r.code}`);
  }
  return r;
}

/** 组合层头行（SA6 附录 A / 设计 §7-D2 冻结格式；空路径 pathText = 空串）。 */
function headLine(path: readonly (string | number)[]): string {
  const pathText = path.length === 0 ? '' : path.map((seg) => String(seg)).join('.');
  return `# readData [${pathText}]`;
}

const COMPILED_316 = compileSchemaEnvelope(ENV_316);
if (!COMPILED_316.ok) {
  throw new Error(`预言机前提失败：信封编译失败 ${JSON.stringify(COMPILED_316.issues)}`);
}
const DERIVED_316: DerivedSchema = COMPILED_316.derived;

/** 独立投影文本预言机：同一信封经 vfsl 公共 API 编译 + 解析 + 渲染（期望串独立构造）。 */
function oracle(path: readonly (string | number)[]): string {
  const resolved = resolveSchemaAtPath(DERIVED_316, path);
  if (!resolved.ok) {
    throw new Error(`预言机前提失败：路径 ${JSON.stringify(path)} 解析 ${resolved.code}`);
  }
  return `${headLine(path)}\n\n${renderProjectionText(resolved)}`;
}

describe('C3c — readData 端到端：Int/Range 叶的投影文本（恒四键成功形状 + 预写值）', () => {
  it('前置：writeData/readData 装置可观察预写值（b=50 等），schema.state=ready', async () => {
    const runtime = await makeReadyRuntime316();
    try {
      expect(runtime.getStatus().schema.state).toBe('ready');
      expect(readOk(runtime, ['b']).value).toBe(50);
    } finally {
      await runtime.close();
    }
  });

  it("['b']：ok 恒四键 {ok,value,schema,truncated}；value=50；schema = '# readData [b]\\n\\nInt<1, 100>\\n'", async () => {
    const runtime = await makeReadyRuntime316();
    try {
      const r = readOk(runtime, ['b']);
      expectReadDataOkKeys(r);
      expect(r.truncated).toBe(false);
      expect(r.value).toBe(50);
      expect(r.schema).toBe('# readData [b]\n\nInt<1, 100>\n');
      expect(r.schema).toBe(oracle(['b']));
    } finally {
      await runtime.close();
    }
  });

  it("['bare']：裸 Int 条件键纪律——value=7，文本裸 'Int'（无 '<' 区间槽、不补 min/max undefined）", async () => {
    const runtime = await makeReadyRuntime316();
    try {
      const r = readOk(runtime, ['bare']);
      expect(r.value).toBe(7);
      expect(r.schema).toBe('# readData [bare]\n\nInt\n');
      expect(r.schema).toBe(oracle(['bare']));
      expect(r.schema).not.toContain('Int<');
    } finally {
      await runtime.close();
    }
  });

  it("['c']：range 两键必在场——value=1，文本 'Range<0.5, 1.5>'", async () => {
    const runtime = await makeReadyRuntime316();
    try {
      const r = readOk(runtime, ['c']);
      expect(r.value).toBe(1);
      expect(r.schema).toBe('# readData [c]\n\nRange<0.5, 1.5>\n');
      expect(r.schema).toBe(oracle(['c']));
    } finally {
      await runtime.close();
    }
  });

  it("['e',1]：数组元素 int 叶——value=7，文本 'Int<0, 9>'", async () => {
    const runtime = await makeReadyRuntime316();
    try {
      const r = readOk(runtime, ['e', 1]);
      expect(r.value).toBe(7);
      expect(r.schema).toBe('# readData [e.1]\n\nInt<0, 9>\n');
      expect(r.schema).toBe(oracle(['e', 1]));
    } finally {
      await runtime.close();
    }
  });

  it("['r','k']：Record 值叶 int——value=5，文本 'Int<0, 9>'", async () => {
    const runtime = await makeReadyRuntime316();
    try {
      const r = readOk(runtime, ['r', 'k']);
      expect(r.value).toBe(5);
      expect(r.schema).toBe('# readData [r.k]\n\nInt<0, 9>\n');
      expect(r.schema).toBe(oracle(['r', 'k']));
    } finally {
      await runtime.close();
    }
  });

  it("['u']：union 叶原样展开——首成员 int 叶（与 pattern 侧同构语义）", async () => {
    const runtime = await makeReadyRuntime316();
    try {
      const r = readOk(runtime, ['u']);
      expect(r.value).toBe(2);
      expect(r.schema).toBe('# readData [u]\n\n| Int<1, 3>\n| string\n');
      expect(r.schema).toBe(oracle(['u']));
    } finally {
      await runtime.close();
    }
  });

  it("docs 归位：ROOT 文本含 'ROOT.b' 宿主字段行 + 行尾注释（ADR 0019 行内前置 doc）；['b'] 叶读无宿主字段行", async () => {
    const runtime = await makeReadyRuntime316();
    try {
      const root = readOk(runtime, []);
      expect(root.schema).not.toBeNull();
      expect(root.schema).toContain('b: Int<1, 100> // 库存计数');
      expect(root.schema).toBe(oracle([]));
      // 叶读投影是裸标量（无宿主字段行 → 无 docs 注释位）
      const leaf = readOk(runtime, ['b']);
      expect(leaf.schema).toBe('# readData [b]\n\nInt<1, 100>\n');
      expect(leaf.schema).not.toContain('// 库存计数');
    } finally {
      await runtime.close();
    }
  });
});

describe('C3c — readData 投影文本隔离（string 原始值：逐字节稳定、零交叉污染）', () => {
  it('两次读文本逐字节相等（且等于独立 oracle）；调用方重绑结果键/污染 value 后重读不受影响', async () => {
    const runtime = await makeReadyRuntime316();
    try {
      const pristine = oracle(['b']);
      const first = readOk(runtime, ['b']);
      expect(first.schema).toBe(pristine);
      const delivered = first.schema;
      // 调用方可重绑结果对象的 schema 键（string 原始值自身不可变，无投影对象可污染）
      first.schema = 'corrupted';
      first.value = 'corrupted';

      const second = readOk(runtime, ['b']);
      expect(second.schema).toBe(pristine);
      expect(delivered).toBe(pristine);
      expect(typeof second.schema).toBe('string');
    } finally {
      await runtime.close();
    }
  });
});

describe('C3c — readData 失败面与 pattern 叶配对（同码、无 schema 键、path 回显）', () => {
  it("['b','x'] 与 ['p','x'] 同为 PATH_NOT_ALLOWED（值读终态短路；失败对象无 schema 键）", async () => {
    const runtime = await makeReadyRuntime316();
    try {
      for (const path of [['b', 'x'], ['p', 'x']] as const) {
        const r = runtime.readData([...path]);
        expect(r.ok).toBe(false);
        if (r.ok) throw new Error(`期望 ok:false：${JSON.stringify(path)}`);
        expect(r.code).toBe('PATH_NOT_ALLOWED');
        expect(r.path).toEqual([...path]);
        expect(Object.hasOwn(r, 'schema')).toBe(false);
        expect(Object.hasOwn(r, 'truncated')).toBe(false);
      }
    } finally {
      await runtime.close();
    }
  });
});
