# RAG 功能使用指南

## 什么是 RAG？

RAG（Retrieval-Augmented Generation，检索增强生成）是一种结合了信息检索和AI生成的技术。在 Pilotra 中，RAG 功能可以：

- 🔍 **语义搜索**：理解问题的含义，而不仅仅是关键词匹配
- 🎯 **智能检索**：找到语义相关的笔记内容，即使没有完全匹配的关键词
- 📊 **相似度评分**：显示每个结果与查询的相关程度

## 快速开始

### 1. 配置 AI 服务源

首先需要配置一个支持嵌入（Embedding）的 AI 服务：

1. 打开 **首选项 > AI配置**
2. 点击 **添加服务源**
3. 填写配置信息：
   - **服务源名称**：例如 "OpenAI Embeddings"
   - **API 端点**：
     - OpenAI: `https://api.openai.com/v1/chat/completions`
     - DeepSeek: `https://api.deepseek.com/chat/completions`
     - 或直接使用嵌入端点：`https://api.openai.com/v1/embeddings`
   - **API 密钥**：你的 API Key
   - **默认模型**：例如 `text-embedding-3-small`

💡 **重要提示**：
- 系统会自动将 `/chat/completions` 转换为 `/embeddings`
- 如果转换后仍然404，请直接使用嵌入端点（如 `https://api.openai.com/v1/embeddings`）
- 确保你的API密钥有权限访问嵌入API

#### 端点转换规则

系统会按以下规则自动转换端点：

| 输入端点 | 转换后端点 |
|---------|-----------|
| `https://api.openai.com/v1/chat/completions` | `https://api.openai.com/v1/embeddings` |
| `https://api.openai.com/v1/completions` | `https://api.openai.com/v1/embeddings` |
| `https://api.openai.com/v1` | `https://api.openai.com/v1/embeddings` |
| `https://api.openai.com/v1/embeddings` | `https://api.openai.com/v1/embeddings` (不变) |

#### 支持的服务提供商

**OpenAI**
- 端点：`https://api.openai.com/v1/chat/completions`
- 模型：`text-embedding-3-small`, `text-embedding-3-large`, `text-embedding-ada-002`
- 维度：1536 或 3072

**DeepSeek**
- 端点：`https://api.deepseek.com/chat/completions` 或 `https://api.deepseek.com`
- 模型：`deepseek-embedding` （注意：不是 `deepseek-chat`）
- 维度：1536
- 价格：¥0.0002/千tokens（非常实惠）

**重要提示**：
- ⚠️ DeepSeek的嵌入模型是 `deepseek-embedding`，不是 `deepseek-chat`
- ⚠️ 如果使用聊天模型会导致404错误
- ✅ 系统会自动将端点转换为 `https://api.deepseek.com/embeddings`

**其他兼容 OpenAI API 的服务**
- 只要支持 `/embeddings` 端点即可

### 2. 启用 RAG 功能

1. 打开 **首选项 > 知识库(RAG)**
2. 启用 **知识库检索** 开关
3. 选择 **嵌入模型服务源**（刚才配置的服务）
4. 输入 **嵌入模型** 名称（如：`text-embedding-3-small`）

### 3. 配置索引参数

根据你的需求调整以下参数：

#### 文本分块大小（Chunk Size）
- **默认值**：500 字符
- **范围**：100-2000
- **说明**：每个文本块的大小。较小的块更精确，较大的块包含更多上下文
- **建议**：
  - 中文笔记：400-600 字符
  - 英文笔记：600-1000 字符

#### 分块重叠（Chunk Overlap）
- **默认值**：50 字符
- **范围**：0-500
- **说明**：相邻文本块的重叠部分，避免信息在分块边界丢失
- **建议**：设置为分块大小的 10%

#### 检索结果数（Top K）
- **默认值**：5
- **范围**：1-20
- **说明**：返回最相关的文本块数量
- **建议**：3-10 个结果

#### 相似度阈值（Similarity Threshold）
- **默认值**：0.7
- **范围**：0-1
- **说明**：最低相似度分数，低于此值的结果会被过滤
- **建议**：
  - 精确搜索：0.8-0.9
  - 宽松搜索：0.6-0.7

### 4. 建立索引

有三种方式建立索引：

#### 方式一：手动重建索引
1. 在 **首选项 > 知识库(RAG)** 中
2. 点击 **重建索引** 按钮
3. 等待索引完成

#### 方式二：启动时自动索引
1. 启用 **自动索引** 开关
2. 重启应用
3. 应用会在启动时自动索引所有笔记

#### 方式三：保存时自动索引
1. 启用 **保存时索引** 开关
2. 每次保存笔记时，会自动更新该笔记的索引

### 5. 使用语义搜索

1. 打开搜索对话框（快捷键：`Ctrl+F` 或 `Cmd+F`）
2. 勾选 **🧠 语义搜索**
3. 输入你的问题或关键词
4. 查看搜索结果：
   - ✨ 相似度分数（颜色编码）
   - 📝 笔记标题
   - 📄 匹配的内容片段
   - 📍 内容位置信息

## 相似度分数说明

搜索结果会显示相似度分数，表示内容与查询的相关程度：

- 🟢 **90%+**（优秀）：高度相关，几乎完全匹配
- 🔵 **80-89%**（良好）：很相关，内容匹配度高
- 🟡 **70-79%**（一般）：相关，但可能不够精确
- ⚪ **<70%**（较低）：相关性较弱

## 使用技巧

### 搜索技巧

1. **使用自然语言**
   - ❌ 不好：`python 函数`
   - ✅ 好：`如何在 Python 中定义函数？`

2. **描述你要找的内容**
   - ❌ 不好：`API`
   - ✅ 好：`如何调用 REST API 获取数据？`

3. **提供上下文**
   - ❌ 不好：`错误`
   - ✅ 好：`React 组件渲染时出现的常见错误`

### 性能优化

1. **合理设置分块大小**
   - 笔记较短（<1000字）：使用较小的分块（300-400）
   - 笔记较长（>5000字）：使用较大的分块（600-800）

2. **控制索引频率**
   - 如果笔记很多，建议关闭"启动时自动索引"
   - 使用"保存时索引"来增量更新
   - 定期手动重建索引（如每周一次）

3. **调整检索参数**
   - 如果结果太少：降低相似度阈值（如 0.6）
   - 如果结果太多：提高相似度阈值（如 0.8）
   - 如果需要更多结果：增加 Top K 值

## 常见问题

### Q: 为什么搜索没有结果？

**可能原因：**
1. 索引未建立或已过期
2. 相似度阈值设置过高
3. 嵌入模型配置错误

**解决方法：**
1. 点击"重建索引"按钮
2. 降低相似度阈值到 0.6
3. 检查 AI 服务源配置是否正确

### Q: 索引需要多长时间？

**时间估算：**
- 100 个笔记：约 1-2 分钟
- 500 个笔记：约 5-10 分钟
- 1000 个笔记：约 10-20 分钟

**影响因素：**
- 笔记总字数
- API 响应速度
- 网络连接质量

### Q: 索引会占用多少空间？

**存储估算：**
- 每 1000 字约占用 4-6 KB
- 100 个笔记（平均 2000 字）：约 1 MB
- 1000 个笔记：约 10 MB

### Q: 如何选择嵌入模型？

**推荐模型：**

**OpenAI**
- `text-embedding-3-small`：性价比高，适合大多数场景
- `text-embedding-3-large`：更高精度，适合专业场景
- `text-embedding-ada-002`：经典模型，稳定可靠

**DeepSeek**
- `deepseek-embedding`：中文支持好，价格实惠

**选择建议：**
- 中文为主：DeepSeek 或 OpenAI
- 英文为主：OpenAI
- 预算有限：选择 small 版本
- 追求精度：选择 large 版本

### Q: API 调用会产生费用吗？

**是的**，生成嵌入向量需要调用 AI API，会产生费用。

**费用估算（OpenAI text-embedding-3-small）：**
- 价格：$0.02 / 1M tokens
- 100 个笔记（约 200,000 字）：约 $0.01
- 1000 个笔记：约 $0.10

**节省费用的方法：**
1. 只在必要时重建索引
2. 使用"保存时索引"而不是"启动时自动索引"
3. 选择更便宜的模型或服务商

### Q: 数据安全吗？

**是的**，RAG 功能的数据安全性：

1. **本地存储**：向量数据存储在本地 `.rag` 目录
2. **仅嵌入调用**：只有生成嵌入时才调用 API
3. **不上传原文**：搜索时不会将笔记内容发送到服务器
4. **可离线搜索**：索引建立后，搜索在本地进行

## 故障排除

### 错误：RAG is not fully configured

**原因**：嵌入模型配置不完整

**解决**：
1. 检查是否选择了嵌入服务源
2. 检查是否填写了嵌入模型名称
3. 确保 AI 服务源配置正确

### 错误：HTTP 404: Not Found

**原因**：嵌入API端点不存在或配置错误

**解决方法**：

1. **检查端点配置**
   - 确认API服务商支持嵌入API
   - 查看控制台日志中的"Normalized endpoint"
   - 确认转换后的端点是否正确

2. **手动配置嵌入端点**
   - 不使用聊天端点，直接配置嵌入端点
   - OpenAI: `https://api.openai.com/v1/embeddings`
   - DeepSeek: `https://api.deepseek.com/embeddings`

3. **验证API密钥权限**
   - 确保API密钥有权限访问嵌入API
   - 某些API密钥可能只有聊天权限

4. **查看详细日志**
   - 打开开发者工具（F12）
   - 查看控制台中的详细错误信息
   - 记录"Original endpoint"和"Normalized endpoint"

**调试步骤**：
```
1. 查看日志输出：
   [Embedding Service] Original endpoint: https://...
   [Embedding Service] Normalized endpoint: https://...

2. 手动测试端点：
   curl -X POST https://api.openai.com/v1/embeddings \
     -H "Authorization: Bearer YOUR_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"model":"text-embedding-3-small","input":["test"]}'

3. 如果手动测试成功，但应用中失败：
   - 直接在AI配置中使用嵌入端点
   - 不要使用聊天端点
```

### 错误：Failed to deserialize... missing field `messages`

**原因**：API 端点配置错误

**解决**：
1. 系统会自动转换端点，无需手动修改
2. 确保使用的是兼容 OpenAI API 的服务
3. 检查 API 密钥是否正确

### 错误：Network Error

**原因**：网络连接问题

**解决**：
1. 检查网络连接
2. 检查 API 端点是否可访问
3. 检查防火墙设置

## 技术细节

### 向量数据库

- **使用**：LanceDB
- **存储位置**：`{noteSavePath}/.rag/`
- **特点**：
  - 自动持久化
  - 支持增量更新
  - 高性能向量检索

### 文本分块算法

- **方法**：Markdown 智能分块
- **特点**：
  - 保留标题上下文
  - 避免在句子中间分块
  - 支持重叠以保持连贯性

### 相似度计算

- **方法**：余弦相似度
- **范围**：0-1（1 表示完全相同）
- **阈值**：可配置，默认 0.7

## 更新日志

### v2.0.0
- ✅ 初始版本发布
- ✅ 支持语义搜索
- ✅ 自动索引功能
- ✅ 索引状态监控
- ✅ 多语言支持

---

**需要帮助？** 请访问 [GitHub Issues](https://github.com/jetyu/NoteWizard/issues)
