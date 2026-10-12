# 虎尾場 2D CAD 配置系統 V6.9.1

這個資料夾就是 **GitHub Pages 上傳版**。

## 上傳到 GitHub 的檔案

請把 `github_upload` 資料夾「裡面的內容」放到 GitHub repository 根目錄：

```text
/
├─ index.html
├─ manifest.webmanifest
├─ sw.js
├─ .nojekyll
├─ VERSION.txt
├─ assets/
│  ├─ css/app.css
│  ├─ js/app-core.js
│  ├─ js/app-ui.js
│  ├─ js/pwa-register.js
│  ├─ images/cad-base.png
│  ├─ images/cad-white-reference.png
│  └─ icons/
└─ docs/
   ├─ CLOUD_SETUP.md
   └─ V6.9.1_FULL_QA.md
```

## GitHub Pages

1. 建立或開啟你的 GitHub repository。
2. 將上面檔案全部上傳到 repository 根目錄。
3. GitHub → **Settings** → **Pages**。
4. Source 選 **Deploy from a branch**。
5. Branch 選 `main`，Folder 選 `/(root)`。
6. 儲存後等待 GitHub Pages 發布。

## 重要

- `index.html` 一定要放在 repository 根目錄。
- `assets/` 的資料夾層級不可改。
- 不要只上傳 `index.html`，否則 CAD 圖、CSS、JS、PWA 圖示都會失效。
- Google Apps Script 的 `PROJECT_TOKEN` **不要寫進 GitHub**。
- Apps Script 請使用另外提供的 `apps_script` 資料夾。

## 更新版本時

如果 GitHub Pages 還顯示舊版：

1. 重新整理頁面。
2. iPhone / iPad 可關閉已加入主畫面的 PWA 後重開。
3. 必要時清除該網站資料，讓新版 Service Worker 重新快取。
