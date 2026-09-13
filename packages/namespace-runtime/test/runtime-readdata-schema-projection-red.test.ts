/**
 * issue #273（ADR-0016）× issue #364（ADR-0027 决策 1/2/4）主缝契约 —
 * `@nomicore/namespace-runtime` readData 成功分支的**投影文本**。
 *
 * #364 交付形态换代（本文件为 #273 深拷贝四件套契约的原子翻新）：
 * - 成功分支恒四键 `{ ok, value, schema, truncated }`；`schema` = **投影文本**
 *   （头行 + `renderProjectionText` 正文 + ✂ 段）或严格 null（ADR-0027 决策 1/2/3）；
 * - 旧 `schema.valueSchema / aliases / docs / aliasDocs` 深等与「每次读 detached 深拷贝」
 *   引用隔离/冻结断言整组退役（string 原始值无对象可克隆）——替换为**文本一致性锚**
 *   （独立编译 `ENV_273` → `resolveSchemaAtPath` → `renderProjectionText` + 同格式头行）
 *   与**文本隔离锚**（同参连续/交错读逐字节相等；调用方改写结果对象不污染后续读数）；
 * - `schema:null` 三情形（无 active schema / 路径偏离 / 静态解析失败）保持单义严格 null。
 *
 * 断言纪律（#364 SA6 §12 头注）：只观察公共接缝运行时输出；oracle 只用公共 API 独立
 * 求值（期望串由独立编译的 derived 渲染，绝不从 `r.schema` 反推）；不 skip/only/todo/
 * env override/fallback；不吞错；装置前提失败 fail loud。
 *
 * 类型面锚（成功分支 schema: string | null）见 runtime-readdata-schema-red.test-d.ts；
 * 负控见 runtime-readdata-schema-projection-control.test.ts。
 */
import { describe, expect, it } from 'vitest';
import { createNamespaceRuntimeWithSeam } from '../src/runtime.js';
import type { NamespaceRuntime } from '../src/index.js';
import { compileSchemaEnvelope, renderProjectionText, resolveSchemaAtPath } from '@nomicore/vfsl';
import type { DerivedSchema } from '@nomicore/vfsl';
import { ENV_273, makeHandle, makeReadyRuntime, deferred } from './readdata-schema-projection-fixture.js';
import { expectReadDataOkKeys } from './helpers/readdata-ok-shape.js';

// ───────────────────────── oracle recipe（SA6 §12.0；全公共 API） ─────────────────────────

/** 组合层头行（SA6 附录 A / 设计 §7-D2 冻结格式；空路径 pathText = 空串）。 */
function foldSegment(segment: string | number): string {
  return String(segment).replace(/\r\n|\n|\r/g, ' ').trim();
}

function headLine(path: readonly (string | number)[]): string {
  const pathText = path.length === 0 ? '' : path.map(foldSegment).join('.');
  return `# readData [${pathText}]`;
}

const COMPILED_273 = compileSchemaEnvelope(ENV_273);
if (!COMPILED_273.ok) {
  throw new Error(`预言机前提失败：信封编译失败 ${JSON.stringify(COMPILED_273.issues)}`);
}
const DERIVED_273: DerivedSchema = COMPILED_273.derived;

/** 独立投影文本预言机：同一信封经 vfsl 公共 API 编译 + 解析 + 渲染（期望串独立构造）。 */
function oracle(path: readonly (string | number)[]): string {
  const resolved = resolveSchemaAtPath(DERIVED_273, path);
  if (!resolved.ok) {
    throw new Error(`预言机前提失败：路径 ${JSON.stringify(path)} 解析 ${resolved.code}`);
  }
  return `${headLine(path)}\n\n${renderProjectionText(resolved)}`;
}

// ───────────────────────── 目标契约形状（本地声明；仅形状校准，不改值、不吞错） ─────────────────────────

interface OkShape {
  ok: true;
  value: unknown;
  schema: string | null;
  truncated: boolean;
}

function readOk(runtime: NamespaceRuntime, path: readonly (string | number)[]): OkShape {
  const r = runtime.readData(path);
  if (!r.ok) {
    throw new Error(`契约前提失败：readData(${JSON.stringify(path)}) 应成功，实际 code=${r.code}`);
  }
  return r;
}

// ───────────────────────── AC1/AC2：成功分支形状与投影文本内容 ─────────────────────────

describe('issue #273 AC1/AC2：readData 成功分支形状与投影文本内容（#364 文本锚）', () => {
  it('空路径 []：ok:true value=ROOT 普通投影，schema=ROOT 投影文本（逐字节等于独立预言机）', async () => {
    const runtime = await makeReadyRuntime();
    const r = readOk(runtime, []);
    // 形状纪律：ok 分支恰四键 {ok, value, schema, truncated}
    expectReadDataOkKeys(r);
    expect(r.value).toEqual({
      count: 3,
      title: 'hello',
      meta: { content: 'hi' },
      tags: ['a', 'b', 'c'],
      skus: { ab: 1, ZZ1: 9 },
      rogue: 'x',
    });
    expect(r.truncated).toBe(false);
    expect(r.schema).toBe(oracle([]));
    // 文本文法抽检：字段行 / 行尾 docs / Record + keyPattern / 别名块
    expect(r.schema).toContain('title: string // 页面标题');
    expect(r.schema).toContain('skus: Record<string, number> // 库存（Record + keyPattern） · keyPattern: "^[a-z]{2,6}$"');
    expect(r.schema).toContain('type Meta = { // 备注实体');
    expect(r.schema).toContain('content: string // 备注内容');
    await runtime.close();
  });

  it('标量终点：readData(["count"]) → value 3，schema 字面量锚 "# readData [count]\\n\\nnumber\\n"', async () => {
    const runtime = await makeReadyRuntime();
    const r = readOk(runtime, ['count']);
    expect(r.schema).toBe('# readData [count]\n\nnumber\n');
    expect(r.value).toBe(3);
    await runtime.close();
  });

  it('ref 别名终点：readData(["meta"]) → value 深拷贝，schema 按名保留 ref + 别名块 + docs 行尾注释', async () => {
    const runtime = await makeReadyRuntime();
    const r = readOk(runtime, ['meta']);
    expect(r.value).toEqual({ content: 'hi' });
    expect(r.schema).toBe(oracle(['meta']));
    // 独立字面量锚：ref 按名直写（不内联）、闭包别名块在场、docs 归位到字段行
    expect(r.schema!.startsWith('# readData [meta]\n\nMeta\n\ntype Meta = {')).toBe(true);
    expect(r.schema).toContain('// 备注实体');
    expect(r.schema).toContain('content: string // 备注内容');
    await runtime.close();
  });

  it('别名内深读：readData(["meta","content"]) → value "hi"，schema = "# readData [meta.content]\\n\\nstring\\n"', async () => {
    const runtime = await makeReadyRuntime();
    const r = readOk(runtime, ['meta', 'content']);
    expect(r.value).toBe('hi');
    expect(r.schema).toBe(oracle(['meta', 'content']));
    expect(r.schema).toBe('# readData [meta.content]\n\nstring\n');
    await runtime.close();
  });

  it('数组元素终点：readData(["tags",1]) → value "b"，schema = "# readData [tags.1]\\n\\nstring\\n"', async () => {
    const runtime = await makeReadyRuntime();
    const r = readOk(runtime, ['tags', 1]);
    expect(r.value).toBe('b');
    expect(r.schema).toBe(oracle(['tags', 1]));
    expect(r.schema).toBe('# readData [tags.1]\n\nstring\n');
    await runtime.close();
  });

  it('Record 合法键：readData(["skus","ab"]) → value 1，schema = "# readData [skus.ab]\\n\\nnumber\\n"', async () => {
    const runtime = await makeReadyRuntime();
    const r = readOk(runtime, ['skus', 'ab']);
    expect(r.value).toBe(1);
    expect(r.schema).toBe(oracle(['skus', 'ab']));
    expect(r.schema).toBe('# readData [skus.ab]\n\nnumber\n');
    await runtime.close();
  });

  it('值缺席照常返 schema（路径键控非值键控）：["nick"]（optional 缺席）→ "string?"；["skus","cd"] → "number"', async () => {
    const runtime = await makeReadyRuntime();
    const nick = readOk(runtime, ['nick']);
    expect(nick.value).toBeUndefined();
    expect(nick.schema).toBe(oracle(['nick']));
    expect(nick.schema).toBe('# readData [nick]\n\nstring?\n');
    const sku = readOk(runtime, ['skus', 'cd']);
    expect(sku.value).toBeUndefined();
    expect(sku.schema).toBe(oracle(['skus', 'cd']));
    expect(sku.schema).toBe('# readData [skus.cd]\n\nnumber\n');
    await runtime.close();
  });
});

// ───────────────────────── AC2：schema:null 三情形 ─────────────────────────

describe('issue #273 AC2：schema:null 三情形（严格 null、非空串；ok 恒真）', () => {
  it('情形① 无 active schema（preparing，p0Gate 未放行）：读恒成功 value 正确，schema 为 null', async () => {
    const gate = deferred();
    const { handle } = await makeHandle();
    const runtime = createNamespaceRuntimeWithSeam({ handle, p0Gate: gate.promise });
    expect(runtime.getStatus().schema.state).toBe('preparing');
    const r = readOk(runtime, ['count']);
    expect(r.value).toBe(3);
    expect(r).toHaveProperty('schema');
    expect(r.schema).toBeNull();
    expect(r.truncated).toBe(false);
    gate.resolve();
    await expect.poll(() => runtime.getStatus().schema.state, { interval: 10, timeout: 5_000 }).toBe('ready');
    await runtime.close();
  });

  it('情形① 无 active schema（unavailable，编译失败态）：读恒成功，schema 为 null', async () => {
    const { handle } = await makeHandle({ text: 'type ROOT = {' });
    const runtime = createNamespaceRuntimeWithSeam({ handle });
    await expect.poll(() => runtime.getStatus().schema.state, { interval: 10, timeout: 2_000 }).toBe('unavailable');
    const r = readOk(runtime, ['count']);
    expect(r.value).toBe(3);
    expect(r).toHaveProperty('schema');
    expect(r.schema).toBeNull();
    await runtime.close();
  });

  it('情形① 无 active schema（fatal，编译内部故障态）：读保留且恒成功，schema 为 null', async () => {
    const { handle } = await makeHandle();
    const runtime = createNamespaceRuntimeWithSeam({
      handle,
      compile: () => {
        throw new Error('probe: compile seam internal fault');
      },
    });
    await expect.poll(() => runtime.getStatus().fatal, { interval: 10, timeout: 2_000 }).not.toBeNull();
    const r = readOk(runtime, ['count']);
    expect(r.value).toBe(3);
    expect(r).toHaveProperty('schema');
    expect(r.schema).toBeNull();
    await runtime.close();
  });

  it('情形② 路径偏离 schema（raw 复制式 schema 外数据在场）：["rogue"] 读成功 value "x"，schema 为 null', async () => {
    const runtime = await makeReadyRuntime();
    const r = readOk(runtime, ['rogue']);
    expect(r.value).toBe('x');
    expect(r).toHaveProperty('schema');
    expect(r.schema).toBeNull();
    await runtime.close();
  });

  it('情形③ 静态解析失败（Record keyPattern 失配）：["skus","ZZ1"] 数据在场读成功 value 9，schema 为 null；同 map 合法键 "ab" 照常非 null（对照）', async () => {
    const runtime = await makeReadyRuntime();
    const bad = readOk(runtime, ['skus', 'ZZ1']);
    expect(bad.value).toBe(9);
    expect(bad).toHaveProperty('schema');
    expect(bad.schema).toBeNull();
    const good = readOk(runtime, ['skus', 'ab']);
    expect(good.schema).not.toBeNull();
    await runtime.close();
  });
});

// ───────────────────────── AC3：文本隔离（detach 深拷贝层退役） ─────────────────────────

describe('issue #273 AC3 / #364 CT-7：投影文本天然 detached——同参读逐字节稳定、零交叉污染', () => {
  it('两次/三次连续同参读：文本逐字节相等（string 原始值，无共享对象可污染）且等于独立 oracle', async () => {
    const runtime = await makeReadyRuntime();
    const a = readOk(runtime, ['meta']);
    const b = readOk(runtime, ['meta']);
    expect(a.schema).not.toBeNull();
    expect(typeof a.schema).toBe('string');
    expect(a.schema).toBe(b.schema);
    expect(a.schema).toBe(oracle(['meta']));
    const c = readOk(runtime, ['meta']);
    expect(c.schema).toBe(a.schema);
    expect(c.schema).toBe(b.schema);
    await runtime.close();
  });

  it('调用方改写返回结果对象（重绑 schema 键 / 污染 value 深对象）后，后续读数与 live schema 均不受影响', async () => {
    const runtime = await makeReadyRuntime();
    const pristine = oracle(['meta']);
    const base = runtime.getActiveSchema();

    const first = readOk(runtime, ['meta']);
    const delivered = first.schema;
    if (delivered === null) throw new Error('契约前提失败：ready 态路径内读 schema 应为投影文本');
    expect(delivered).toBe(pristine);
    // 1) 调用方可重绑结果对象的 schema 键（string 原始值自身不可变，无 marker/docs 对象可污染）
    first.schema = 'corrupted';
    // 2) 调用方可改写下标结果对象内的 value 深对象
    if (first.value !== null && typeof first.value === 'object') {
      (first.value as Record<string, unknown>)['content'] = 'corrupted';
    }

    // 再次读取：新文本逐字节等于 pristine（不被上一读的改写污染），且交付文本是原始值
    const second = readOk(runtime, ['meta']);
    expect(second.schema).toBe(pristine);
    expect(delivered).toBe(pristine);
    // live active schema 身份未被读侧 mutation 触碰（指纹身份不变）
    expect(runtime.getActiveSchema()).toEqual(base);
    await runtime.close();
  });

  it('改写第二次读的结果对象不影响第一次已交付的文本（读间零共享双向成立）', async () => {
    const runtime = await makeReadyRuntime();
    const first = readOk(runtime, ['meta']);
    const second = readOk(runtime, ['meta']);
    const snapshot = oracle(['meta']);
    expect(first.schema).toBe(snapshot);
    expect(second.schema).toBe(snapshot);
    second.schema = 'evil';
    second.value = null;
    expect(first.schema).toBe(snapshot);
    await runtime.close();
  });
});
