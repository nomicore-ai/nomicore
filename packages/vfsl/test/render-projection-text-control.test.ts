/**
 * issue #363 负控/纯加法回归锚（控制组恒绿；SA6 §12.8 / 设计 §12 CT-7）。
 *
 * 本文件**不引用任何新名目**——它锚定红契约文件（`render-projection-text.test.ts`）的
 * 全部前提，把「红」钉死在能力缺口（公共面无 `renderProjectionText`），排除环境/夹具/
 * 入口三类伪红：
 *
 * - C1 既有 20 个公共导出名逐一在场（超集断言；不锁死新增名）；
 * - C2 无预算读 ok 四键形状 + `BUDGET_NO_BUDGET_DIGESTS` 全路径 `sha256(JSON.stringify)`
 *   逐字节摘要（含失败路径的失败结果摘要）+ `BUDGET_NO_BUDGET_FAILURES` 稳定码；
 * - C3 预算通道抽格：`BUDGET_MARKER_MATRIX` 的 `[]` d1 标记集合、
 *   `BUDGET_DOCS_MATRIX` 的 `['mode']` d1 docs 键集、`SCHEMA_OPTIONS_INVALID` 抽格。
 *
 * HEAD 与实现后**均须绿**；断言只经既有公共接缝运行时可观察输出，不读生产源码。
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import * as vfsl from '../src/index.js';
import { resolveSchemaAtPath } from '../src/index.js';
import type { DerivedSchema } from '../src/index.js';
import {
  BUDGET_DOCS_MATRIX,
  BUDGET_MARKER_MATRIX,
  BUDGET_NO_BUDGET_DIGESTS,
  BUDGET_NO_BUDGET_FAILURES,
  budgetFixtureDerived,
  digestKey,
} from './resolve-schema-at-path-budget-fixture.js';

/** SA6 §5 冻结的 20 个既有导出名（超集断言；实现只允许新增，不允许改名/删除）。 */
const FROZEN_EXPORTS: readonly string[] = [
  'FileSchemaSource',
  'SchemaSourceError',
  'applyMutationAtBoundary',
  'assertVfslDialect',
  'compilePattern',
  'compileSchemaEnvelope',
  'evaluate',
  'getCompiled',
  'getCompiledWith',
  'isSchemaTruncationMarker',
  'matchPattern',
  'parseSchemaEnvelope',
  'parseVfsl',
  'planMutationBoundary',
  'resolveSchemaAtPath',
  'validateAppendToArray',
  'validateDeleteFromArray',
  'validateInsertIntoArray',
  'validateLogicalSnapshot',
  'validatePatch',
];

interface ObservedNode {
  readonly kind: string;
  readonly clue?: { readonly via: string; readonly name?: string; readonly containerKind?: string };
  readonly fields?: ReadonlyArray<{ readonly name: string; readonly value: ObservedNode }>;
  readonly element?: ObservedNode;
  readonly members?: readonly ObservedNode[];
  readonly value?: ObservedNode;
}

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function fixture272Cache(): DerivedSchema {
  return budgetFixtureDerived();
}

/** 投影内全部标记的 ``路径 => 线索``（valueSchema 以 base 为根锚 + 闭包体以别名名为根锚）。 */
function collectMarkers(node: ObservedNode, path: string, out: string[]): void {
  switch (node.kind) {
    case 'truncated':
      out.push(`${path} => ${markerClueText(node.clue)}`);
      return;
    case 'object':
      for (const f of node.fields ?? []) collectMarkers(f.value, `${path}.${f.name}`, out);
      return;
    case 'array':
      if (node.element !== undefined) collectMarkers(node.element, `${path}.<item>`, out);
      return;
    case 'union':
      (node.members ?? []).forEach((m, i) => collectMarkers(m, `${path}.<member ${i}>`, out));
      return;
    case 'optional':
      if (node.value !== undefined) collectMarkers(node.value, path, out);
      return;
    default:
      return;
  }
}

function markerClueText(clue: ObservedNode['clue']): string {
  if (clue === undefined) return 'unknown';
  return clue.via === 'ref' ? `ref:${clue.name ?? '?'}` : `container:${clue.containerKind ?? '?'}`;
}

describe('#363 C1 既有公共导出面（超集锚）', () => {
  it('C1.1 20 个既有导出名全部在场（函数/类均为 defined）', () => {
    const surface = vfsl as unknown as Record<string, unknown>;
    for (const name of FROZEN_EXPORTS) {
      expect(surface[name], `导出缺失：${name}`).toBeDefined();
    }
    expect(FROZEN_EXPORTS).toHaveLength(20);
  });
});

describe('#363 C2 无预算读冻结摘要与失败码（既有行为不动）', () => {
  it('C2.1 全路径 sha256(JSON.stringify(result)) 与夹具冻结摘要逐字节相等', () => {
    const derived = fixture272Cache();
    for (const [pathText, expected] of Object.entries(BUDGET_NO_BUDGET_DIGESTS)) {
      const path = JSON.parse(pathText) as Array<string | number>;
      const result = resolveSchemaAtPath(derived, path);
      expect(sha256(JSON.stringify(result)), `path=${pathText}`).toBe(expected);
    }
  });

  it('C2.2 失败路径稳定码与夹具一致（预算通道未被动过）', () => {
    const derived = fixture272Cache();
    for (const [pathText, code] of Object.entries(BUDGET_NO_BUDGET_FAILURES)) {
      const path = JSON.parse(pathText) as Array<string | number>;
      const result = resolveSchemaAtPath(derived, path);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code, `path=${pathText}`).toBe(code);
    }
  });

  it('C2.3 无预算 ok 四键形状在场（valueSchema/aliases/docs/aliasDocs）', () => {
    const result = resolveSchemaAtPath(fixture272Cache(), []);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.keys(result).sort()).toEqual(['aliasDocs', 'aliases', 'docs', 'ok', 'valueSchema']);
  });
});

describe('#363 C3 预算通道抽格（既有行为不动）', () => {
  it('C3.1 BUDGET_MARKER_MATRIX 的 [] d1 标记集合逐字相等', () => {
    const matrixCase = BUDGET_MARKER_MATRIX.find((c) => digestKey(c.path) === '[]');
    expect(matrixCase).toBeDefined();
    const expected = matrixCase?.byDepth[1];
    expect(expected).toBeDefined();
    const result = resolveSchemaAtPath(fixture272Cache(), [], { depth: 1 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const out: string[] = [];
    collectMarkers(result.valueSchema as ObservedNode, 'ROOT', out);
    for (const [name, body] of Object.entries(result.aliases)) {
      collectMarkers(body as ObservedNode, name, out);
    }
    expect(out.sort()).toEqual([...(expected ?? [])].sort());
  });

  it('C3.2 BUDGET_DOCS_MATRIX 的 [\'mode\'] d1 docs 键集精确相等', () => {
    const cell = BUDGET_DOCS_MATRIX.find((c) => digestKey(c.path) === '["mode"]' && c.depth === 1);
    expect(cell).toBeDefined();
    const result = resolveSchemaAtPath(fixture272Cache(), ['mode'], { depth: 1 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.keys(result.docs).sort()).toEqual([...(cell?.docsKeys ?? [])].sort());
    expect(Object.keys(result.aliasDocs).sort()).toEqual([...(cell?.aliasDocsKeys ?? [])].sort());
  });

  it('C3.3 非法 options 收敛 SCHEMA_OPTIONS_INVALID（不抛）', () => {
    const result = resolveSchemaAtPath(fixture272Cache(), [], { depth: -1 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('SCHEMA_OPTIONS_INVALID');
  });
});
