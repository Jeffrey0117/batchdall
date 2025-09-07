# BatchDALL - 批次 DALL-E 3 圖像生成器

一個現代化的 DALL-E 3 批次圖像生成工具，支持智能提示詞優化、圖像編輯、批量處理等功能。

## ✨ 主要特色

- 🎨 **批次生成**: 支持多個提示詞同時生成圖像
- 🔄 **圖像編輯**: AI 驅動的圖像修改功能，智能保持原圖上下文
- 🌐 **多語言支持**: 中英文翻譯和提示詞優化
- � **批量下載**: 支持單張下載或打包下載
- 🎯 **智能模板**: 內建多種風格模板快速開始
- � **歷史管理**: 自動保存提示詞歷史記錄
- 🔧 **靈活配置**: 支援多種圖像尺寸和生成參數

## � 技術架構

- **前端框架**: Next.js 15.5.2 + React 19
- **樣式方案**: Tailwind CSS 4
- **AI 整合**: OpenAI API (DALL-E 3 + GPT-3.5-turbo)
- **開發工具**: TypeScript + ESLint
- **打包工具**: Turbopack (高效能開發)

## 🚀 快速開始

### 環境要求

- Node.js 18+
- npm 或 yarn 套件管理器
- OpenAI API Key

### 安裝步驟

1. **克隆專案**

   ```bash
   git clone https://github.com/your-username/batchdall.git
   cd batchdall
   ```

2. **安裝依賴**

   ```bash
   npm install
   ```

3. **啟動開發伺服器**

   ```bash
   npm run dev
   ```

4. **開啟瀏覽器**

   訪問 [http://localhost:3001](http://localhost:3001)

### API Key 設定

1. 在應用界面中點擊右側的 "🔑 API" 區塊
2. 輸入你的 OpenAI API Key
3. 點擊「儲存」按鈕保存到本地存儲

> **注意**: API Key 僅保存在瀏覽器本地，不會上傳到任何伺服器

## 📖 使用指南

### 基本圖像生成

1. **單個提示詞**: 在提示詞創作室輸入描述
2. **批量模式**: 點擊「切換到批量模式」，每行輸入一個提示詞
3. **設定參數**: 調整圖像尺寸、種子值等參數
4. **開始生成**: 點擊「🚀 開始生成圖像」

### 圖像編輯功能

1. **選擇圖像**: 在生成結果中點擊圖像上的「✏️」按鈕
2. **輸入修改指令**: 描述想要的修改（如「卡通風格」、「改變背景」）
3. **智能編輯**: 系統會自動保持原圖主體，僅應用指定修改
4. **生成結果**: 編輯後的圖像會添加到結果中

### 提示詞優化

- **翻譯功能**: 支援中文轉英文翻譯
- **AI 優化**: 使用 GPT-3.5-turbo 智能優化提示詞
- **模板系統**: 提供風景、人物、科幻等預設模板
- **歷史記錄**: 自動保存常用提示詞

## 🔧 專案結構

```
batchdall/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── gemini-images/     # DALL-E 3 圖像生成 API
│   │   │   ├── translate/         # 翻譯 API
│   │   │   └── optimize-prompt/   # 提示詞優化 API
│   │   ├── globals.css           # 全域樣式
│   │   ├── layout.tsx            # 應用佈局
│   │   └── page.tsx              # 主頁面組件
│   └── ...
├── public/                       # 靜態資源
├── package.json                  # 專案配置
└── README.md                     # 說明文件
```

## 🎯 核心功能

### 批次處理能力

- 同時處理多個提示詞
- 支援最多同時 3 個併發請求
- 即時顯示生成進度
- 自動錯誤重試機制

### 智能圖像編輯

- **風格編輯**: 自動識別風格類修改（卡通、水彩等）
- **內容編輯**: 智能保持主體的內容修改
- **上下文保持**: 強化原圖描述以維持一致性
- **批量編輯**: 支援對多張圖像進行相同編輯

### 用戶體驗優化

- 響應式設計，支援各種屏幕尺寸
- 深色主題界面，護眼且專業
- 拖拽選擇、批量操作
- 燈箱預覽功能

## 🔒 安全性

- ✅ 無硬編碼 API Keys
- ✅ 客戶端 API Key 存儲
- ✅ 完善的 .gitignore 配置
- ✅ 環境變量支持
- ✅ 錯誤處理和回退機制

## 🤝 貢獻指南

歡迎提交 Issue 和 Pull Request！

1. Fork 此專案
2. 創建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交變更 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 開啟 Pull Request

## 📝 許可證

MIT License - 詳見 [LICENSE](LICENSE) 文件

## 🙏 致謝

- [OpenAI DALL-E 3](https://openai.com/dall-e-3) - 強大的圖像生成 AI
- [OpenAI GPT-3.5-turbo](https://openai.com/gpt-3-5) - 提示詞優化與翻譯服務
- [Next.js](https://nextjs.org/) - React 全端框架
- [Tailwind CSS](https://tailwindcss.com/) - 工具優先的 CSS 框架

---

**BatchDALL** - 讓 AI 圖像生成更簡單、更高效 🎨✨
