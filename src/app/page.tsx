"use client";

import { useState, useEffect } from "react";
import JSZip from "jszip";

// ---------- 型別定義 ----------
type BatchItem = {
  id: string;
  url: string;
  selected: boolean;
  prompt?: string;
};
type HistoryItem = {
  id: string;
  time: number;
  prompt: string;
  width: number;
  height: number;
  count: number;
  seed: number;
  styleWeight: number;
  items: string[];
};
type EditMode = "outpaint" | "inpaint" | "variation" | null;

// ---------- 工具函數 ----------
const uid = () => Math.random().toString(36).substring(2);

const callImagesAPI = async ({
  apiKey,
  prompt,
  w,
  h,
  n,
  styleWeight,
  seed,
  refs,
}: {
  apiKey: string;
  prompt: string;
  w: number;
  h: number;
  n: number;
  styleWeight: number;
  seed: number;
  refs: string[];
}) => {
  const payload = {
    model: "dall-e-3",
    prompt,
    width: w,
    height: h,
    n,
    style_weight: styleWeight,
    seed,
    references: refs,
    apiKey,
  };

  const res = await fetch("/api/gemini-images", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.images || [];
};

export default function App() {
  // ---------- 狀態 ----------
  const [apiKey, setApiKey] = useState<string>("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [prompts, setPrompts] = useState<string[]>([
    "A beautiful landscape with mountains and lake",
  ]);
  const [width, setWidth] = useState(1024);
  const [height, setHeight] = useState(1024);
  const [count, setCount] = useState(4);
  const [seed, setSeed] = useState(7);
  const [styleWeight, setStyleWeight] = useState(0.6);

  // 新增狀態
  const [promptTemplates, setPromptTemplates] = useState([
    {
      id: 1,
      name: "風景攝影",
      prompt:
        "A breathtaking landscape photograph, golden hour lighting, cinematic composition, high resolution, professional photography",
    },
    {
      id: 2,
      name: "人物肖像",
      prompt:
        "Portrait photography, natural lighting, detailed facial features, professional studio quality, high resolution",
    },
    {
      id: 3,
      name: "科幻場景",
      prompt:
        "Futuristic sci-fi scene, neon lights, cyberpunk atmosphere, high tech environment, detailed rendering",
    },
    {
      id: 4,
      name: "動物寫真",
      prompt:
        "Wildlife photography, natural habitat, detailed fur texture, professional nature photography, high quality",
    },
    {
      id: 5,
      name: "建築設計",
      prompt:
        "Modern architecture, clean lines, minimalist design, professional architectural photography, high resolution",
    },
  ]);
  const [promptHistory, setPromptHistory] = useState<string[]>([]);
  const [queue, setQueue] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentProgress, setCurrentProgress] = useState({
    current: 0,
    total: 0,
    currentPrompt: "",
  });
  const [refs, setRefs] = useState<File[]>([]);
  const [batch, setBatch] = useState<BatchItem[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [cancelFlag, setCancelFlag] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // 圖像編輯相關狀態
  const [editingImage, setEditingImage] = useState<string | null>(null);
  const [editMode, setEditMode] = useState<EditMode>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    imageId: string;
  } | null>(null);
  const [editPrompt, setEditPrompt] = useState<string>("");
  const [showEditDialog, setShowEditDialog] = useState<boolean>(false);
  const [selectedImageForEdit, setSelectedImageForEdit] = useState<{
    url: string;
    id: string;
    originalPrompt?: string;
  } | null>(null);

  // ---------- 效果 ----------
  useEffect(() => {
    if (typeof window !== "undefined") {
      // 初始載入API Key
      const savedApiKey = localStorage.getItem("ecf_api_key") || "";
      if (savedApiKey && !apiKey) {
        setApiKey(savedApiKey);
      }

      // 載入提示詞歷史
      const savedHistory = localStorage.getItem("prompt_history");
      if (savedHistory) {
        setPromptHistory(JSON.parse(savedHistory));
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && apiKey) {
      localStorage.setItem("ecf_api_key", apiKey);
    }
  }, [apiKey]);

  // ---------- 新增功能函數 ----------

  // 中英文翻譯
  const translatePrompt = async (text: string, toEnglish: boolean = true) => {
    if (!apiKey) return text;

    try {
      const response = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          target: toEnglish ? "en" : "zh",
          apiKey,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return data.translatedText || text;
      }
    } catch (error) {
      console.error("Translation error:", error);
    }

    return text;
  };

  // 提示詞優化
  const optimizePrompt = async (prompt: string) => {
    if (!apiKey) return prompt;

    try {
      const response = await fetch("/api/optimize-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          apiKey,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        // 移除各種可能的前綴
        const optimized = data.optimizedPrompt || prompt;
        return optimized
          .replace(/^Optimized\s*(image\s*generation\s*)?prompt:\s*/i, "")
          .replace(/^優化後的提示詞:\s*/i, "")
          .replace(
            /^Here's\s*(an?\s*)?optimized\s*(version\s*(of\s*)?)?.*?:\s*/i,
            ""
          )
          .trim();
      }
    } catch (error) {
      console.error("Optimization error:", error);
    }

    return prompt;
  };

  // 添加到歷史
  const addToHistory = (prompt: string) => {
    if (prompt.trim() && !promptHistory.includes(prompt)) {
      const newHistory = [prompt, ...promptHistory.slice(0, 19)]; // 保留最近20個
      setPromptHistory(newHistory);
      localStorage.setItem("prompt_history", JSON.stringify(newHistory));
    }
  };

  // 並行處理隊列
  const processQueue = async () => {
    if (isProcessing || queue.length === 0) return;

    setIsProcessing(true);
    setCurrentProgress({ current: 0, total: queue.length, currentPrompt: "" });

    const results: string[] = [];
    const batchSize = 3; // 同時處理3個請求

    for (let i = 0; i < queue.length; i += batchSize) {
      const batch = queue.slice(i, i + batchSize);

      const promises = batch.map(async (item, index) => {
        setCurrentProgress((prev) => ({
          ...prev,
          current: i + index + 1,
          currentPrompt: item.prompt.substring(0, 50) + "...",
        }));

        try {
          const urls = await callImagesAPI({
            apiKey,
            prompt: item.prompt,
            w: item.width,
            h: item.height,
            n: 1,
            styleWeight: item.styleWeight,
            seed: item.seed + i + index,
            refs: item.refs,
          });

          return urls;
        } catch (error) {
          console.error(`Error processing item ${i + index}:`, error);
          return [];
        }
      });

      const batchResults = await Promise.all(promises);
      results.push(...batchResults.flat());

      // 立即顯示結果
      batchResults.flat().forEach((url) => {
        setBatch((prev) => [...prev, { id: uid(), url, selected: true }]);
      });

      // 添加延遲避免 API 限制
      if (i + batchSize < queue.length) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    setQueue([]);
    setIsProcessing(false);
    setCurrentProgress({ current: 0, total: 0, currentPrompt: "" });

    // 保存到歷史
    if (results.length > 0) {
      setHistory((prev) => [
        {
          id: uid(),
          time: Date.now(),
          prompt: queue.map((q) => q.prompt).join(" | "),
          width,
          height,
          count: results.length,
          seed,
          styleWeight,
          items: results.slice(0, 4),
        },
        ...prev,
      ]);
    }
  };

  // ---------- 函數 ----------
  const addLog = (msg: string) => {
    setLogs((arr) => [...arr, `${new Date().toLocaleTimeString()}: ${msg}`]);
  };

  const generateImages = async () => {
    if (running || isProcessing) return;
    setRunning(true);
    setCancelFlag(false);
    setBatch([]);
    setLogs([]);
    addLog("開始生成圖像...");

    const refsBase64 = await Promise.all(
      refs.map(
        (f) =>
          new Promise<string>((resolve) => {
            const r = new FileReader();
            r.onload = () => resolve((r.result as string).split(",")[1]);
            r.readAsDataURL(f);
          })
      )
    );

    try {
      // 處理批量模式：如果只有一個提示詞但包含換行，則按行分割
      const allPrompts: string[] = [];
      prompts.forEach((p) => {
        if (p.includes("\n")) {
          // 批量模式：按行分割
          const lines = p.split("\n").filter((line) => line.trim());
          allPrompts.push(...lines);
        } else {
          // 單個提示詞
          allPrompts.push(p);
        }
      });

      const validPrompts = allPrompts.filter((p) => p.trim());

      if (validPrompts.length === 0) {
        addLog("錯誤：請至少輸入一個提示詞");
        return;
      }

      addLog(`準備生成 ${validPrompts.length} 個提示詞的圖像...`);

      // 將所有任務加入隊列
      const queueItems = validPrompts.map((prompt, index) => ({
        id: uid(),
        prompt: prompt.trim(),
        width,
        height,
        styleWeight,
        seed: seed + index,
        refs: refsBase64,
      }));

      setQueue(queueItems);
      addLog(`已加入 ${queueItems.length} 個任務到隊列`);

      // 開始處理隊列
      await processQueue();
    } catch (err) {
      console.error(err);
      addLog(`錯誤：${err instanceof Error ? err.message : "未知錯誤"}`);
    } finally {
      setRunning(false);
    }
  };

  const downloadImage = async (url: string, filename?: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = filename || `image-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error("Download failed:", error);
    }
  };

  const batchDownload = async () => {
    const selected = batch.filter((b) => b.selected);
    if (selected.length === 0) return;

    if (selected.length === 1) {
      await downloadImage(selected[0].url, `ecf-image-${Date.now()}.png`);
    } else {
      const zip = new JSZip();
      await Promise.all(
        selected.map(async (item, i) => {
          const res = await fetch(item.url);
          const blob = await res.blob();
          zip.file(`ecf-image-${i + 1}.png`, blob);
        })
      );
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ecf-batch-${Date.now()}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const clearHistory = () => {
    setHistory([]);
    addLog("歷史記錄已清空");
  };

  // 圖像編輯函數
  const handleImageEdit = async (
    imageUrl: string,
    imageId: string,
    editInstructions: string
  ) => {
    if (!apiKey || !editInstructions.trim()) return;

    setRunning(true);
    addLog(`開始編輯圖像: ${editInstructions.substring(0, 50)}...`);

    try {
      // 獲取原始圖像的提示詞作為上下文
      const originalItem = batch.find((item) => item.url === imageUrl);
      const originalPrompt = originalItem?.prompt || "an image";

      // 更智能的提示詞構建 - 根據編輯指示的類型來決定如何保持上下文
      let enhancedPrompt: string;

      // 檢查是否只是風格修改（如卡通風格、水彩風格等）
      const isStyleModification =
        /風格|style|cartoon|anime|watercolor|oil painting|sketch|realistic|abstract|vintage|modern/i.test(
          editInstructions
        );

      if (isStyleModification) {
        // 對於風格修改，強調保持原始內容和構圖
        enhancedPrompt = `The exact same subject, composition, and scene as described in: "${originalPrompt}". Apply this style modification: ${editInstructions}. Keep all the original elements, characters, objects, and layout exactly the same, only change the artistic style and rendering technique. High quality, detailed result.`;
      } else {
        // 對於內容修改，更加謹慎地保持核心元素
        enhancedPrompt = `Based on "${originalPrompt}", make this specific modification: ${editInstructions}. Keep the main subject and overall composition similar to the original, but apply the requested changes. High quality, detailed, professional result.`;
      }

      const editedImages = await callImagesAPI({
        apiKey,
        prompt: enhancedPrompt,
        w: width,
        h: height,
        n: 1,
        styleWeight,
        seed: seed + Math.floor(Math.random() * 1000),
        refs: [], // 暫時不使用參考圖像避免 CORS 問題
      });

      if (editedImages.length > 0) {
        // 將編輯後的圖像添加到批次中
        editedImages.forEach((url: string) => {
          setBatch((prev) => [
            ...prev,
            {
              id: uid(),
              url,
              selected: true,
              prompt: `${
                isStyleModification ? "Style Edit" : "Content Edit"
              }: ${editInstructions} (based on: ${originalPrompt})`,
            },
          ]);
        });
        addLog(`成功生成 ${editedImages.length} 張編輯圖像`);
      }
    } catch (error) {
      console.error("Image edit error:", error);
      addLog(
        `編輯失敗: ${error instanceof Error ? error.message : "未知錯誤"}`
      );
    } finally {
      setRunning(false);
    }
  };

  const openEditDialog = (
    imageUrl: string,
    imageId: string,
    originalPrompt?: string
  ) => {
    setSelectedImageForEdit({ url: imageUrl, id: imageId, originalPrompt });
    setEditPrompt("");
    setShowEditDialog(true);
  };

  const closeEditDialog = () => {
    setShowEditDialog(false);
    setSelectedImageForEdit(null);
    setEditPrompt("");
  };

  const handleEditSubmit = async () => {
    if (!selectedImageForEdit || !editPrompt.trim()) return;

    await handleImageEdit(
      selectedImageForEdit.url,
      selectedImageForEdit.id,
      editPrompt
    );
    closeEditDialog();
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      {/* 頂部標題 */}
      <header className="bg-gray-900/80 backdrop-blur shadow-lg border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent mb-3">
            🎨 BatchDALL - 批次圖像生成器
          </h1>
          <p className="text-gray-300 text-lg">
            AI 驅動的批次圖像生成與智能編輯工具
          </p>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-10">
        {/* 主要編輯區域 */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 mb-10">
          {/* 提示詞管理 - 主體區域 */}
          <div className="lg:col-span-3 bg-gray-800/50 backdrop-blur rounded-2xl shadow-xl border border-gray-700 p-8">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-4xl font-bold text-white tracking-tight">
                ✨ 提示詞創作室
              </h2>
              <div className="flex gap-3">
                <button
                  onClick={() => setPrompts([...prompts, ""])}
                  className="px-5 py-2.5 rounded-xl bg-green-600 text-white font-medium hover:bg-green-500 transition-colors"
                >
                  + 新增提示詞
                </button>
                <button
                  onClick={() => setPrompts([""])}
                  className="px-5 py-2.5 rounded-xl bg-red-600 text-white font-medium hover:bg-red-500 transition-colors"
                >
                  清空全部
                </button>
              </div>
            </div>

            {/* 批量提示詞編輯區 */}
            <div className="space-y-6 mb-8">
              {/* 批量輸入模式切換 */}
              <div className="flex items-center gap-4 mb-4">
                <span className="text-gray-300">輸入模式：</span>
                <button
                  onClick={() => {
                    const batchText = prompts.join("\n");
                    setPrompts([batchText]);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-500 transition-colors"
                >
                  切換到批量模式
                </button>
                <button
                  onClick={() => {
                    const lines = prompts[0]
                      ?.split("\n")
                      .filter((line) => line.trim()) || [""];
                    setPrompts(lines.length > 0 ? lines : [""]);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-sm hover:bg-green-500 transition-colors"
                >
                  切換到單獨模式
                </button>
              </div>

              {/* 如果只有一個提示詞且包含換行，顯示批量模式 */}
              {prompts.length === 1 && prompts[0].includes("\n") ? (
                <div className="border border-gray-600 rounded-xl p-6 bg-gray-700/30 backdrop-blur">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-lg text-gray-300 font-medium">
                      📝 批量提示詞（每行一個）
                    </span>
                    <span className="text-sm text-gray-400">
                      {
                        prompts[0].split("\n").filter((line) => line.trim())
                          .length
                      }{" "}
                      個提示詞
                    </span>
                  </div>
                  <textarea
                    value={prompts[0]}
                    onChange={(e) => {
                      setPrompts([e.target.value]);
                    }}
                    rows={12}
                    className="w-full px-4 py-4 rounded-xl border border-gray-600 bg-gray-800/50 text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-base leading-relaxed"
                    placeholder="輸入多個提示詞，每行一個：&#10;美麗的風景照片&#10;可愛的小貓&#10;未來科技城市&#10;..."
                  />
                  <div className="flex gap-3 mt-4">
                    <button
                      onClick={async () => {
                        const lines = prompts[0]
                          .split("\n")
                          .filter((line) => line.trim());
                        const translated = await Promise.all(
                          lines.map((line) => translatePrompt(line, true))
                        );
                        setPrompts([translated.join("\n")]);
                        translated.forEach((t) => addToHistory(t));
                      }}
                      className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-500 transition-colors"
                    >
                      全部中→英
                    </button>
                    <button
                      onClick={async () => {
                        const lines = prompts[0]
                          .split("\n")
                          .filter((line) => line.trim());
                        const optimized = await Promise.all(
                          lines.map((line) => optimizePrompt(line))
                        );
                        setPrompts([optimized.join("\n")]);
                        optimized.forEach((o) => addToHistory(o));
                      }}
                      className="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm hover:bg-purple-500 transition-colors"
                    >
                      全部智能優化
                    </button>
                    <button
                      onClick={() => {
                        const lines = prompts[0]
                          .split("\n")
                          .filter((line) => line.trim());
                        lines.forEach((line) => addToHistory(line));
                      }}
                      className="px-4 py-2 rounded-lg bg-gray-600 text-white text-sm hover:bg-gray-500 transition-colors"
                    >
                      保存全部到歷史
                    </button>
                  </div>
                </div>
              ) : (
                /* 單獨提示詞模式 - 緊湊版 */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {prompts.map((p, index) => (
                    <div
                      key={index}
                      className="border border-gray-600 rounded-lg p-4 bg-gray-700/30 backdrop-blur"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-300 font-medium">
                          提示詞 {index + 1}
                        </span>
                        {prompts.length > 1 && (
                          <button
                            onClick={() =>
                              setPrompts(prompts.filter((_, i) => i !== index))
                            }
                            className="px-2 py-1 rounded bg-red-600 text-white text-xs hover:bg-red-500 transition-colors"
                          >
                            刪除
                          </button>
                        )}
                      </div>
                      <textarea
                        value={p}
                        onChange={(e) => {
                          const newPrompts = [...prompts];
                          newPrompts[index] = e.target.value;
                          setPrompts(newPrompts);
                        }}
                        rows={3}
                        className="w-full px-3 py-2 rounded-lg border border-gray-600 bg-gray-800/50 text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm"
                        placeholder={`提示詞 ${index + 1}...`}
                      />
                      <div className="flex gap-1 mt-2">
                        <button
                          onClick={async () => {
                            const translated = await translatePrompt(p, true);
                            const newPrompts = [...prompts];
                            newPrompts[index] = translated;
                            setPrompts(newPrompts);
                            addToHistory(translated);
                          }}
                          className="px-2 py-1 rounded bg-blue-600 text-white text-xs hover:bg-blue-500 transition-colors"
                        >
                          中→英
                        </button>
                        <button
                          onClick={async () => {
                            const optimized = await optimizePrompt(p);
                            const newPrompts = [...prompts];
                            newPrompts[index] = optimized;
                            setPrompts(newPrompts);
                            addToHistory(optimized);
                          }}
                          className="px-2 py-1 rounded bg-purple-600 text-white text-xs hover:bg-purple-500 transition-colors"
                        >
                          優化
                        </button>
                        <button
                          onClick={() => {
                            addToHistory(p);
                          }}
                          className="px-2 py-1 rounded bg-gray-600 text-white text-xs hover:bg-gray-500 transition-colors"
                        >
                          保存
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 提示詞模板和歷史 - 移到下面 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-lg font-medium text-gray-200 mb-3">
                  🎨 快速模板
                </label>
                <select
                  onChange={(e) => {
                    const template = promptTemplates.find(
                      (t) => t.id === parseInt(e.target.value)
                    );
                    if (template) {
                      setPrompts([template.prompt]);
                      addToHistory(template.prompt);
                    }
                  }}
                  className="w-full px-4 py-3 rounded-xl border border-gray-600 bg-gray-800/50 text-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">選擇模板...</option>
                  {promptTemplates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-lg font-medium text-gray-200 mb-3">
                  📚 提示詞歷史
                </label>
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      setPrompts([e.target.value]);
                    }
                  }}
                  className="w-full px-4 py-3 rounded-xl border border-gray-600 bg-gray-800/50 text-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">選擇歷史提示詞...</option>
                  {promptHistory.map((prompt, index) => (
                    <option key={index} value={prompt}>
                      {prompt.substring(0, 50)}...
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 右側控制面板 */}
          <div className="space-y-6">
            {/* API Key 設定 - 縮小版 */}
            <div className="bg-gray-800/50 backdrop-blur rounded-xl shadow-lg border border-gray-700 p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-200">🔑 API</h3>
                <div className="flex gap-1">
                  <button
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="px-2 py-1 rounded-lg bg-gray-600 text-white text-xs hover:bg-gray-500"
                  >
                    {showApiKey ? "隱藏" : "顯示"}
                  </button>
                  <button
                    onClick={() => {
                      localStorage.setItem("ecf_api_key", apiKey);
                      addLog("API Key 已儲存到本地");
                    }}
                    className="px-2 py-1 rounded-lg bg-green-600 text-white text-xs hover:bg-green-500"
                  >
                    儲存
                  </button>
                </div>
              </div>
              <input
                type={showApiKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="OpenAI API Key"
                className="w-full px-3 py-2 rounded-lg border border-gray-600 bg-gray-800/50 text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-400 mt-2">
                {apiKey ? "✅ 已設定" : "⚠️ 請輸入"}
              </p>
            </div>

            {/* 生成設定 */}
            <div className="bg-gray-800/50 backdrop-blur rounded-xl shadow-lg border border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-200 mb-4">
                ⚙️ 生成設定
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    圖片尺寸
                  </label>
                  <select
                    value={`${width}x${height}`}
                    onChange={(e) => {
                      const [w, h] = e.target.value.split("x").map(Number);
                      setWidth(w);
                      setHeight(h);
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-gray-600 bg-gray-800/50 text-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="1024x1024">1024x1024 (正方形)</option>
                    <option value="1792x1024">1792x1024 (橫向)</option>
                    <option value="1024x1792">1024x1792 (直向)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    種子值
                  </label>
                  <input
                    type="number"
                    value={seed}
                    onChange={(e) => setSeed(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-600 bg-gray-800/50 text-white focus:ring-2 focus:ring-blue-500"
                    placeholder="隨機數種子"
                  />
                </div>
              </div>
            </div>

            {/* 操作按鈕 */}
            <div className="bg-gray-800/50 backdrop-blur rounded-xl shadow-lg border border-gray-700 p-6">
              <div className="space-y-4">
                <button
                  onClick={generateImages}
                  disabled={running || isProcessing || !apiKey}
                  className="w-full py-4 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold text-lg hover:from-blue-500 hover:to-purple-500 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed transition-all"
                >
                  {running || isProcessing ? "🔄 生成中..." : "🚀 開始生成圖像"}
                </button>

                {/* 進度條 */}
                {(running || isProcessing) && currentProgress.total > 0 && (
                  <div className="mt-4">
                    <div className="flex justify-between text-sm text-gray-300 mb-2">
                      <span>
                        進度: {currentProgress.current}/{currentProgress.total}
                      </span>
                      <span>
                        {Math.round(
                          (currentProgress.current / currentProgress.total) *
                            100
                        )}
                        %
                      </span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-300"
                        style={{
                          width: `${
                            (currentProgress.current / currentProgress.total) *
                            100
                          }%`,
                        }}
                      ></div>
                    </div>
                    {currentProgress.currentPrompt && (
                      <p className="text-xs text-gray-400 mt-2 truncate">
                        正在處理: {currentProgress.currentPrompt}
                      </p>
                    )}
                  </div>
                )}

                <button
                  onClick={batchDownload}
                  disabled={batch.filter((b) => b.selected).length === 0}
                  className="w-full py-3 px-4 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
                >
                  📦 批量下載 ({batch.filter((b) => b.selected).length})
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 生成結果 - 移到下方 */}
        <div className="bg-gray-800/50 backdrop-blur rounded-2xl shadow-xl border border-gray-700 p-8 mb-10">
          <h3 className="text-3xl font-bold text-white mb-8">
            🖼️ 生成結果 ({batch.length} 張)
          </h3>

          {batch.length === 0 ? (
            <div className="text-center py-24 text-gray-400">
              <div className="text-8xl mb-6">🎨</div>
              <p className="text-xl mb-2">還沒有生成任何圖像</p>
              <p className="text-lg opacity-80">
                請輸入提示詞並點擊「開始生成圖像」
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {batch.map((item) => (
                <div
                  key={item.id}
                  className="relative group bg-gray-700/30 rounded-xl overflow-hidden border border-gray-600 hover:border-gray-500 transition-all"
                >
                  <img
                    src={item.url}
                    alt="Generated"
                    className="w-full h-56 object-cover cursor-pointer hover:scale-105 transition-transform duration-300"
                    onClick={() => setLightboxImage(item.url)}
                  />
                  <div className="absolute top-3 right-3">
                    <button
                      onClick={() => {
                        setBatch(
                          batch.map((b) =>
                            b.id === item.id
                              ? { ...b, selected: !b.selected }
                              : b
                          )
                        );
                      }}
                      className={`w-7 h-7 rounded-full border-2 font-bold ${
                        item.selected
                          ? "bg-blue-500 border-blue-500 text-white"
                          : "bg-gray-800/80 border-gray-400 text-gray-300"
                      }`}
                    >
                      {item.selected && "✓"}
                    </button>
                  </div>
                  <div className="absolute bottom-3 left-3 flex gap-2">
                    <button
                      onClick={() =>
                        downloadImage(item.url, `image-${Date.now()}.png`)
                      }
                      className="bg-gray-900/80 text-white p-2.5 rounded-full hover:bg-gray-800/90 transition-colors"
                    >
                      📥
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditDialog(item.url, item.id, item.prompt);
                      }}
                      className="bg-purple-600/80 text-white p-2.5 rounded-full hover:bg-purple-700/90 transition-colors"
                      title="編輯圖像"
                    >
                      ✏️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 生成日誌 */}
        {logs.length > 0 && (
          <div className="bg-gray-800/50 backdrop-blur rounded-xl shadow-lg border border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-200 mb-4">
              📋 生成日誌
            </h3>
            <div className="bg-gray-900/50 rounded-lg p-4 max-h-40 overflow-y-auto">
              {logs.map((log, i) => (
                <div key={i} className="text-sm text-gray-300 mb-1">
                  {log}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 燈箱 */}
      {lightboxImage && (
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
          onClick={() => setLightboxImage(null)}
        >
          <div className="relative max-w-5xl max-h-full">
            <img
              src={lightboxImage}
              alt="Lightbox"
              className="max-w-full max-h-full object-contain rounded-lg"
            />
            <button
              onClick={() => setLightboxImage(null)}
              className="absolute top-4 right-4 bg-black/70 text-white p-3 rounded-full hover:bg-black/90 text-xl"
            >
              ✕
            </button>
            <button
              onClick={() =>
                downloadImage(lightboxImage, `image-${Date.now()}.png`)
              }
              className="absolute bottom-4 right-4 bg-black/70 text-white p-3 rounded-full hover:bg-black/90"
            >
              📥
            </button>
          </div>
        </div>
      )}

      {/* 圖像編輯對話框 */}
      {showEditDialog && selectedImageForEdit && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
          <div
            className="bg-gray-800 rounded-2xl shadow-2xl border border-gray-600 max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-white flex items-center gap-3">
                  <span className="text-3xl">✏️</span>
                  圖像編輯
                </h3>
                <button
                  onClick={closeEditDialog}
                  className="text-gray-400 hover:text-white p-2 rounded-full hover:bg-gray-700 transition-colors"
                >
                  <span className="text-xl">✕</span>
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* 原圖像預覽 */}
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold text-gray-200">
                    原始圖像
                  </h4>
                  <div className="relative bg-gray-700 rounded-xl overflow-hidden">
                    <img
                      src={selectedImageForEdit.url}
                      alt="Original"
                      className="w-full h-64 object-cover"
                    />
                  </div>
                  {selectedImageForEdit.originalPrompt && (
                    <div className="bg-gray-700/50 rounded-lg p-4">
                      <p className="text-sm text-gray-300 mb-1">原始提示詞：</p>
                      <p className="text-sm text-white break-words">
                        {selectedImageForEdit.originalPrompt}
                      </p>
                    </div>
                  )}
                </div>

                {/* 編輯控制 */}
                <div className="space-y-6">
                  <div>
                    <label className="block text-lg font-semibold text-gray-200 mb-4">
                      編輯指示
                    </label>
                    <textarea
                      value={editPrompt}
                      onChange={(e) => setEditPrompt(e.target.value)}
                      rows={8}
                      className="w-full px-4 py-4 rounded-xl border border-gray-600 bg-gray-800/50 text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none text-base leading-relaxed"
                      placeholder="描述你想要如何修改這張圖像...&#10;&#10;範例：&#10;• 將背景改為日落天空&#10;• 添加一隻小鳥在樹上&#10;• 改變顏色為藍色調&#10;• 移除背景中的建築物"
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={async () => {
                        const optimized = await optimizePrompt(editPrompt);
                        setEditPrompt(optimized);
                      }}
                      disabled={!editPrompt.trim() || !apiKey}
                      className="px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-500 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors text-sm"
                    >
                      🔮 優化指示
                    </button>
                    <button
                      onClick={async () => {
                        const translated = await translatePrompt(
                          editPrompt,
                          true
                        );
                        setEditPrompt(translated);
                      }}
                      disabled={!editPrompt.trim() || !apiKey}
                      className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors text-sm"
                    >
                      🌐 中→英
                    </button>
                  </div>

                  <div className="flex gap-4 pt-4">
                    <button
                      onClick={handleEditSubmit}
                      disabled={!editPrompt.trim() || running}
                      className="flex-1 py-3 px-6 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold hover:from-purple-500 hover:to-blue-500 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed transition-all"
                    >
                      {running ? "🔄 編輯中..." : "🚀 開始編輯"}
                    </button>
                    <button
                      onClick={closeEditDialog}
                      className="px-6 py-3 rounded-xl bg-gray-600 text-white font-semibold hover:bg-gray-500 transition-colors"
                    >
                      取消
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
