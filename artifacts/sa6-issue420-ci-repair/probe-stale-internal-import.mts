/**
 * SA6 CI-repair mechanism probe — issue #420 / PR #429, CI run 35663498235 (head 3f470fb).
 *
 * 作用：不触碰任何 tracked 文件，隔离 CI 红灯的**直接故障点**——被 #423 两测试文件以
 * 深路径消费的内部 splice 模块（`packages/ws-replication/src/hub-session.ts`）在 #420
 * 交付（4e5ff0a）后不再导出旧名 `createHubSessionHost`，而改名后的 `createHubSessionSink`
 * 在场；公共入口的 `createHubSessionHost`（#420 新公共工厂，另一模块、另一配置形态）是
 * **不同绑定**——旧消费方若改道公共入口即语义换面，故修复只能落在消费方的机械跟随。
 *
 * 判据（全部运行时观察）：
 *  A. 旧消费方绑定名在内部 splice 模块上缺席（typeof undefined）——直接故障点。
 *  B. 改名后的内部 splice 工厂在场且为函数，运行时导出面 exact-equality =
 *     ['createHubSessionSink']（#418 C0c 结构锚 :618 锁定的同集合）。
 *  C. 公共入口的 createHubSessionHost 在场且与内部 splice 工厂**不同一**（公共面 ≠ 内部面）。
 *  D. 负控：相邻模块/公共入口的既有导出在场，且对缺席名发起调用得到真实 TypeError
 *     （缺席是符号级的，不是导入机制/环境故障）。
 *  E. 谱系事实（source history，非行为断言）：父基 25c51cd 的同文件**曾**导出该旧名。
 *
 * 运行：NODE_OPTIONS=--conditions=nomicore-source pnpm exec tsx <this file>
 * 退出码：0 = 机制确证；1 = 未确证（探针不可作证据）。
 */
import { execFileSync } from 'node:child_process';

const results: Array<{ id: string; ok: boolean; detail: unknown }> = [];
function check(id: string, ok: boolean, detail: unknown): void {
  results.push({ id, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id} ${JSON.stringify(detail)}`);
}

const head = execFileSync('git', ['rev-parse', 'HEAD']).toString().trim();
console.log(`INFO head ${head}`);

const sessionModule = (await import('../../packages/ws-replication/src/hub-session.ts')) as Record<string, unknown>;
const edgeModule = (await import('../../packages/ws-replication/src/hub-edge.ts')) as Record<string, unknown>;
const publicEntry = (await import('../../packages/ws-replication/src/index.ts')) as Record<string, unknown>;

const sessionKeys = Object.keys(sessionModule).sort();
console.log(`INFO hubSessionModuleExports ${JSON.stringify(sessionKeys)}`);
console.log(`INFO publicEntryHasCreateHubSessionHost ${typeof publicEntry.createHubSessionHost}`);

// A. 直接故障点：旧消费方绑定名缺席。
check('A.staleName.createHubSessionHost.absent', typeof sessionModule.createHubSessionHost === 'undefined', {
  typeof: typeof sessionModule.createHubSessionHost,
});

// B. 改名后的内部 splice 工厂在场；运行时导出面与 #418 C0c 结构锚同集合。
check('B.renamedFactory.present', typeof sessionModule.createHubSessionSink === 'function', {
  typeof: typeof sessionModule.createHubSessionSink,
});
check('B.internalSurface.exact', JSON.stringify(sessionKeys) === JSON.stringify(['createHubSessionSink']), {
  keys: sessionKeys,
});

// C. 公共面 ≠ 内部面：公共 createHubSessionHost 在场且与内部 splice 工厂不同一。
check('C.publicFactory.present', typeof publicEntry.createHubSessionHost === 'function', {
  typeof: typeof publicEntry.createHubSessionHost,
});
check(
  'C.publicFactory.distinctFromInternalSplice',
  typeof publicEntry.createHubSessionHost === 'function' && publicEntry.createHubSessionHost !== sessionModule.createHubSessionSink,
  { distinct: publicEntry.createHubSessionHost !== sessionModule.createHubSessionSink },
);

// D. 负控：导入机制/环境正常（相邻模块与公共入口的既有导出在场）；对缺席名的调用为真实 TypeError。
check('D.negativeControl.edgeModule', typeof edgeModule.createHubReplicationEdge === 'function', {});
check('D.negativeControl.publicEntry', typeof publicEntry.createHubReplication === 'function', {});
let thrown: unknown;
try {
  (sessionModule.createHubSessionHost as () => unknown)();
} catch (error) {
  thrown = error;
}
check(
  'D.staleBinding.callIsTypeError',
  thrown instanceof TypeError,
  { name: (thrown as Error | undefined)?.name, message: (thrown as Error | undefined)?.message },
);

// E. 谱系事实：父基同文件曾导出旧名（git 历史文本，非行为断言）。
const parentSource = execFileSync('git', ['show', '25c51cd:packages/ws-replication/src/hub-session.ts']).toString();
check('E.lineage.parentExportPresent', /export function createHubSessionHost\(/.test(parentSource), {
  rev: '25c51cd',
  line: parentSource.split('\n').find((l) => l.startsWith('export function createHubSessionHost(')),
});

const failed = results.filter((r) => !r.ok);
console.log(`SUMMARY ${results.length - failed.length}/${results.length} PASS`);
process.exit(failed.length === 0 ? 0 : 1);
