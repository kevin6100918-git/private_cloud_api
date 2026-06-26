# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 專案目標

打造一個私有雲端 API，讓使用者透過 HTTP 請求瀏覽和編輯本機檔案系統，並附帶以 HTML + JS 實作、由同一個伺服器提供的瀏覽器操作介面。

核心功能：
- 檔案與目錄的列舉和瀏覽（預設過濾系統隱藏檔，可透過 `?show_hidden=true` 或 UI toggle 切換）
- 檔案讀寫（新增、修改、刪除）、multipart 上傳
- 以 HTTP API 暴露上述操作
- 內嵌 HTML + JS 前端，由同一個伺服器一併提供

## 技術選型

`.gitignore` 以 **Python** 專案範本生成，因此後端使用 Python FastAPI。前端為純 HTML + JS，不需要獨立的打包流程。

## 架構設計

```
[瀏覽器 UI（HTML + JS）]
         |
    HTTP 請求
         |
[Python FastAPI]   ← 同時提供 API 與前端靜態檔案，前後端使用不同 router prefix 區分前後端點
         |
    本機檔案系統
```

伺服器在使用者本機執行，直接存取本機檔案系統，不需要任何雲端儲存或外部服務。

## 開發環境

```bash
# 建立並啟動虛擬環境
python -m venv .venv
.venv\Scripts\activate      # Windows
# source .venv/bin/activate  # macOS / Linux

pip install -r requirements.txt

# 啟動開發伺服器（支援熱重載）
uvicorn main:app --reload
```

伺服器啟動後：
- 瀏覽器 UI：`http://localhost:8000/`
- API 文件（Swagger）：`http://localhost:8000/docs`

## 目錄結構

```
main.py                  # FastAPI app 進入點
requirements.txt
.env                     # BASE_DIR 設定（不進版控）
.env.example             # .env 範本
app/
  config.py              # 載入 .env，匯出 BASE_DIR
  routers/
    files.py             # /api/files 路由（CRUD）
  services/
    filesystem.py        # 檔案系統操作邏輯與隱藏檔過濾
frontend/
  index.html
  app.js
  style.css
```

## 設定

`BASE_DIR` 在 `.env` 中設定，由 `app/config.py` 載入（使用 `python-dotenv`）。留空則 fallback 為 `Path.home()`。

## 安全限制

`app/services/filesystem.py` 中的 `_resolve()` 會驗證每個請求路徑不超出 `BASE_DIR` 邊界，防止路徑穿越攻擊。

隱藏檔過濾由 `_is_hidden()` 實作：Windows 讀取 `FILE_ATTRIBUTE_HIDDEN | FILE_ATTRIBUTE_SYSTEM` 屬性，其他平台以 `.` 開頭判斷。所有列目錄的 API 端點都接受 `?show_hidden=true/false` query 參數（預設 `false`）。前端將此偏好存入 `localStorage`（key: `showHidden`）。

## 前端路由與視窗標題

目錄瀏覽使用 `history.pushState` 將路徑寫入 URL hash（例如 `#Documents/Photos`），根目錄則還原為無 hash 的乾淨 URL。瀏覽器的回上一頁／前進透過 `popstate` 事件處理，重新整理頁面時也會從 hash 還原瀏覽位置。

視窗標題規則：
- 根目錄 → `我的硬碟`
- 子目錄 → 當前資料夾名稱
- 開啟檔案編輯器 → 檔案名稱；關閉編輯器後還原為所在目錄名稱

## 前端排序

排序在前端完成（不需重新 fetch），`sortEntries()` 負責實作，`lastEntries` 保存最後一次 fetch 的原始資料。

- 可排序欄位：`name`（名稱）、`ctime`（建立時間，後端以 `entry.stat().st_ctime` 回傳）
- 排序方向：`asc`（升冪）/ `desc`（降冪）
- 目錄永遠排在檔案前面，兩組分別套用同一排序規則
- 偏好存入 `localStorage`（key：`sortBy`、`sortOrder`），切換後立即重新渲染不重新請求
