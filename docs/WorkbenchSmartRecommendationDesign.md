# 工作台智能推荐模块设计文档

## 1. 背景

当前工作台智能推荐模块的主要问题不是展示形式，而是推荐逻辑不够可靠。

现有推荐更接近“最近笔记 + 简单规则”，容易出现以下问题：

- 把已经写完的短笔记误判为“可继续补写”。
- 只依赖更新时间、打开记录、字数等弱信号。
- 推荐理由是模板化文案，缺少真实证据。
- RAG 只用于相似笔记检索，没有参与推荐判断。
- AI 没有读取候选笔记语义，也没有输出结构化判断。
- 系统不确定时仍然使用较强的行动文案，导致用户不信任。

新版智能推荐的目标是：让工作台从“信息入口”升级为“下一步行动助手”。

当前落地决策：智能推荐默认采用本地算法，不依赖 AI。RAG 和 AI 只能作为后续可选增强，不能成为工作台推荐可用性的前提。

## 2. 设计原则

### 2.1 没有证据，不做强判断

系统不能仅因为一篇笔记短，就说它“未完成”。

强判断必须有明确证据，例如：

- 正文存在 `TODO`、`TBD`、`FIXME`。
- 正文存在未完成任务：`- [ ]`。
- 内容为空。
- 正文可见区域存在行级 `TODO`、`TBD`、`FIXME`。
- 正文可见区域存在真实未完成任务：`- [ ]`。
- 用户近期多次打开同一篇笔记。
- RAG 发现多个高相关笔记。
- AI 从内容中识别出明显未完成结构。

否则只能使用中性文案，例如：

- 建议回看
- 近期关注
- 主题相关
- 长期未读

### 2.2 默认使用本地算法

本地算法负责完成主要推荐链路：

- 提取标题、正文、Markdown 标题和任务状态。
- 基于本地关键词、中文 n-gram、英文词元计算主题相似度。
- 结合最近打开、最近编辑、长期未读、同目录关系做行为评分。
- 只在明确证据存在时输出“可继续补写”。
- 代码块、行内代码和语法演示类笔记中的示例标记不触发“可继续补写”。
- 无明确证据时只输出“建议回看”等中性理由。

### 2.3 AI 只作为未来可选增强

当前默认方案不使用 AI。

如果未来启用 AI 增强，也不能把所有笔记全文直接交给 AI。

正确流程：

1. 本地规则和 RAG 先召回候选笔记。
2. 每篇候选只提供标题、摘要、元数据、行为数据、RAG 关系。
3. AI 只负责对候选集做排序、分类和推荐理由生成。
4. AI 输出必须是严格 JSON。
5. 前端校验 JSON 后再展示。

### 2.4 推荐理由要短

工作台推荐理由不应该像解释报告。

推荐理由应该控制在 4 到 10 个字左右：

- 建议回看
- 可继续补写
- 主题相关
- 高频访问
- 长期未读
- 发现新关联
- 近期关注

### 2.5 UI 不暴露算法维度

用户不需要看到：

- 时间唤醒
- 延续写作
- RAG 关联检索
- 意图预测

这些可以作为内部推荐来源，但前台只展示 4 行推荐结果。

## 3. 推荐结果形态

智能推荐模块展示固定 4 行。

每行结构：

```text
笔记标题        简短推荐理由        时间
```

示例：

```text
中国GDP观察        主题相关        2 天前
AI安全案例整理      可继续补写      6 天前
商业创新笔记        建议回看        18 天前
艺术创作方向        长期未读        60 天前
```

交互：

- 点击整行打开对应笔记。
- 推荐不足 4 条时展示实际数量。
- 不强行凑满 4 条。

## 4. 推荐引擎架构

推荐引擎分为三层。

### 4.1 候选召回层

负责从全部笔记中找出可能值得推荐的候选笔记。

候选来源：

- 最近打开的笔记。
- 最近编辑的笔记。
- 长时间未访问但内容较重要的笔记。
- RAG 语义相似笔记。
- 高频主题相关笔记。
- 明确草稿信号笔记。

不再使用以下弱规则直接生成强推荐：

```text
字数少 = 未完成
更新时间近 = 应该补全
打开过 = 用户想继续写
```

这些只能参与打分，不能直接决定文案。

### 4.2 智能判断层

负责判断候选笔记为什么值得推荐。

判断来源：

- 本地规则。
- RAG 语义相关度。
- 用户行为数据。
- AI 结构化分析。

智能判断层输出：

- 推荐笔记 ID。
- 推荐原因类型。
- 推荐短文案。
- 置信度。
- 推荐来源。

### 4.3 展示决策层

负责从候选结果中选出最终展示的 4 条。

展示规则：

- 同一笔记只出现一次。
- 同一父目录最多 2 条。
- 同一主题簇最多 2 条。
- 优先展示高置信度结果。
- AI 不确定时使用中性文案。
- AI/RAG 不可用时自动降级。

## 5. 本地算法设计

### 5.1 特征提取

每篇笔记提取以下本地特征：

- 标题关键词。
- Markdown 标题关键词。
- 正文关键词。
- 中文 2-gram / 3-gram。
- 英文和数字词元。
- 可见正文中的未完成任务标记。
- 可见正文中的行级 TODO / TBD / FIXME。
- 是否属于语法、示例、模板、演示类笔记。
- 创建时间、更新时间。
- 最近打开顺序。
- 父目录。

### 5.2 本地相似度

使用轻量 TF-IDF 思路：

```text
title tokens     权重 3
heading tokens   权重 2
content tokens   权重 1
```

再计算候选笔记与近期关注笔记之间的余弦相似度。

### 5.3 本地排序

本地排序分数：

```text
finalScore =
  topicScore * 0.34 +
  recentOpenScore * 0.24 +
  freshnessScore * 0.13 +
  draftScore * 0.17 +
  longGapScore * 0.08 +
  sameNotebookScore * 0.04
```

### 5.4 本地推荐理由

本地理由类型：

```text
draft_signal: 可继续补写
semantic_related: 主题相关
long_gap: 长期未读
recent_focus: 近期关注
same_notebook: 同目录关联
review: 建议回看
```

## 6. AI 可选增强方式

### 6.1 AI 输入

AI 不接收完整笔记库，只接收候选摘要。

候选输入示例：

```json
{
  "noteId": "note-id",
  "title": "标题",
  "excerpt": "前 500 字或摘要",
  "createdAt": 1740000000000,
  "updatedAt": 1741000000000,
  "openCount": 3,
  "recentOpenedAt": 1742000000000,
  "draftSignals": ["todo", "empty-task"],
  "semanticMatches": [
    {
      "noteId": "related-note-id",
      "title": "相关笔记",
      "score": 0.82
    }
  ]
}
```

### 6.2 AI 输出

AI 必须输出严格 JSON。

```json
{
  "recommendations": [
    {
      "noteId": "note-id",
      "reasonType": "semantic_related",
      "reasonText": "主题相关",
      "confidence": 0.82,
      "source": "ai"
    }
  ]
}
```

### 6.3 输出校验

前端或服务层必须校验：

- `noteId` 必须存在于候选集中。
- `reasonType` 必须是允许枚举。
- `reasonText` 必须短。
- `confidence` 必须在 `0` 到 `1` 之间。
- AI 返回无效 JSON 时直接降级。

## 7. 推荐原因类型

建议内部枚举：

```ts
type RecommendationReasonType =
  | 'recent_focus'
  | 'semantic_related'
  | 'long_gap'
  | 'draft_signal'
  | 'topic_cluster'
  | 'frequent_open'
  | 'new_context'
  | 'review';
```

推荐短文案：

```text
recent_focus: 近期关注
semantic_related: 主题相关
long_gap: 长期未读
draft_signal: 可继续补写
topic_cluster: 同主题聚合
frequent_open: 高频访问
new_context: 发现新关联
review: 建议回看
```

## 8. 排序模型

最终分数建议：

```text
finalScore =
  semanticScore * 0.35 +
  behaviorScore * 0.25 +
  freshnessScore * 0.15 +
  draftEvidenceScore * 0.15 +
  diversityScore * 0.10
```

说明：

- `semanticScore`：RAG 相似度。
- `behaviorScore`：最近打开、编辑、重复访问。
- `freshnessScore`：近期变化或长期未读唤醒。
- `draftEvidenceScore`：是否存在明确未完成证据。
- `diversityScore`：避免 4 条都来自同一主题。

## 9. 降级策略

### 8.1 AI 不可用

使用 RAG + 本地规则。

可用文案限制为：

- 主题相关
- 近期关注
- 高频访问
- 长期未读
- 建议回看

### 8.2 RAG 不可用

使用本地规则 + 用户行为。

可用文案限制为：

- 近期关注
- 长期未读
- 建议回看

### 8.3 数据不足

少于 4 篇笔记时展示实际数量。

不要强行凑满 4 条。

## 10. 缓存策略

AI 推荐不应该每次进入工作台都请求。

触发刷新：

- 新建笔记。
- 保存笔记。
- 打开笔记次数变化。
- RAG 索引更新。
- 距离上次生成超过 30 分钟。
- 用户手动刷新工作台。

缓存结构：

```ts
interface SmartRecommendationCache {
  generatedAt: number;
  sourceHash: string;
  recommendations: SmartRecommendationItem[];
}
```

## 11. 数据结构建议

推荐结果：

```ts
interface SmartRecommendationItem {
  noteId: string;
  title: string;
  reasonType: RecommendationReasonType;
  reasonTextKey: string;
  confidence: number;
  source: 'ai' | 'rag' | 'rules';
  updatedAt: number;
}
```

候选数据：

```ts
interface SmartRecommendationCandidate {
  noteId: string;
  title: string;
  excerpt: string;
  createdAt: number;
  updatedAt: number;
  openCount: number;
  recentOpenedAt?: number;
  draftSignals: DraftSignal[];
  semanticMatches: SemanticMatch[];
}
```

## 12. 实现阶段

### 第一阶段：推荐真实性修正

目标：

- 去掉“字数少 = 未完成”。
- 引入 `reasonType`。
- 所有推荐理由都由证据驱动。
- 没有证据只显示中性短句。

难度：低。

预计工作量：0.5 到 1 天。

风险：低。

### 第二阶段：RAG 增强推荐

目标：

- 从最近关注笔记生成语义查询。
- 拉取 TopK 相关笔记。
- 按相似度、行为、去重、多样性排序。
- 把 RAG 相似度作为核心分数。

难度：中。

预计工作量：1 到 2 天。

风险：中。

依赖：RAG 已配置、索引可用。

### 第三阶段：AI 结构化推荐

目标：

- 新增 Workbench AI 推荐服务。
- 给 AI 输入候选摘要。
- 要求 AI 输出严格 JSON。
- 校验 `noteId`、`confidence`、`reasonType`。
- AI 失败时回退到 RAG/规则。

难度：中高。

预计工作量：2 到 4 天。

风险：中高。

主要风险：

- AI 输出不稳定。
- Prompt 需要调试。
- 需要缓存避免频繁请求。
- 需要严格防止错误推断。

### 第四阶段：用户反馈闭环

目标：

- 记录用户点击推荐。
- 记录用户忽略推荐。
- 支持关闭某条推荐。
- 根据反馈调整后续权重。

难度：中。

预计工作量：1 到 2 天。

风险：中。

### 第五阶段：扫描内容能力

这里要区分两种“扫描”。

如果是扫描已有 Markdown/文本笔记内容：

- 难度：中。
- 预计工作量：已包含在第二、第三阶段内。
- 原因：当前项目已有笔记内容读取、RAG、AI Chat 能力。

如果是扫描图片、PDF、截图、手写内容：

- 难度：高。
- 预计工作量：4 到 7 天起。
- 原因：当前项目没有明确 OCR/视觉识别链路，需要新增文件解析、OCR 或视觉模型调用、索引入库、错误处理和隐私提示。

## 13. 总体难度评估

如果只做到“真正比现在智能很多”，推荐路线是：

```text
第一阶段 + 第二阶段 + 第三阶段
```

整体难度：中高。

预计工作量：3 到 7 天。

这个范围内可以做到：

- 推荐理由不再乱猜。
- RAG 真正参与推荐。
- AI 能读取候选笔记摘要并做结构化判断。
- 推荐结果更接近用户真实上下文。
- AI 不可用时仍能稳定降级。

如果要做“扫描图片/PDF/手写内容并推荐”，难度会上升到高，需要单独作为 OCR/多模态能力建设。

## 14. 最终目标

智能推荐应该像一个克制的知识助手，而不是一个模板化提示器。

核心原则：

```text
没有证据，不说强判断。
有语义关系，才说相关。
有未完成标记，才说补写。
有用户行为，才说优先。
不确定时，只建议回看。
```
