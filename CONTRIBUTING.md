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
- **不直推 `main`**。规则集 `Protect main` 已强制：任何改动都要走分支 + PR，且必须过 `typecheck · test · offline demos` 这项检查才能合并。不是约定，是平台拦着。

## 提 PR

`main` 是受保护分支，直推会被拒绝。流程固定三步：

```bash
git switch -c <type>/<简短主题>        # fix/ feat/ docs/ chore/
git commit -am "..." && git push -u origin <分支名>
gh pr create --base main --fill && gh pr merge --squash --auto
```

`--auto` 表示 CI 一绿就自动 squash 合并，不需要人回来点第二次。单人仓库的 PR 不需要审批（Required approvals = 0），它的作用是**让检查先于合并发生**，而不是等人评审。

从 `main` 开分支，改完在本地过一遍：

```bash
pnpm typecheck
pnpm test
node scripts/check-site.mjs
pnpm run demo
pnpm run demo:real
```

**改了领域规则、演示候选词，或动了 `examples/` 下的底稿，记得重新生成站点数据**：依次跑 `pnpm run demo:data`、`pnpm run demo:game`、`pnpm run demo:sort`（顺序不能换，后一个读前一个的产物），把 `docs/assets/` 下的变化一起提交。这三个脚本不写墙钟时间，同一份输入重跑结果字字相同；CI 会重跑一遍并核对 `docs/assets/` 没有差异，忘了重跑会直接失败。

PR 描述里写四件事：改了什么、为什么、怎么验证、有没有联网或计费动作。涉及判据变化的，把改前改后的例子贴出来。

## 安全问题

不要开公开 issue。按 [SECURITY.md](SECURITY.md) 的私密渠道报告。

## License

提交的代码与文档按 [Apache-2.0](LICENSE) 授权。提交即表示你有权按该许可贡献这些内容。
