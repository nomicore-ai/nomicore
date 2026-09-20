# ADR 0006：Cordis 持久化插件——DocPersistence 接口与 doc 三条目内容布局

日期：2026-08-21
状态：已接受（Phase 2 server 架构讨论，D-B 持久层决策）

## 背景

NomicoreServer 需要持久层。初稿方案（store 只认 opaque Uint8Array 帧、load/append/replaceWithSnapshot）被 owner 否决：把 Y.Doc 降级为字节会让大量优化不可行（同步 diff 服务、Yjs GC、智能快照、缓存管理），且持久层需要用户信息以支持按用户分区存储。

## 决策

**持久层 = Y.Doc 的存储引擎（store + cache 一体）**，看得见 Y.Doc（结构、update 事件、state vector），看不见 schema 语义（VFSL/校验规则属引擎领地）。

```ts
interface User { userId: string }

interface DocHandle {
  readonly user: User;
  readonly docId: string;
  readonly doc: Y.Doc;
  release(): Promise<void>;
}

interface DocPersistence {
  loadDoc(user: User, docId: string): Promise<DocHandle | null>;
  saveDoc(handle: DocHandle): Promise<void>;
}
```

- **共享 doc，独立 handle**：同一 `(user, docId)` 的所有成功 load 共享同一 live Y.Doc 实例（sync 接入、写入管线、REST 的权威实例），但每次 load 返回独立 DocHandle/lease；
- **并发加载合流**：同一 `(userId, docId)` cache miss 时只创建一个内部 loading Promise；所有并发 load await 同一还原过程，成功后各获得独立 handle，但 `handle.doc` 恒为同一 live Y.Doc 实例；
- **引用计数 + 身份校验**：每个 handle 对应一个不可伪造的 lease；release 幂等且仅释放本次使用权。跨 Adapter/HMR reload 的 foreign handle、已释放 handle 的 saveDoc 都响亮拒绝；引用归零仅使缓存项成为可驱逐候选，不立即释放；
- **saveDoc = 脏状态通知，不是同步落盘**：持有有效 handle 的调用方在 Doc 每次发生变更后调用 saveDoc 通知持久层；saveDoc 返回仅表示脏状态已登记，不构成该次写入已落盘的承诺；
- **持久层内部调度**：不设外部 flush/cron 协调器。第一次 dirty 启动 max-dirty 计时器（默认 5s）；每次 saveDoc 重置 debounce 计时器（默认 500ms）；任一到达即发起 flush。持续高频写入最多 5s 必定尝试一次保存，静止写入约 500ms 后保存。默认值可由插件配置覆写；retry 同属持久层内部，以退避策略重试直到成功或插件停止；
- **创建 = 首个 saveDoc**：loadDoc 不存在返回 null，调用方自建 Y.Doc 写入初始内容后以有效 handle 首次 saveDoc 即完成创建（无独立 createDoc）；
- **save 失败按 doc 只读降级，保留内存事务**：已校验并提交的事务立即进入 live Y.Doc 并正常同步；持久化是内部异步行为，失败不向触发该事务的客户端追溯报错、不通用回滚。失败后 namespace 进入 `persistence-degraded`，保留读/查询与已同步状态，拒绝**后续** REST/WS 写入；失败事务保留在同一 live Y.Doc 中，由持久层内部 retry 持久化，retry 成功后才恢复可写；不关闭整个 server。
- **release = 不再使用通知**：调用方在短 scope 的 finally 中调用 handle.release()；持久层在引用归零后可触发/等待 dirty doc 的 flush，且仅在保存成功、缓存/空闲策略满足后才真正释放实例，调用方不直接控制释放时刻；
- **v1 不提供 list**：per-user 枚举用到再补；
- **user 仅作分区键**：本层不鉴权；userId 与 namespaceId 均由 NomicoreServer 分配，作为受控安全路径段使用（不允许特殊字符/路径分隔符）。存储按用户分区，namespaceId 在用户目录内唯一。

### v1 磁盘布局与持久化格式：全量快照原子覆盖（2026-08-21，owner 决策）

```text
{rootDir}/                    # FilePersistence 插件配置
  users/
    {userId}/                 # NomicoreServer 分配的安全目录名
      {namespaceId}.snapshot  # 用户目录内唯一的 namespace 快照
```

`META.docId` 必须等于请求的 namespaceId；不一致视为持久化损坏并响亮失败。`owner` 仍不写入 META（用户归属由目录分区承载）。userId 与 namespaceId 共用安全文法 `^[a-z][a-z0-9-]{0,62}$`：同一标识可直接用于目录、REST path、WS room 与 META，无需额外编码/hash/转义。

持久层内部的 flush 在触发时以 `Y.encodeStateAsUpdate(doc)` 编码**完整 Y.Doc 状态**，写入 `{namespaceId}.snapshot.tmp` 后以原子 rename 覆盖 `{namespaceId}.snapshot`。`loadDoc` 只读取 `.snapshot` 并 `Y.applyUpdate` 还原 Y.Doc；启动发现遗留 `.tmp` 时一律忽略并删除——`.tmp` 可能半写入，只有 `.snapshot` 是提交态。

- 选择简单、可审计、单文件恢复；沿用旧 yjs-server 已验证的 temp+rename 模式；
- **rename 成功即完成一次 flush**：v1 不对每次 flush 做 file/directory fsync，`saveDoc` 本身也不承诺掉电级持久性；
- 数据保障不依赖单机 fsync：需要更强保证时，以副本、异机复制、备份/恢复演练等**冗余机制**提供，另行设计；
- 不引入 WAL、增量水位、帧格式、压缩调度或坏帧截断的实现复杂度；
- **单飞 flush + generation 保序**：每次 saveDoc 递增 dirtyGeneration；同一 doc 同时最多一个 flush。flush 启动时捕获 generation，成功后仅将该 generation 标记为已持久；若 flush 期间有新 saveDoc（dirtyGeneration 更大），doc 保持 dirty 并安排下一轮 flush——旧 snapshot 不得将新状态误标为已保存；
- 代价已知：每次 save 的 CPU/IO 与文档全量大小成正比；规模优化（增量 WAL + 周期快照）留 v2，以不改变 `DocPersistence` Interface 的 Adapter 内部替换实现。

**doc 内容布局（三条目）**：

```
Y.Doc
├── SCHEMA   信封（lang, version, id, text）——遵循哪个 schema
├── META     元信息（Y.Map：docId, createdAt）——我是谁
└── ROOT     数据根——内容本体
```

- `META.docId` = doc 实例身份（寻址键，不随 schema 升级变化）；与信封 `id`（`命名空间@schema版本` 谱系标签）语义不重叠；
- `META.createdAt` 由上层 namespace lifecycle 生成和维护；持久层不生成、不修改、不校验该字段（持久层只校验 META.docId）；
- `owner` 暂不入 META（归属先存于 store 分区路径，避免将来跨用户共享时语义尴尬）；
- META/SCHEMA 作为 ROOT 的兄弟条目，天然在 validateSnapshot/validatePatch 的校验面之外（校验只作用 ROOT 子树）。

## Cordis 插件化修订（2026-08-21，owner 决策）

NomicoreServer 与 DSH 均以 **Cordis** 为宿主内核；持久层先作为宿主无关的 Cordis 插件在 DSH 中开发、调试和验证，之后由 NomicoreServer 加载同一插件实现——不为 server 重写第二份持久化逻辑。

### 核心 seam 与 Adapter

- `DocPersistence` 是 Cordis service Interface；插件通过 Cordis 提供/注入该 service。service 是 Host 长生命周期资源，DocHandle 是请求/命令/WS 连接等短 scope 的 lease；
- `MemoryPersistence` 与 `FilePersistence` 是两个真实 Adapter（两个 Adapter 证明 seam 不是假想抽象）；
- 插件实现只依赖 Cordis、Yjs 与持久化 contracts，**不得 import DSH 或 NomicoreServer app**；
- DSH 与 NomicoreServer 都只是 Cordis Host：前者装调试/inspector 插件，后者只装生产插件集合；
- 插件采用工厂/实例模型而非全局单例，以支持测试隔离、不同 rootDir 与 HMR/reload；
- dispose 时释放文件句柄、后台任务和 Y.Doc 缓存；宿主负责按依赖逆序停止插件；Persistence 内部 timer 绑定 Host root Context 而非 adapter fiber，使依赖方卸载排空期间已接纳写仍可完成 dirty notification，最终由 adapter dispose 显式清理；

### 实施顺序

1. persistence contracts + Cordis service 注册；
2. MemoryPersistence 插件 + contract tests；
3. FilePersistence 插件（用户分区、缓存身份、显式 save、手动 evict、恢复与崩溃测试）；
4. DSH 开发 profile + inspector 探针；
5. 上述插件在 DSH 调通后才启动 NomicoreServer 极薄 Cordis Host。

## 被否方案

- **opaque 字节接口**：持久层只认 Uint8Array——同步 diff、GC、缓存管理全部不可行（owner 裁决）；
- **批量 flush / 隐式插桩落盘**：旧系统的「内存脏 doc + 定期 flush」有崩溃窗口；隐式插桩剥夺管理操作的落盘时机控制；
- **docId 放 JS 属性**：不落盘、不随同步走、WAL 脱离 store 上下文不可识别——违反自包含原则（doc 应完整自述：遵循哪个 schema、是谁、内容本体）。

## 后果

- v1 限制：单进程（无文件锁）、load 全量入内存；
- WAL 帧格式（length+crc、坏帧截断、Yjs 重放幂等）不进入 v1；作为 v2 增量持久化 Adapter 的内部实现候选，不进 API；
- 与 DocScope（schema 编译产物缓存，H3）正交汇合：loadDoc → 读 SCHEMA → DocScope.getCompiled → 可校验；
- 事务原子性由 Y.transact（单 update 单元）保证，store 无需多写事务。

## 关联

- ADR 0001（自包含、变更历史与数据同源）、ADR 0003（ROOT 约定）、设计文档 §10（作用域隔离）、§11（schema 变更管理操作）
- 旧 yjs-server 借鉴清单：fs 原子写（temp+rename）、flush/cleanup 调度经验（归属上层 cron 而非 store）

### createDoc 与 owner 语义修订（2026-08-21，issue #64；演进经 owner 裁决放行）

本节修订上方两处早期决策条款，取代关系如下；未提及的条款维持原文效力。

**1. 创建语义（取代「创建 = 首个 saveDoc（无独立 createDoc）」）**：`DocPersistence` 提供
`createDoc(owner, docId, doc): Promise<DocHandle>`，对 `(owner.userId, docId)` 排他创建：

- cache/store 已存在或并发创建 → 拒绝 `DocDuplicateError`（稳定错误码 `DOC_DUPLICATE`）；
  **在 duplicate 判定路径上绝不覆盖已提交内容**——cache 命中即拒、store 存在性读见快照即拒、
  并发 claim 即拒，三条判定都在进入写路径之前；并发 create 恰好一个成功，落败者在进入写路径前被拒；
- 创建成功前初始完整 snapshot 已提交（`Y.encodeStateAsUpdate(doc)` 直写；FilePersistence 以
  temp→rename 完成为提交点；不新增 fsync 保证）；成功签发有效 lease 且 `handle.doc === doc`，
  持久层接管该 doc 生命周期（eviction/dispose 时销毁）；
- 失败时不返回 handle、不缓存、不销毁传入 doc，所有权仍归调用方；原始 I/O 错误原样上抛；
- create/create 与 create/load 共享 per-key coordination；若同 key 的 load 已在读取 store，
  create 必须等待该 read 的存在性证据：读到 snapshot 则拒绝 `DocDuplicateError`，读到 missing
  才能进入写路径。pending load 按自己的 read 结果完成；实现不得以 supersede 或事后告警替代
  duplicate 判定，更不得覆盖已提交 snapshot；
- 持久层仍仅校验 `META.docId === docId`，不校验 VFSL/ROOT/createdAt；`saveDoc` 的
  「脏通知 + 内部调度」语义不变，首个 saveDoc 仍是合法写入路径。

**2. 接口契约（取代本文上方接口代码块的 `DocHandle.user` 与二方法签名）**：

```ts
interface User { userId: string }

interface DocHandle {
  readonly owner: User;   // 文档的存储所有者（分区键），非当前访问者
  readonly docId: string;
  readonly doc: Y.Doc;
  release(): Promise<void>;
}

interface DocPersistence {
  createDoc(owner: User, docId: string, doc: Y.Doc): Promise<DocHandle>;
  loadDoc(owner: User, docId: string): Promise<DocHandle | null>;
  saveDoc(handle: DocHandle): Promise<void>;
}
```

`owner` 仅作分区键，本层不鉴权（与「user 仅作分区键」条款同义，术语对齐）；访问者授权
不进入 Persistence Interface。内部 Entry、契约测试与文档随接口统一 owner 语义。

**3. 实施注记**：create/load 同键协调与 flush 调度收敛为 adapter 共享的 persistence
lifecycle core（MemoryPersistence 与 FilePersistence 共用，不得复制状态机）；两 Adapter
必须通过同一组 createDoc shared contract tests。

**4. supersede 裁决撤销（2026-08-21，PR #67 review 修订）**：此前 task archive 中关于
create supersede pending load、early adoption 与 lost-update 事后告警的设计/测试记录已被撤销，
不构成当前契约。它允许在 read 尚未返回时写入，无法满足「store 已存在则拒绝且不覆盖」；当前
语义以本节第 1 条的等待 read 证据规则为准。跨 Adapter 实例的原子 create-if-absent 仍需由
后续 FilePersistence 工作在 store seam 落实，不能由单实例内存协调替代。

### DocHandle entry status 与 saveDoc 职责修订（2026-08-22，issue #79；演进经 owner 裁决放行——issue #79 AC1/AC8 明文授权）

本节为**增量演进**：扩展 DocHandle 接口形状（新增 `getStatus()`），并修订「save 失败按 doc 只读降级」条款中 degraded 拒绝面的归属。除下列明示条款外，未提及的条款（含「createDoc 与 owner 语义修订」节全部条款）维持原文效力。

**1. 接口契约（在「createDoc 与 owner 语义修订」节的接口代码块上追加 `getStatus` 成员，其余成员不变）**：

```ts
type DocHandleStatus = 'ready' | 'persistence-degraded' | 'released' | 'disposed'

interface DocHandle {
  readonly owner: User;   // 文档的存储所有者（分区键），非当前访问者
  readonly docId: string;
  readonly doc: Y.Doc;
  /** 同步返回本 handle 所属 (owner.userId, docId) entry 的持久层状态。 */
  getStatus(): DocHandleStatus;
  release(): Promise<void>;
}
```

- 状态查询是 **entry 级**的：恒答该 handle 自己的 `(owner.userId, docId)` entry 状态，不得以 Adapter 聚合状态代替（Adapter 级 `getStatus` 是粗粒度健康汇总，仅供运维观测，不构成写前 gate 依据）；
- 状态词与优先级冻结：`disposed`（签发方已 dispose）> `released`（本租约已释放）> entry 状态（`persistence-degraded`：该 entry 最近一次 flush 失败且尚未 retry 成功；`ready`：其余情形，含 flush 在途）；
- `getStatus()` 只表示**调用瞬间**状态，不承诺后续 flush 成功——写前状态检查不是持久化成功保证（与「saveDoc 返回仅表示脏状态已登记」「rename 成功即完成一次 flush，不承诺掉电级持久性」同款无承诺纪律）。

**2. saveDoc 职责（修订「saveDoc = 脏状态通知」与「save 失败按 doc 只读降级」条款的边界）**：

- saveDoc 是 **mutation 后的 dirty notification**：只要租约有效（未 released、非 foreign、身份匹配、Persistence 未 disposed），saveDoc 必须递增 dirtyGeneration 并 resolve——entry 处于 `persistence-degraded` **不构成拒绝理由**；已提交进 live Y.Doc 的事务由持久层内部 retry 以完整 Y.Doc 状态最终持久化；
- 「失败后 namespace 进入 `persistence-degraded`……拒绝**后续** REST/WS 写入」的拒绝面归属**业务编排层**：Runtime（ADR 0007 NamespaceRuntime 写前 gate）在业务 mutation 前读取 `handle.getStatus()`，已 degraded 则拒绝开始新写入（零写入：文档不变、响亮拒绝）。持久层自身仅在租约身份失效（foreign/released/身份失配）或 disposed 时响亮拒绝；
- gate 检查通过后才转为 degraded 的 mutation 不属「后续」写入：其内存事务保留、saveDoc 正常登记、由 retry 覆盖最新完整 live Y.Doc；
- 降级等待期内（任一可观察时刻）retry 退避即该 entry 的唯一 flush 调度源（退避上限 max-dirty 间隔；flush 记账的 catch→finally 同步续体内允许瞬态并存，无外部可观察后果），「不设外部 flush/cron 协调器」不变。

**3. 实施注记**：entry 状态解析收敛于 adapter 共享的 persistence lifecycle core（两 Adapter 不得复制状态机）；MemoryPersistence 与 FilePersistence 以平行验收套件覆盖同一状态契约（`issue-79-entry-status.test.ts` / `issue-79-file-entry-status.test.ts`）。

---

## 对齐说明：issue #131（Phase 5 切片 1：Registry 普通 create 的 namespaceId 生成）

日期：2026-08-27；状态：已接受。本说明只对齐 Registry 身份演进，**不修改本 ADR 任何 Persistence 契约条款**。

Namespace identity、普通 create 的 ID 生成与 Registry 碰撞处理以 [ADR 0010「Namespace identity、owner 与复制范围」](./0010-hub-peer-websocket-ydoc-replication.md#namespace-identityowner-与复制范围) 为唯一权威来源。本 ADR 仅保留 Persistence 边界：仍按 owner 分区，`createDoc(owner, docId, doc)` 仍以 `(owner.userId, docId)` 排他创建并通过 `DOC_DUPLICATE` 报告重复；不新增跨 owner catalog 或全局唯一约束。Registry 改为以 namespaceId 索引，不改变不同 owner 下相同 docId 属于不同持久化 entry 的既有语义。

### 复制导入、归档与只读身份探针修订（2026-08-28，issue #133 round-2；owner feedback 3 授权）

本节为**增量演进**，修订上方与 Phase 5 import/archive 生命周期有关的接口空白；除下列明示条款外，所有既有条款（尤其 owner 分区、`saveDoc` dirty notification、全量 snapshot、主 snapshot temp→rename、`META.docId`）维持效力。

**1. `importDoc(owner, docId, doc)` 是排他创建能力**：duplicate 绝不覆盖（claim 排他 + `DOC_DUPLICATE`）；成功 = 主快照提交后才签发 handle/ownership；本层只校验 `META.docId === docId`（违约 → `DocImportIdentityError`）。复制身份与 Hub 广告的**完全一致核对是调用方（Registry 受信 bootstrap 编排）在所有权转移之前的职责**——Persistence 不是、也不得成为 Hub 广告授权/复制策略引擎；本层不接收也不校验复制身份期望值。

**2. `archiveDoc(owner, docId, expected)` 只允许在无有效 handle（且在途 dirty 已排空）时执行**：它先排空既有 dirty 状态，再以持久快照复制事实为权威做身份守卫读取（单一谓词：`replicationId`/`replicationEpoch` 与 expected 完全一致；缺失/单键/undefined/格式违约/字节损坏/`META.docId` 不符统一 `DOC_ARCHIVE_IDENTITY_MISMATCH`），随后写全量归档快照并移除主键。身份不匹配/active handle/duplicate/operational/fatal 的分类与 committed-aware 重定位语义保留 round-1 条款：`guard-read`/`relocate-write` 为 committed:false，`relocate-remove` 为 committed:true。

**3. 归档布局与原子语义**：File 归档布局为 `{rootDir}/archive/users/{userId}/{docId}.snapshot`，暂存为对应归档路径 `.tmp`；归档写经 mkdir→writeFile tmp→rename 原子提交，同名重复归档为单槽 latest-wins 原子覆盖，tmp 永不提交。Memory 提供行为等价的独立归档分区（不经 writeSnapshot hook）。**提交边界 = 归档写（rename/write resolve）**：若随后主键移除拒绝，归档字节已提交——`archiveDoc` 必须拒绝 `DocArchiveFatalError('relocate-remove')` 且 `committed:true`，不得报告 operational、identity mismatch 或 duplicate；Registry 必须以 `committed:true` 原样传播为 `NamespaceRegistryFatalError`，而非领域 `RESET_FAILED`。重试是**收敛性**重试：它重新守卫/读取仍存在的主键、latest-wins 覆盖同一归档槽、再重试移除；它绝不主张主键仍是唯一已提交状态。

**4. Persistence 内部只读 committed-identity probe（`readPersistedReplicationIdentity(owner, docId)`）**：为 Registry reset preflight 提供——只读受信任主快照（owner 分区 key + `PersistenceIO.read`），在 detached 临时 Y.Doc 解码后应用既有 `META.docId` 与复制事实格式校验；**不签发 handle、不建 live cell、不调用 saveDoc、不排空 dirty、不写/flush/archive、不转移所有权**。其 typed 拒绝面：当前生命周期 epoch 内的 store 读拒绝 → `DocPersistedIdentityProbeOperationalError`（唯一普通运营失败）；Yjs 解码失败/`META.docId` 不符/载体非法 → `DocPersistedIdentityProbeCorruptError`；dispose/abort/契约违约 → `DocPersistedIdentityProbeFatalError`。全部 `committed:false`（本 seam 从不写或转移所有权——INV-12）；消息为稳定常量，不回显 owner/identity/bytes。该 probe **不是** live-state 降级回退：I/O 失败保持 loud/typed，绝不读取 live Y.Doc 冒充持久事实。

### 逻辑删除修订（2026-09-07，issue #228；ADR-0014-LOG「Host 执行数据删除请求时必须同时调用日志删除能力」的持久层 seam——演进经 SA8 前置门禁 B1 预授权 + 设计后复审 clear）

本节为**增量演进**，新增 `DocPersistence` 可选成员 / `ReplicaPersistence` **必具**成员 `deleteDoc(owner, docId)` 与共享 lifecycle 的新 I/O seam `PersistenceIO.removeKey`；除下列明示条款外，所有既有条款（owner 分区、`saveDoc` dirty notification、全量 snapshot、主 snapshot temp→rename、`META.docId`、import/archive/probe 的 optional/required 放置）维持效力。

**1. 接口契约（在既有接口面追加）**：

```ts
// DocPersistence（optional——13 个既有 stub 与 wrapIo 字面量绿守卫不因 required 面变红）
readonly deleteDoc?: (owner: User, docId: string) => Promise<Readonly<{ ok: true }>>
// ReplicaPersistence（required——Memory/File 恒提供；与 importDoc/archiveDoc 同款放置先例）
readonly deleteDoc: (owner: User, docId: string) => Promise<Readonly<{ ok: true }>>
// PersistenceIO（lifecycle seam；optional 成员，io 构造期成型不可变）
removeKey?(key: string, signal: AbortSignal): Promise<void>
```

**2. 语义 = 活跃存储逻辑删除**：按 `(owner.userId, docId)` 移除主键 committed snapshot（File：`{rootDir}/users/{userId}/{docId}.snapshot` + 同名 `.tmp`；Memory：主 mirror）与同 key 受控归档位（File：`{rootDir}/archive/users/{userId}/{docId}.snapshot` + `.tmp`；Memory：独立 `archiveSnapshots` 分区）——**delete ≠ archive**：无身份前置、无归档写、删除时清理归档位（归档语义「不触碰归档区」由 removeKey 的独立 seam 切分保持，`remove` 零改动）。只承诺活跃存储逻辑删除，不承诺 SSD/备份/对象存储版本中的物理 secure erase（ADR-0014-LOG L299 措辞纪律；文档与实现均不出现 erase/purge/secure 字样）。

**3. 幂等与失败面**：absent 与 deleted 不可区分（两处均已缺席仍 resolve `{ok:true}`——删除不是存在性预言）；resolve ⟺ 主键与归档位此后均缺席（File 顺序：主键先 = 提交点、归档位后；全程 ENOENT 容忍——`fsp.rm force:true` 逐处）；reject ⟹ 可能部分完成，重试收敛（单调性：删除只前进不回退，无路径把「已删」翻回「存在」）。拒绝分类：`DocDeleteActiveHandleError`（live handle 存在——删除只在无有效 handle 时执行，调用方释放后重试）、`DocDeleteOperationalError`（`io.removeKey` 在当前 epoch 的 store 级拒绝——cause 原样、重试收敛）、`DocDeleteFatalError`（phase 词表 `lifecycle-disposed` / `adapter-violation` / `remove-aborted`，恒 `committed:false`——removeKey resolve 后无失败路径）。

**4. 状态机与复活向量封堵**：lifecycle per-key cell 状态联合新增 `'deleting'`（claim 排他，镜像 `'archiving'` 放置——settle 后置位、op 段持守、成败双路 identity 守卫清理）；既有全部 cell 消费方（createDoc/importDoc claim 环、loadDoc resolve 环、archiveDoc claim 环、`seedForTest` 拒绝清单）同变更集消费新态（漏一处即 busy-loop 或错误分类）。settle-for-delete 与归档 settle 的关键差异 = **被删除的 doc 不需要 flush 持久化**：零-handle 时取消全部定时器（debounce/maxDirty/retry——含失败 flush 新武装的 retryTimer）并驱逐 cell（`entry.doc.destroy()` 镜像 settle 先例）；`flushing === true`（在途 flush 已越过入口门）必须等待其结算（`archiveWaiters` 通知面），结算后重入重读再 cancel-then-evict（次序倒置 = 定时器在已驱逐 entry 上点火写回 = 复活）。复活向量封堵证明：(i) pending debounce flush——settle 取消定时器（未点火）或等待（已点火 in-flight）后 removeKey，此后无任何定时器/句柄能再写该 key；(ii) 新 saveDoc——cell 已驱逐，`assertOwnedHandle` 拒绝；(iii) 新 loadDoc/createDoc——删除后 key 缺席 → loadDoc null；createDoc 是新 namespace 的合法重建（与归档后重建同构）。

**5. capability 门与实施注记**：lifecycle 入口同步段 `assertDeleteIo`（`typeof io.removeKey !== 'function'` → bare loud Error，镜像 `assertArchiveIo`）；Memory 侧 loud 配置门与 remove 同款（readSnapshot 接线而 deleteSnapshot 缺席 → loud 拒绝，绝不对外部 read 权威谎报删除）；`dispose()` 语义不变（abort → removeKey 拒绝经 `remove-aborted` 收口，inFlight allSettled 覆盖删除全程）；删除槽内只含异步 I/O（`fsp.rm` promise 面），无同步 fs 段。

### 完成式排空 drain、retryDelayMs 与停机硬契约修订（2026-09，issue #412；owner 要求 comment 5751613018）

本节为**增量演进**，新增 `DocPersistence` 可选成员 `drain(targets?)`、`PersistenceSchedule` 可选键 `retryDelayMs` 与公开目标词汇 `PersistenceDrainTarget`。除下列明示条款外，所有既有条款（owner 分区、`saveDoc` dirty notification、全量 snapshot、主 snapshot temp→rename、`META.docId`、import/archive/probe/delete 的 optional/required 放置、§228-5 `dispose()` 语义）维持效力。owner 要求（comment 5751613018）：优雅停机必须有 dispose 前 await drain 的**硬契约**；dispose 语义/契约必须与本 ADR 对齐；dispose 保持 abortive 时保留**分层公开 drain** 方式。

**1. 接口契约（在既有接口面追加）**：

```ts
// 公开目标词汇（issue #412）：内部 `${userId}\u0000${docId}` 复合键保持私有
export interface PersistenceDrainTarget {
  readonly owner: User
  readonly docId: string
}
// DocPersistence（optional——三成员字面量与既有 stub 绿守卫不因 required 面变红；
// 具体 adapter 类面（MemoryPersistence/FilePersistence）为必然可达的 required 实现）
readonly drain?: (targets?: readonly PersistenceDrainTarget[]) => Promise<void>
// PersistenceSchedule（optional 键——与 debounceMs 正交）
readonly retryDelayMs?: number
```

**2. `drain()` 语义 = 完成式排空**（不是 flush-all 便捷方法，也不是定时排空窗）：

- **范围**：`targets` 给定 → 仅这些 `(owner, docId)`；未提供 → 全部。仅 **live** 持久化 entry 参与；非 live cell（reading/creating/archiving/deleting）不在范围（其完成语义归各自调用方）；无对应 live cell 的 target 与 `targets: []` 均为 no-op（缺席即完成）。
- **每 entry**：degraded 回退窗（retry 定时器武装）→ **被动等待**（不强制即时重试、不热循环——本条与第 4 条「退避即唯一 flush 调度源」一致）；在途 flush → 等待其结算（key 内 single-flight，零重复发起）；idle 且脏（含有 handle 与零 handle）→ 立即强制 flush（跳过 debounce/max-dirty 定时器）；干净 → 跳过（零 write、不清定时器、不驱逐）。
- **返回语义 = 静息观察点结算**：resolve ⟺ **最后一轮扫描观察时**范围内无「脏且可推进」「在途」「回退窗等待」的 live entry。终扫观察之后才 ACK 的 `saveDoc` **不属**本次调用覆盖范围；优雅停机链中该边界由链路前置条件关闭（`registry.shutdown()` 已释放全部 lease、接纳已停，无并发写者）。
- **非破坏性**：不 abort、不 destroy、不清调度面、不驱逐、不改 epoch/`closed` 与 `getStatus` 词表。drain 返回后 `dispose()` 可安全立即执行；`dispose()` 之后再调用 drain 为 **vacuous 完成**（立即 resolve——dispose 后无 live 脏状态可排空）。drain 是幂等可重入的：多次调用各自独立成环、各自以自己的静息观察点结算。
- **无时间预算（库级）**：持续失败的 store 下 drain **不 resolve**——这是完成式语义的诚实代价（见第 4 条「重试直到成功或插件停止」）；总界属宿主策略（第 3 条），不进本 API。
- **失败面**：store 失败面**永不 reject**（写失败沿既有 degraded + 内部退避吸收，drain 不引入新 typed 错误）。例外：File adapter 对不安全 target 沿既有 `validateIdentity`（`SAFE_PATH_SEGMENT` 双段）以 bare Error loud 拒绝——输入校验通道，非 store 失败面。

**3. 停机硬契约（无条件；owner 要求 comment 5751613018）**：**宿主优雅停机在调用 `dispose()` 之前必须先 await `drain()`**——至 drain 完成，或至宿主显式预算耗尽且该事实可观察（yjs-server 的实现 = `persistence-drain-budget-exceeded{budgetMs}` stdout NDJSON 事件，发射位在 registry shutdown 之后、persistence dispose 之前）。预算尽后继续走 `dispose()` 有损路径是硬契约的**显式可观察退出**，不是违约；未经任何 drain 直接 dispose 的宿主接受（静默地）丢失已 ACK 未写入 store 的状态。

- **适用面（不以 adapter 类型特判）**：契约边界是**配置的 store 面**而非 adapter 类名。`MemoryPersistence` 可经 `writeSnapshot` hook 接线外部 store（hook store 为该实例唯一读权威），此类 memory 实例与 file 实例具有同质的「已 ACK 写需 drain 兑现进 store」保护对象；yjs-server 对 file 与 memory 两种配置执行**同一**停机排空步（`adapter.drain()` + 宿主预算 race）。未接线外部 store 的 memory dev 配置不因 drain 获得跨实例耐久事实（`dispose` 清 mirror 的语义不变），但「dispose 前 in-flight/脏状态 settle」的契约形状与耐久配置完全一致。
- **与 :34 的关系（不冲突申明）**：drain 是归档 settle 范式（:37/:213 内在先例）的**一次性公开化**，不是周期性外部 flush/cron 协调器；降级等待期内 retry 退避仍是唯一调度源（第 4 条）。「重试直到成功或插件停止」中**「插件停止」的宿主侧映像 = 宿主预算**：预算尽 → 事件 + 有损 dispose；库级 drain 本体不设超时参数。
- **实施注记（yjs-server）**：预算 = `maxDirtyMs + DRAIN_MARGIN_MS`（file 配置；memory 配置无 schedule 键 → `DEFAULT_MAX_DIRTY_MS + DRAIN_MARGIN_MS` 缺省推导），由 `MAX_MAX_DIRTY_MS` 立法保证 < 60s 停机 watchdog；预算覆盖**正常路径**最坏等待（强制即时 flush + max-dirty 级退避节奏 + I/O 边距），**不得**表述为「drain 恒有界」。

**4. `dispose()` 对齐条款（owner 要求 comment 5751613018；本节修订并扩展 :86 的 dispose 定义边界）**：:86 所列「释放文件句柄、后台任务和 Y.Doc 缓存」之外，本节显式声明——`dispose()` 语义**不变且保持 abortive/有损**（abort → clearTimers → doc.destroy → cells.clear → `allSettled(inFlight)`；§228-5 重申），**它从来不是持久性屏障**；「dispose 之前的持久性」唯一经**分层公开 drain** 表达：drain = 完成式排空层，dispose = abortive 拆卸层，两者不合并（否决「dispose 内部先 drain 再 abort」：击穿 §228-5 冻结面、degraded store 下把挂起从宿主层搬进库层更糟、剥夺宿主预算控制权）。drain 与 dispose 的交错语义：dispose 同步段释放 settle waiters → drain 续体重扫见 `closed` → vacuous resolve（不二次报告已发生的丢失）。

**5. `retryDelayMs` 与解析形状（DD-2 裁决，实现红线）**：显式配置时重试**首基准** = `retryDelayMs`（与 `debounceMs` 正交），其后退避增长 ×2、上限 `maxDirtyMs` 不变。**键缺席时解析结果的键形状不变**：缺省回退在 lifecycle 内**动态**取解析后的 `debounceMs`（不是固定默认值，也不物化进 resolved schedule）——既有 `toEqual` 冻结审计与 DSH 探针记录头零迁移。显式 `0` 与 `debounceMs: 0` 同款折叠为 1（防 0ms 热重试）；非法值沿既有逐键校验环 → `RangeError`。

**6. 排空通知面不变量（liveness 完备化）**：`archiveWaiters` 是 archive/delete/drain settle 排空路径共用的通知面；**任何移除 live entry 的路径必须释放其 settle waiters**（dispose 通知点、delete 的 cancel-then-evict 腿、archive 的干净驱逐腿、`maybeEvict`）——否则等待者在该 entry 被驱逐后永不结算。

**7. 归档裁决存档**：drain 不参与非 live cell 的完成语义（reading/creating/archiving/deleting 由各自调用方持有完成语义）；drain 不驱逐、不清理调度面，drain 后仍被武装的陈旧 debounce/max-dirty 定时器到点由既有 generation/干净守卫早退（零 write），后续 `saveDoc` 的 `scheduleFlush` 自然覆盖重武装。
