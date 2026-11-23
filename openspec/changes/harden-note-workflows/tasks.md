## 1. 实现

- [x] 1.1 修复保存竞态、dirty 重试和 flush 结果传播，增加回归测试
- [x] 1.2 同步覆盖前保存冲突双方，验证历史快照不覆盖
- [x] 1.3 备份错误展示及重试、图片部分成功与错误提示
- [x] 1.4 全文搜索有界并发及部分失败反馈，增加回归测试

## 2. 验证

- [x] 2.1 运行 Main 构建、类型检查、lint 和单元测试，验证 OpenSpec

验证：Main 构建、typecheck、72 个单元测试、OpenSpec strict validate 和修改文件 lint 均通过。全仓库 npm run lint 被 .tmp-tools 内第三方 eslint.config.js 缺少 neostandard 阻断；未修改临时依赖目录。图片粘贴及界面提示仍需桌面端交互验收。本次没有引入索引；搜索仍为线性扫描，读取并发上限为 4，未宣称真实大库性能提升倍数。
