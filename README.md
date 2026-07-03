# Misc-tools

個人小工具的 webapp 實驗場與收集場。全部都是**純前端、無建置步驟**的靜態頁面，直接在瀏覽器裡跑，資料不會離開你的裝置。

## 首頁

`index.html` 是一個 Hub 集合頁，會自動列出所有工具卡片。

## 工具

| 工具 | 說明 |
| --- | --- |
| [🧩 截圖貼合](tools/screenshot-stitch/) | 把連續的長截圖（例如 FB 太長的貼文）自動偵測重疊區、無縫拼成一張長圖，也支援單純垂直堆疊。 |

## 本機預覽

直接用瀏覽器開 `index.html` 即可；或起一個簡單的靜態伺服器：

```bash
python3 -m http.server 8000
# 然後開 http://localhost:8000
```

## 部署

因為是純靜態站，把 repo 的根目錄丟給 GitHub Pages（或任何靜態主機）就能上線，路徑都用相對路徑。

## 新增工具

1. 在 `tools/<slug>/` 底下放該工具的 `index.html`（可共用 `assets/style.css`）。
2. 到 `assets/tools.js` 的 `TOOLS` 陣列加一筆，Hub 首頁就會自動出現卡片。
