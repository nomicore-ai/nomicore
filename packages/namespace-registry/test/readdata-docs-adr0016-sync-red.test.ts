/**
 * SA6 契约 — issue #274（ADR 0016）+ issue #364（ADR-0027 决策 1/2/3 交付形态换代）：
 * typed-access skill 与 docs/integration 覆盖 readData 投影交付的**文档同步验收**。
 *
 * 任务类型：feature（文档能力缺口——仓库行为与规范面（ADR-0027 交付形态换代）已就位，
 * 缺的是**面向集成方与 agent 消费者**的文档同步：typed-access 指引未说明成功读的
 * `schema` 交付形态（投影文本/头行/✂ 段）与 null 语义/消费方式；docs/integration 的
 * readData 示例仍含旧四件套交付陈述或旧形状注记。
 *
 * 断言面（全部在目标文档同步后 GREEN）：
 * - R1  typed-access.md **同时**引用 ADR-0027（交付形态）与 ADR-0016/0024（语义/预算）；
 * - R2  typed-access.md 说明「成功读随值携带路径语义 schema 投影（projection/投影）」；
 * - R3′ typed-access.md 具名**投影文本**交付及其载体（头行 `# readData [` / ✂ 截断段）——
 *       旧四件套（valueSchema/aliases/docs/aliasDocs）陈述随 ADR-0027 决策 1 退役；
 * - R4′ typed-access.md 说明头行文法（`# readData [<path>]` + 预算段）与 `✂ 截断事实：`
 *       段（截断事实唯一载体）；
 * - R5  typed-access.md 给出「schema 为 null 不是读的失败」判读指引；
 * - R6  typed-access.md 说明典型消费方式：凭投影解读值并构造读后合法 mutation；
 * - R7  docs/integration/cordis-plugin-hosting.md 的 readData 成功形状注记不含缺键
 *       旧形状、不含退役的 `truncations` 键与恒五键表述——与运行时实际输出
 *       （恒四键 + 投影文本，ADR-0027）一致。
 *
 * 匹配器为内容锚（见 `readdata-docs-adr0016-contract-fixture.ts` 头注），其敏感性
 * 由同目录 control 文件的样本双向校验（正样本绿/负样本红——含旧词汇负样本），
 * 防关键词空转伪绿。本文件在目标文档同步后应全绿；每一条失败的断言消息即缺口的
 * 可观测证据。
 */
import { describe, expect, it } from 'vitest';
import {
  SCOPE_DOCS,
  adr0016Refs,
  hasConsumptionParagraph,
  hasFourKeyParagraph,
  hasKeyConventionParagraph,
  hasNullSemanticsParagraph,
  hasShapeParagraph,
  readRepoDoc,
  retiredVocabularyViolations,
  staleAnnotationViolations,
} from './readdata-docs-adr0016-contract-fixture.js';

const TYPED_ACCESS = readRepoDoc(SCOPE_DOCS.typedAccess);
const CORDIS_HOSTING = readRepoDoc(SCOPE_DOCS.cordisHosting);

describe('issue #274 R1–R2：typed-access 说明成功读的 schema 字段与投影形态', () => {
  it('R1 typed-access.md 同时引用 ADR-0027（交付形态）与 ADR-0016/0024（语义/预算）权威源', () => {
    expect(
      adr0016Refs(TYPED_ACCESS),
      'typed-access.md 必须同时引用 ADR 0027（投影文本交付形态权威）与 ADR 0016/0024（语义面/预算面权威）——交付词汇换代后只引旧 ADR 即词汇漂移',
    ).toBe(true);
  });

  it('R2 typed-access.md 说明成功读随值携带路径语义 schema 投影（schema 字段）', () => {
    expect(
      hasShapeParagraph(TYPED_ACCESS),
      'typed-access.md 须有一段说明「readData 成功读在值之外返回该路径的语义 schema 投影（schema 字段）」（同一段落含 readData 与规范词形「schema 投影 / schema projection」）',
    ).toBe(true);
  });
});

describe('issue #274 R3′–R4′：投影文本交付形态与头行/✂ 文法规约（ADR-0027 词汇）', () => {
  it('R3′ typed-access.md 具名投影文本交付（schema 为投影文本 string | null + 头行/✂ 段载体）', () => {
    expect(
      hasFourKeyParagraph(TYPED_ACCESS),
      'typed-access.md 须具名「投影文本 / projection text」交付形态及其载体（头行 `# readData [` 或 `✂ 截断事实：` 段）——旧四件套（valueSchema/aliases/docs/aliasDocs）陈述已随 ADR-0027 决策 1 退役',
    ).toBe(true);
  });

  it('R4′ typed-access.md 说明头行文法（实参 path + 预算段）与 ✂ 截断事实段（唯一载体）', () => {
    expect(
      hasKeyConventionParagraph(TYPED_ACCESS),
      'typed-access.md 须说明投影文本文法：头行 `# readData [<path>]` + 预算段 `{depth:N[,maxChildrenPerNode:K]}` 与文末 `✂ 截断事实：` 段（截断事实唯一载体）同段在场',
    ).toBe(true);
  });
});

describe('issue #274 R5–R6：null 语义判读 + 典型消费方式', () => {
  it('R5 typed-access.md 给出「schema 为 null 不是读的失败」判读指引', () => {
    expect(
      hasNullSemanticsParagraph(TYPED_ACCESS),
      'typed-access.md 须说明 schema 可为 null 且 null 不是读的失败（读的 ok 恒真；段落须含 null 与「不是读的失败 / not a read failure」规范判读语）',
    ).toBe(true);
  });

  it('R6 typed-access.md 说明典型消费方式：凭投影解读值并构造读后合法 mutation', () => {
    expect(
      hasConsumptionParagraph(TYPED_ACCESS),
      'typed-access.md 须说明消费方式（读后修改场景凭随读的「schema 投影」解读值语义并构造合法 mutation——段落须含「schema 投影」词形与 mutation/mutateData）',
    ).toBe(true);
  });
});

describe('issue #274 R7：docs/integration readData 示例形状注记同步（ADR-0027 四键 + 投影文本）', () => {
  it('R7 cordis-plugin-hosting.md 不再含缺键或旧五键成功形状注记（`// { ok: true, … }`）', () => {
    const violations = staleAnnotationViolations(CORDIS_HOSTING);
    expect(
      violations,
      'cordis-plugin-hosting.md 的 readData 成功形状注记必须同步为恒四键 + 投影文本（`// { ok: true, value, schema: <投影文本>, truncated }`）；旧两键/三键形状注记与仍含 truncations 的旧五键注记均过时。当前过时注记：'
        + violations.join(' | '),
    ).toEqual([]);
  });

  it('R7 cordis-plugin-hosting.md 无退役交付词汇（恒五键 / 五键字面量 / truncations 交付键 / 四件套交付陈述）', () => {
    const violations = retiredVocabularyViolations(CORDIS_HOSTING);
    expect(
      violations,
      'cordis-plugin-hosting.md 的 readData 交付陈述必须完成 ADR-0027 词汇清退。当前旧词汇：' + violations.join(' | '),
    ).toEqual([]);
  });
});
