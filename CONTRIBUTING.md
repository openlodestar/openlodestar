# Contributing

谢谢愿意花时间。这个项目的第一条纪律是**结论必须能被重新跑出来**，所以测试、底稿和文档的变化要和代码一起提交，而不是事后补。

## 先跑起来

需要 Node.js ≥ 20 与 pnpm 10.33（版本已锁在 `package.json`）。

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm run demo
pnpm run demo:real
```

以上全部离线：不需要 API key，不发任何网络请求。不要为了跑测试去申请搜索或模型密钥。

在线实验（`live` 子命令）会真实调用模型与搜索，**不属于测试**，也不要放进 CI。

## 什么改动受欢迎

- 可复现的 bug 修复：先在 issue 里写清版本、命令、期望与实际；有底稿或最小样例最好。
- 文档修正：命令跑不通、说明与代码不一致，都算 bug。
- 新的搜索提供者或浏览器插件：按 `src/integrations/` 下的契约实现，带离线测试。
- 新的领域包：先看 `src/lodestar/packs/` 的现有包与判据，别把领域规则写进引擎。
- 大改动（改提示词、改计票规则、改底稿格式）先开 issue 对齐。这些改动会改变已发布的结论，不适合直接开 PR。

## 硬规矩

- **不提交密钥**，也不提交真实运行底稿：`.openlodestar-demo/`、`.env`、抓取到的页面正文都不要进仓库。
- **测试不得联网、不得调用模型**。外部服务用假件或冻结快照；在线行为只做人工验证。
- **新增判据要带测试**；改提示词要带离线回归，说明改了哪一层、为什么。
- **底稿只追加不改写**。不要为了"干净"去重写历史行；读时取同一主键的最后一条。
- TypeScript 保持 `strict`，不用 `any` 绕过类型。
- 一个 PR 只做一件事。commit message 写清"为什么"，不是只写"改了什么"。

## 提 PR

从 `main` 开分支，改完在本地过一遍：

```bash
pnpm typecheck
pnpm test
pnpm run demo
pnpm run demo:real
```

PR 描述里写四件事：改了什么、为什么、怎么验证、有没有联网或计费动作。涉及判据变化的，把改前改后的例子贴出来。

## 安全问题

不要开公开 issue。按 [SECURITY.md](SECURITY.md) 的私密渠道报告。

## License

提交的代码与文档按 [Apache-2.0](LICENSE) 授权。提交即表示你有权按该许可贡献这些内容。
