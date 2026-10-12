# Google Sheet / Apps Script 設定

1. 建立 Google Sheet，例如 `虎尾場_CAD_雲端資料庫`。
2. Google Sheet → 擴充功能 → Apps Script。
3. 將 `google_apps_script/Code.gs` 貼到 Code.gs。
4. 執行 `setupCloud()` 並完成 Google 授權。
5. 回到 Sheet 的 `Settings` 工作表複製 `PROJECT_TOKEN`。
6. Apps Script → 部署 → 新部署 → 網頁應用程式。
7. 複製 `/exec` 結尾的 Web App URL。
8. GitHub Pages 打開 CAD → 右上角雲端 → 填 URL / Token / Project ID。
9. 先「測試連線」，再「上傳目前專案」。

不要把 PROJECT_TOKEN 放進 GitHub。
