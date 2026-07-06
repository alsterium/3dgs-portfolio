# GitHub Actions ワークフロー

Claude の GitHub App には `workflows` 権限がないため、Actions 定義を一時的に
このディレクトリに置いています。有効化するにはリポジトリ直下へ移動して
コミットしてください:

```bash
mkdir -p .github/workflows
git mv docs/github-workflows/ci.yml docs/github-workflows/deploy.yml .github/workflows/
git commit -m "Enable CI/CD workflows"
git push
```

- `ci.yml` — PR / main push で lint・format・スキーマ検証・テスト・ビルドを実行
- `deploy.yml` — main push で GitHub Pages へ自動デプロイ
  (サムネイル再生成はベストエフォート。失敗時はコミット済みの `public/thumbs/` が配信されます)

デプロイ前に、リポジトリの Settings → Pages → Source を **GitHub Actions** に
設定してください。
