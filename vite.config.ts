import { defineConfig } from 'vite';

// GitHub Pages のプロジェクトページ (https://<user>.github.io/10ninmura/) 用に
// アセットのベースパスをリポジトリ名に合わせる。
export default defineConfig({
  base: '/10ninmura/',
});
