/**
 * issue #274 验收契约共享夹具（非测试文件，vitest 不收集——无 .test.ts 后缀）；
 * issue #364（ADR-0027 决策 1/2/3）交付形态换代后词汇重录。
 *
 * 用途：为「typed-access skill 与 docs/integration 覆盖 readData 投影交付
 * （ADR 0016 语义面 + ADR 0027 交付形态）」的文档同步验收提供（a）作用域文档路径、
 * （b）仓库文档读取、（c）可独立做敏感性单元验证的内容匹配器。
 *
 * 匹配器语义（每个匹配器 = 一份验收要求的最小内容锚；匹配器本身以纯文本为输入，
 * 敏感性由 `readdata-docs-adr0016-sync-control.test.ts` 的正/负样本双向校验，防止
 * 关键词空转/伪绿）：
 * - shape（R2，语义面锚，语义零变化）：同一段落出现 readData 与词汇同构的「schema
 *   投影 / schema projection」相邻短语——文档必须说明「成功读随值携带该路径的投影」
 *   这一结果面事实；相邻短语锚防止「生成的静态类型投影 + schema.vfsl」等无关同段落
 *   关键词的伪绿；
 * - fourKey（R3′，投影文本交付锚，#364 重录）：某段落同时出现「投影文本 / projection
 *   text」与头行文法（`# readData [`）或 ✂ 截断段——交付形态说明必须具名**投影文本**
 *   及其载体（头行/✂ 段），旧 `valueSchema` + `aliasDocs`（四件套）锚已随 ADR-0027
 *   决策 1 退役（旧词汇样本必须被拒——负样本）；
 * - keyConvention（R4′，头行/✂ 文法规约锚，#364 重录）：某段落同时锚定 `✂ 截断事实：`
 *   段、头行文法 `# readData [` 与预算段 `{depth…}`/`{maxChildrenPerNode…}`——文档须
 *   说明截断事实唯一载体（✂ 段）与头行事实锚（实参 path + 有效预算）的呈现规约；旧
 *   `aliasDocs` + 键规约锚词（同构/寻址）的文档表条款已退役；
 * - nullSemantics（R5，语义零变化）：某段落同时出现 null 与「不是读的失败 / not a read
 *   failure」——「schema 为 null 不是读的失败」判读指引；
 * - consumption（R6，语义零变化）：同一段落出现「schema 投影」相邻短语与
 *   （mutation|mutateData）——典型消费方式须覆盖「凭投影解读值并构造读后合法 mutation」；
 * - adr0016Refs（R1，按 SA6 J1 放宽）：文件级**同时**引用 ADR-0027（交付形态权威）与
 *   ADR-0016/0016-readdata（语义面）或 ADR-0024/0024-shape（预算面）——文档必须挂接
 *   权威规范源（docs/AGENTS：链接权威源而非复制规则）；只引 0016 而漏 0027（交付形态
 *   换代后词汇来源漂移）或只引 0027 而丢语义面均不合格；
 * - staleAnnotationViolations（R7，双向修复，#364）：行级注释形如 `// { ok: true, … }`
 *   且**缺** ok/value/schema/truncated 任一键，**或**仍含已退役的 `truncations` 键——
 *   目标形态是恒四键 `{ ok, value, schema, truncated }`；旧五键注记（含 truncations）
 *   与旧两键/三键注记均是过时陈述（旧谓词两个方向都错：对新四键注记假红、对旧五键
 *   注记假绿）；
 * - retiredVocabularyViolations（J4 旧词汇清退扫描）：行级命中 `恒五键`、五键字面量
 *   `{ ok: true, value, schema, truncated, truncations }`、readData 交付语境下的
 *   `truncations` 键、或 `valueSchema` + `aliasDocs` 四件套交付陈述 → 违规；
 * - readDataOptionUsages（语义零变化）：readData(path, …) 带第二实参且**非预算形态**的
 *   用法——ADR-0016 交付纪律 always-on（无 schema opt-in 开关）经 ADR-0024 决策 1 收窄为
 *   「只禁 schema opt-in 形态（含未知键——options 封闭形状），放行预算 options
 *   （depth / maxChildrenPerNode）」；ADR-0027 决策 1 保持该闭合形状零变化；
 * - budgetDiscipline（语义零变化）：typed-access 纪律三句同段在场（静态完整性需求不传
 *   预算 / 预算读一律可选访问 / 预算读不是写前完整快照——ADR-0024 决策 7 typed 纪律）。
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = fileURLToPath(new URL('../../..', import.meta.url));

/** issue #274 作用域文档（typed-access skill + docs/integration 消费 readData 的文档）。 */
export const SCOPE_DOCS = {
  typedAccess: '.agents/skills/nomicore/typed-access.md',
  cordisHosting: 'docs/integration/cordis-plugin-hosting.md',
  externalCodegen: 'docs/integration/external-project-vfsl-codegen.md',
} as const;

export function readRepoDoc(relativePath: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');
}

/** 段 = 空行分隔的文本块（含代码块——代码块内也是文档内容）。 */
export function paragraphs(text: string): string[] {
  return text.split(/\n\s*\n/u);
}

// ── 语义面锚词（ADR-0016/0024：解析语义、null 单义、消费方式——语义零变化）──
const RE_READ_DATA = /\breadData\b/u;
const RE_SCHEMA = /\bschema\b/ui;
/** 截断键锚（成功分支布尔机器信号）。 */
const RE_TRUNCATED = /\btruncated\b/ui;
/** 规范词形「schema 投影 / schema projection」（容忍反引号/角括号包裹与零空格）。 */
const RE_SCHEMA_PROJECTION = /`?schema`?\s*(?:投影|projection)/ui;
const RE_NULL_NOT_FAILURE = /不是读的失败|not a read failure/ui;
const RE_MUTATION = /mutation|mutateData/ui;

// ── 交付形态锚词（ADR-0027 决策 1/2/3：投影文本 / 头行 / ✂ 截断段）──
const RE_PROJECTION_TEXT = /投影文本|projection text/ui;
/** 头行文法（`# readData [<path>]`；容忍行内代码包裹与不同空白）。 */
const RE_HEAD_LINE = /#\s*readData\s*\[/u;
/** ✂ 截断标记（`✂` / `✂ 段` / `✂ 截断事实：` 均为合法载体陈述——R3′ 载体二选一之一）。 */
const RE_TRUNCATION_MARK = /✂/u;
/** ✂ 截断事实段（R4′ 头行/✂ 文法规约锚——须具名段）。 */
const RE_TRUNCATION_SECTION = /✂\s*截断事实/u;
/** 头行预算段文法（`{depth:N…}` / `{maxChildrenPerNode:K}`）。 */
const RE_BUDGET_SEGMENT = /\{\s*depth\b|\{\s*maxChildrenPerNode\b/u;
const RE_ADR_0027 = /ADR\s*[-–—]?\s*0027|0027[-_\s]?readdata/ui;
const RE_ADR_0016_OR_0024 = /ADR\s*[-–—]?\s*0016|0016[-_\s]?readdata|ADR\s*[-–—]?\s*0024|0024[-_\s]?shape/ui;

// ── 旧词汇（J4 清退扫描；ADR-0027 决策 1 退役的交付形态陈述）──
const RE_LEGACY_FIVE_KEY_TERM = /恒\s*五\s*键/u;
const RE_LEGACY_FIVE_KEY_LITERAL =
  /\{\s*`?ok`?(?:\s*:\s*true)?\s*,\s*`?value`?\s*,\s*`?schema`?\s*,\s*`?truncated`?\s*,\s*`?truncations`?\s*\}/u;
const RE_TRUNCATIONS_KEY = /\btruncations\b/ui;
const RE_VALUE_SCHEMA = /\bvalueSchema\b/u;
const RE_ALIAS_DOCS = /\baliasDocs\b/u;
/** readData 交付语境（行级；`truncations` 只在交付语境下是旧词汇，历史 ADR 引用除外）。 */
const RE_DELIVERY_CONTEXT = /readData|ok\s*:|\bschema\b|\btruncated\b|\{\s*ok\b/ui;

/** 要求 R2：说明「成功读 = 值 + 语义 schema 投影」的段落存在（语义面锚，零变化）。 */
export function hasShapeParagraph(text: string): boolean {
  return paragraphs(text).some((p) => RE_READ_DATA.test(p) && RE_SCHEMA_PROJECTION.test(p));
}

/** 要求 R3′（#364 重录）：投影文本交付段落——「投影文本 / projection text」具名 +
 *  其载体（头行 `# readData [` 或 `✂` 截断段）同段在场。旧四件套（valueSchema + aliasDocs）
 *  锚已退役：旧词汇样本必须被拒。 */
export function hasFourKeyParagraph(text: string): boolean {
  return paragraphs(text).some(
    (p) => RE_PROJECTION_TEXT.test(p) && (RE_HEAD_LINE.test(p) || RE_TRUNCATION_MARK.test(p)),
  );
}

/** 要求 R4′（#364 重录）：头行/✂ 文法规约段落——同段锚定 `✂ 截断事实：` 段、头行文法
 *  `# readData [` 与预算段文法（`{depth…}` / `{maxChildrenPerNode…}`）。 */
export function hasKeyConventionParagraph(text: string): boolean {
  return paragraphs(text).some(
    (p) => RE_TRUNCATION_SECTION.test(p) && RE_HEAD_LINE.test(p) && RE_BUDGET_SEGMENT.test(p),
  );
}

/** 要求 R5：「schema 为 null 不是读的失败」判读指引段落（零变化）。 */
export function hasNullSemanticsParagraph(text: string): boolean {
  return paragraphs(text).some((p) => /\bnull\b/ui.test(p) && RE_NULL_NOT_FAILURE.test(p));
}

/** 要求 R6：典型消费方式——凭投影解读/构造读后合法 mutation（零变化）。 */
export function hasConsumptionParagraph(text: string): boolean {
  return paragraphs(text).some((p) => RE_SCHEMA_PROJECTION.test(p) && RE_MUTATION.test(p));
}

/** 要求 R1（SA6 J1 放宽）：文档同时挂接 ADR-0027（交付形态权威）与 ADR-0016/0024
 *  （语义面/预算面权威）——词汇来源双锚，防只引旧 ADR（交付词汇漂移）或只引 0027。 */
export function adr0016Refs(text: string): boolean {
  return RE_ADR_0027.test(text) && RE_ADR_0016_OR_0024.test(text);
}

/**
 * 要求 R7（docs/integration 示例同步；#364 双向修复）：返回「过时成功形状注释行」——
 * 行注释 `// { ok: true, … }` 且**缺** value/schema/truncated 任一键（旧两键/三键形），
 * **或**仍携带已退役的 `truncations` 键（旧五键形）。
 * 目标形态 = 恒四键 `{ ok, value, schema, truncated }`（ADR-0027 决策 1）。
 */
export function staleAnnotationViolations(text: string): string[] {
  return text
    .split('\n')
    .map((line, i) => ({ line, i }))
    .filter(({ line }) => /\/\/\s*\{\s*ok\s*:\s*true/ui.test(line))
    .filter(
      ({ line }) =>
        !/\bvalue\b/ui.test(line) ||
        !RE_SCHEMA.test(line) ||
        !RE_TRUNCATED.test(line) ||
        RE_TRUNCATIONS_KEY.test(line),
    )
    .map(({ line, i }) => `L${i + 1}: ${line.trim()}`);
}

/**
 * 要求 J4（#364 旧词汇清退扫描）：返回命中**已退役交付词汇**的行——
 * `恒五键`、五键字面量 `{ ok: true, value, schema, truncated, truncations }`、
 * readData 交付语境下的 `truncations` 键、`valueSchema` + `aliasDocs` 四件套交付陈述。
 * 作用域文档（`SCOPE_DOCS`）扫描须归零；ADR 历史正文不在扫描域（J7：ADR 不许改写）。
 */
export function retiredVocabularyViolations(text: string): string[] {
  return text
    .split('\n')
    .map((line, i) => ({ line, i }))
    .filter(
      ({ line }) =>
        RE_LEGACY_FIVE_KEY_TERM.test(line) ||
        RE_LEGACY_FIVE_KEY_LITERAL.test(line) ||
        (RE_TRUNCATIONS_KEY.test(line) && RE_DELIVERY_CONTEXT.test(line)) ||
        (RE_VALUE_SCHEMA.test(line) && RE_ALIAS_DOCS.test(line)),
    )
    .map(({ line, i }) => `L${i + 1}: ${line.trim()}`);
}

/** 预算 options 合法键集（ADR-0024 决策 1 封闭形状；ADR-0027 决策 1 零变化）。 */
const BUDGET_OPTION_KEYS = new Set(['depth', 'maxChildrenPerNode']);

/**
 * 负控（ADR-0024 决策 1 修订，ADR-0027 决策 1 保持）：readData 带第二实参且**非纯预算
 * 形态**的用法行——schema opt-in（`{ schema: true }` 类，ADR-0016 已拒、ADR-0027 不复活）、
 * 未知键（options 封闭形状，运行时 READ_OPTIONS_INVALID）与非对象字面量第二参均标记；
 * 预算形态（depth / maxChildrenPerNode 任意组合、含空对象）放行。
 */
export function readDataOptionUsages(text: string): string[] {
  return text
    .split('\n')
    .map((line, i) => ({ line, i }))
    .filter(({ line }) => {
      const call = line.match(/readData\s*\(([^)]*)\)/u);
      if (!call) return false;
      const args = call[1] ?? '';
      const optionsLiteral = args.match(/,\s*\{([^{}]*)\}/u);
      if (!optionsLiteral) return args.includes(','); // 非对象字面量第二参：保守标记
      const keys = (optionsLiteral[1] ?? '')
        .split(',')
        .map((entry) => entry.trim().split(':')[0]?.trim().replace(/\?$/u, ''))
        .filter((key): key is string => key !== undefined && key !== '');
      return keys.some((key) => !BUDGET_OPTION_KEYS.has(key));
    })
    .map(({ line, i }) => `L${i + 1}: ${line.trim()}`);
}

/** 要求 R8（#338 / ADR-0024 决策 7，零变化）：typed-access 预算纪律三句同段落锚定。 */
const RE_BUDGET_TERM = /\bbudget\b|预算/ui;
const RE_NO_BUDGET_FOR_STATIC = /静态完整|static (completeness|integrity)|不传预算|without (a )?budget|not pass (a )?budget/ui;
const RE_OPTIONAL_ACCESS = /可选访问|optional access|DeepOptional/ui;
const RE_NOT_PREWRITE_SNAPSHOT = /写前完整快照|pre-?write (complete )?snapshot|not a (pre-?write|complete) snapshot/ui;

export function hasBudgetDisciplineParagraph(text: string): boolean {
  return paragraphs(text).some(
    (p) => RE_BUDGET_TERM.test(p) && RE_NO_BUDGET_FOR_STATIC.test(p) && RE_OPTIONAL_ACCESS.test(p) && RE_NOT_PREWRITE_SNAPSHOT.test(p),
  );
}
