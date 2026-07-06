# 3DGS Portfolio

自作の 3D Gaussian Splatting (3DGS) シーンを展示するポートフォリオサイト。
グランツーリスモの車両選択画面のような UX で、画面下部のカルーセルからシーンを選ぶと
メインビューでリアルタイムレンダリング(自動オービット付き)されます。

- レンダリング: [Spark](https://sparkjs.dev/)(three.js ベースの 3DGS レンダラ)
- UI: React + Tailwind CSS / TanStack Router (hash) / TanStack Query / react-i18next (日英)
- 配信フォーマット: `.spz`(1 ファイル上限 50MB)
- ホスティング: GitHub Pages(将来 Cloudflare Pages + R2 へ移行可能な構成)

## 開発

```bash
npm ci
npm run dev        # 開発サーバー
npm test           # Vitest
npm run lint       # OXLint
npm run fmt        # OXfmt
npm run validate   # scenes.json スキーマ検証(zod)
npm run build      # 型チェック + 本番ビルド
npm run thumbs     # サムネイル生成(要: build 済み dist/)
```

## シーンの追加(PRD §6.6)

1. `.ply → .spz` 変換(SH 次数はシーンごとに指定可、デフォルト SH3):

   ```bash
   uv run tools/convert_to_spz.py scene.ply -o public/assets/my-scene.spz \
     --sh-degree 3 --update-manifest my-scene
   ```

2. `public/scenes.json` にエントリを追加(日英メタデータ・カメラ/オービットパラメータ。
   スキーマは `src/lib/sceneSchema.ts`)
3. `npm run validate && npm run build && npm run thumbs` でサムネイルを生成しコミット
4. PR → CI(lint / test / スキーマ検証 / ビルド)→ main マージで Pages へ自動デプロイ

同梱の `demo-*` シーンは `node scripts/generate-demo-scenes.mjs` で生成した合成データの
プレースホルダーです。実シーンが揃ったら置き換えてください。

## アセット配信の切り替え

アセット(.spz)の配信元は環境変数 `VITE_ASSET_BASE_URL` で切り替えられます(未設定時は
同一サイトから相対配信)。Cloudflare R2 へ移行する場合はアセットをアップロードし、
デプロイ時にこの変数を R2 の公開 URL に設定するだけです。

## ディレクトリ構成

```
public/
  scenes.json        # シーンマニフェスト(zod でスキーマ検証)
  assets/*.spz       # 3DGS アセット
  thumbs/            # ビルド時自動生成のサムネイル(コミットする)
src/
  viewer/            # Spark 統合(engine / SplatViewer / orbit / loader)
  components/        # カルーセル・メタデータパネル等
  pages/ router.tsx  # TanStack Router(hash ルーティング、/#/scene/{slug})
  lib/               # スキーマ・i18n・URL 解決・フォーマッタ
scripts/             # 検証・サムネイル生成・デモアセット生成(Node)
tools/               # .ply → .spz 変換(Python + uv)
```
