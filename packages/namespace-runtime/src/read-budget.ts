/**
 * @nomicore/namespace-runtime —— 交付总量预算（ADR 0031）**三面共享件**（包内内部模块，
 * 不经 `index.ts` 导出；模块方向零环：`runtime.ts` → 本模块、`window-read.ts` → 本模块）。
 *
 * 承载（ADR 0031 决策 2/3；#405 readData 面落地、#406 窗口面同轴）：
 * - **超限文案模板单源**：`budgetExceededMessage`（唯一常量式构造点）——三读面
 *   （`readData` / `readArray` / `readMap`）**同码同文同载荷形**；面区分靠调用现场，
 *   不靠 message（决策 3）。任何面改文案须同变更集改本件并同步三面控制锚
 *   （C8/G3 逐字节锚）。
 * - **零交付失败成员构造器** `readBudgetExceeded`：恰五键
 *   `{ ok:false, code:'READ_BUDGET_EXCEEDED', path, measuredBytes, message }`——
 *   不带任何成功键（value/schema/truncated），`path` 新鲜回显（实参事后变异不影响已返回
 *   结果），`measuredBytes` 只报**合计**（值通道紧凑 JSON UTF-8 + schema 通道文本 UTF-8），
 *   不拆分分项（决策 3）。
 * - **度量** `deliveryBytes`：ADR 0031 决策 2「整体序列化即度量」——值通道
 *   `utf8(JSON.stringify(value))`（紧凑 JSON、键序 = 交付序；`value === undefined` 计 0）
 *   + schema 通道 `utf8(schemaText)`（头行 / ✂ 段 / `‡` 页脚在文本内**自然计入、不豁免**；
 *   `null` 计 0）。组合式记账零镜像代码——等式由构造保证（G4 property）。
 *   `Buffer.byteLength` 是 Node 内建（本包部署面 Node-only；环境绑定先例见
 *   `@nomicore/namespace-diagnostic-log`），不追加物化（与 `TextEncoder` 相比省一次
 *   等长分配——SA2 MINOR-2 记录，设计选定）。度量对象必须是**塑形后**交付物。
 * - **path 回显** `echoReadPath`：非数组 → `[]`；`Array.isArray` 守卫 + try/catch spread，
 *   敌意 Proxy 数组坍缩 `[]`（沿 doc-runtime `safeSpreadPath` 纪律）；恒返回新鲜副本。
 *
 * 失败形状漂移风险以接口 `ReadDataBudgetExceededResult` 为**类型注解锁**（构造点漂移即
 * 编译红，沿 `RuntimeReadDisabledResult` 先例）；名字历史性指向 readData，实为三面共享
 * 成员（改名 = 破坏性导出面变化，无必要）。
 */

/**
 * 预算超限失败成员（ADR-0031 决策 3；#405 readData 面 / #406 窗口面共享）：交付总量 >
 * `maxBytes` 时的**零交付**同步失败分支——恰五键
 * `{ ok:false, code:'READ_BUDGET_EXCEEDED', path, measuredBytes, message }`；
 * `measuredBytes` 只报**合计**（值通道紧凑 JSON UTF-8 + schema 通道投影文本 UTF-8），不拆分；
 * 不带任何成功键（value/schema/truncated）。形状以本接口为**类型注解锁**（`readBudgetExceeded`
 * 构造点漂移即编译红）；命名沿 `RuntimeReadDisabledResult` 先例（runtime 自持失败成员，
 * 不新增公共导出名——消费方经 `Extract<…, { code:'READ_BUDGET_EXCEEDED' }>` 结构可达）。
 */
export interface ReadDataBudgetExceededResult {
  readonly ok: false;
  readonly code: 'READ_BUDGET_EXCEEDED';
  readonly path: readonly (string | number)[];
  readonly measuredBytes: number;
  readonly message: string;
}

/**
 * 超限文案模板（**三面同文唯一事实源**；ADR-0031 决策 3）：逐字节冻结点 = C8/G3 锚。
 * `readData` 面 `#405` 落地的既有文案即本模板原文——窗口面（`#406` / OBL-WIN-1）
 * 逐字镜像同一构造器，任何面不得另写模板。
 */
function budgetExceededMessage(measuredBytes: number, maxBytes: number): string {
  return `READ_BUDGET_EXCEEDED: 读交付总量 ${measuredBytes} 字节超出 maxBytes ${maxBytes}`
    + '——零交付拒绝（不裁剪、不降深度；ADR 0031）';
}

/** 包内 path 回显 helper（readDisabled / 接缝终态 / 预算超限共用；沿 doc-runtime
 *  `safeSpreadPath` 纪律）：非数组 → `[]`；`Array.isArray` 守卫 + try/catch spread，
 *  敌意 Proxy 数组坍缩 `[]`；恒返回新鲜副本（不别名调用方数组）。 */
export function echoReadPath(path: unknown): readonly (string | number)[] {
  if (!Array.isArray(path)) return [];
  try {
    return [...path];
  } catch {
    return []; // 敌意 Proxy 数组防御（沿 read.ts safeSpreadPath 纪律）
  }
}

/**
 * 交付总量度量（ADR-0031 决策 2；三面共享）：`值通道 = utf8(JSON.stringify(value))`
 * （紧凑 JSON、键序 = 交付序；`value === undefined` 计 0）+ `schema 通道 = utf8(文本)`
 * （头行与 ✂ 段在文本内**自然计入、不豁免**；`null` 计 0）。度量对象必须是**塑形后**
 * 交付物（预算闸在投影/窗口结算组装之后）。
 */
export function deliveryBytes(value: unknown, schemaText: string | null): number {
  const valueBytes = value === undefined ? 0 : Buffer.byteLength(JSON.stringify(value), 'utf8');
  const schemaBytes = schemaText === null ? 0 : Buffer.byteLength(schemaText, 'utf8');
  return valueBytes + schemaBytes;
}

/**
 * 超限零交付失败分支（ADR-0031 决策 3；三面共享构造点）：恰五键
 * `{ ok:false, code:'READ_BUDGET_EXCEEDED', path, measuredBytes, message }`——**零交付**
 * （不带 value/schema/truncated；不裁剪、不降深度、不拟合）、路径新鲜回显。
 * `readData` / `readArray` / `readMap` 三面同码同文同载荷形：面区分靠调用现场，
 * 不靠 message。
 */
export function readBudgetExceeded(
  path: readonly (string | number)[],
  measuredBytes: number,
  maxBytes: number,
): ReadDataBudgetExceededResult {
  return {
    ok: false,
    code: 'READ_BUDGET_EXCEEDED',
    path: echoReadPath(path),
    measuredBytes,
    message: budgetExceededMessage(measuredBytes, maxBytes),
  };
}
