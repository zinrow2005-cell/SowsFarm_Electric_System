# GitHub Pages 部署步驟

## 最簡單做法

把 `github_upload` 裡面的所有檔案，直接放到你的 GitHub repository 根目錄。

不要再多包一層 `github_upload` 資料夾。

正確：
```text
repository/
  index.html
  manifest.webmanifest
  sw.js
  assets/
```

錯誤：
```text
repository/
  github_upload/
    index.html
```

## Pages 設定

GitHub repository → Settings → Pages：

- Source：Deploy from a branch
- Branch：main
- Folder：/(root)

## 手機 / iPad

GitHub Pages 發布完成後：

- Safari 開啟網址
- 分享
- 加入主畫面

PWA 會使用 `manifest.webmanifest`、`sw.js` 與 `assets/icons/`。
