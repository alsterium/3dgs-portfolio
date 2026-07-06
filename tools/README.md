# tools/

アセット変換用の Python ツール群。**uv** で管理しており、依存解決込みでそのまま実行できます。

## .ply → .spz 変換

```bash
uv run tools/convert_to_spz.py path/to/scene.ply \
  -o public/assets/my-scene.spz \
  --sh-degree 3 \
  --update-manifest my-scene
```

- 変換本体は [Niantic 公式 spz CLI](https://github.com/nianticlabs/spz) を呼び出します。
  `SPZ_CLI` 環境変数か `--spz-cli` でバイナリの場所を指定してください(PATH 上の `spz` も可)。
- SH 次数はシーンごとに指定できます(デフォルト SH3)。出力が 50MB 上限を超えた場合は
  エラーになるので、`--sh-degree` を下げて再実行してください(PRD §6.2)。
- `--update-manifest <slug>` を付けると `public/scenes.json` の該当エントリの
  `fileSizeBytes` / `shDegree` を自動更新します。
- ソースの `.ply` はリポジトリにコミットしません(`.gitignore` 済み)。

## シーン追加フロー(PRD §6.6)

1. ローカルで上記コマンドで `.ply → .spz` 変換
2. `public/scenes.json` にエントリ追加(日英メタデータ・カメラパラメータ)
3. `npm run validate && npm run build && npm run thumbs` でサムネイル生成
4. PR 作成 → CI(スキーマ検証・ビルド)→ main マージで自動デプロイ
