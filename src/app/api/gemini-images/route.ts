import type { NextRequest } from "next/server";
import OpenAI from "openai";

// 生成多個不同的提示詞變體
function generatePromptVariations(basePrompt: string, count: number): string[] {
  const variations: string[] = [];
  const styles = [
    "cinematic lighting, dramatic shadows",
    "soft natural lighting, warm tones",
    "harsh dramatic lighting, high contrast",
    "golden hour lighting, warm atmosphere",
    "cool blue lighting, mysterious mood",
    "vibrant colorful lighting, energetic",
    "minimalist lighting, clean composition",
    "moody lighting, dark atmosphere",
    "bright studio lighting, professional",
    "atmospheric lighting, ethereal mood",
  ];

  const compositions = [
    "close-up shot, detailed focus",
    "wide angle shot, expansive view",
    "low angle shot, powerful perspective",
    "high angle shot, overview perspective",
    "side profile shot, elegant angle",
    "three-quarter view, dynamic angle",
    "bird's eye view, unique perspective",
    "macro shot, extreme detail",
    "panoramic view, sweeping composition",
    "intimate shot, personal perspective",
  ];

  for (let i = 0; i < count; i++) {
    const style = styles[i % styles.length];
    const composition = compositions[i % compositions.length];
    const variation = `${basePrompt}, ${style}, ${composition}, high quality, detailed, professional photography`;
    variations.push(variation);
  }

  return variations;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      model = "dall-e-3",
      prompt,
      width,
      height,
      n = 1,
      style_weight = 0.6,
      seed,
      references = [],
      apiKey,
    } = body;

    // 檢查是否有 API Key
    if (!apiKey || apiKey.trim() === "") {
      // 沒有 API Key 時返回模擬數據
      console.log("No API Key provided, using mock data");
      const mockImages = Array.from({ length: n }, (_, i) => {
        const bgHue =
          Math.abs(
            [...(prompt || "mock")]?.reduce(
              (acc: number, c: string) => acc + c.charCodeAt(0),
              seed || 7
            )
          ) % 360;
        const grad1 = `hsl(${bgHue}, 70%, 18%)`;
        const grad2 = `hsl(${(bgHue + 40) % 360}, 70%, 28%)`;
        const accent = `hsl(${(bgHue + 80) % 360}, 80%, 60%)`;
        const sw = style_weight?.toFixed(2);
        const p = (prompt || "").replace(/[<>"&]/g, "");
        const svg = `\n  <svg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}'>\n    <defs>\n      <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>\n        <stop offset='0%' stop-color='${grad1}'/>\n        <stop offset='100%' stop-color='${grad2}'/>\n      </linearGradient>\n      <filter id='grain'>\n        <feTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2' stitchTiles='stitch'/>\n        <feColorMatrix type='saturate' values='0'/>\n        <feBlend mode='soft-light' in2='SourceGraphic'/>\n      </filter>\n    </defs>\n    <rect width='100%' height='100%' fill='url(#g)'/>\n    <g filter='url(#grain)'>\n      <circle cx='${
          width * 0.15
        }' cy='${height * 0.2}' r='${
          Math.min(width, height) * 0.12
        }' fill='${accent}' opacity='0.4'/>\n      <rect x='${
          width * 0.55
        }' y='${height * 0.6}' width='${width * 0.35}' height='${
          height * 0.3
        }' rx='${
          Math.min(width, height) * 0.04
        }' fill='${accent}' opacity='0.15'/>\n    </g>\n    <text x='24' y='36' font-family='ui-monospace, SFMono-Regular, Menlo, monospace' font-size='14' fill='white' opacity='0.75'>\n      ECF • Mock Image • seed:${seed} • sw:${sw}\n    </text>\n    <foreignObject x='24' y='52' width='${
          width - 48
        }' height='${
          height - 80
        }'>\n      <div xmlns='http://www.w3.org/1999/xhtml' style='font-family: ui-sans-serif, system-ui; color:white; opacity:.9; line-height:1.4; font-size:16px; overflow:hidden;'>\n        <div style='font-weight:700;margin-bottom:6px;'>Prompt</div>\n        <div style='opacity:.95; word-break:break-word;'>${p}</div>\n      </div>\n    </foreignObject>\n  </svg>`;
        return `data:image/svg+xml;base64,${Buffer.from(
          unescape(encodeURIComponent(svg))
        ).toString("base64")}`;
      });

      return Response.json({ images: mockImages });
    }

    // 有 API Key 時使用 DALL-E 3 生成真實圖像
    console.log(
      "OpenAI API Key provided, generating real images with DALL-E 3"
    );

    try {
      const openai = new OpenAI({ apiKey });

      // 批量生成多張圖像
      const realImages: string[] = [];

      // 直接使用原始提示詞生成一張圖像
      // 前端會為每個提示詞分別調用此 API

      const dalleResponse = await openai.images.generate({
        model: "dall-e-3",
        prompt: prompt, // 直接使用原始提示詞
        n: 1, // DALL-E 3 一次只能生成 1 張
        size: `${width}x${height}` as "1024x1024" | "1792x1024" | "1024x1792",
        quality: "hd",
        style: "vivid",
      });

      if (dalleResponse.data?.[0]?.url) {
        realImages.push(dalleResponse.data[0].url);
      }

      console.log(
        `DALL-E 3 generated ${realImages.length} images successfully`
      );

      return Response.json({
        images: realImages,
        note: `使用 DALL-E 3 批量生成 ${realImages.length} 張真實圖像`,
      });
    } catch (openaiError) {
      console.error("OpenAI API Error:", openaiError);

      // 如果 DALL-E 3 調用失敗，回退到模擬模式
      const mockImages = Array.from({ length: n }, (_, i) => {
        const bgHue =
          Math.abs(
            [...(prompt || "mock")]?.reduce(
              (acc: number, c: string) => acc + c.charCodeAt(0),
              seed || 7
            )
          ) % 360;
        const grad1 = `hsl(${bgHue}, 70%, 18%)`;
        const grad2 = `hsl(${(bgHue + 40) % 360}, 70%, 28%)`;
        const accent = `hsl(${(bgHue + 80) % 360}, 80%, 60%)`;
        const sw = style_weight?.toFixed(2);
        const p = (prompt || "").replace(/[<>"&]/g, "");
        const svg = `\n  <svg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}'>\n    <defs>\n      <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>\n        <stop offset='0%' stop-color='${grad1}'/>\n        <stop offset='100%' stop-color='${grad2}'/>\n      </linearGradient>\n      <filter id='grain'>\n        <feTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2' stitchTiles='stitch'/>\n        <feColorMatrix type='saturate' values='0'/>\n        <feBlend mode='soft-light' in2='SourceGraphic'/>\n      </filter>\n    </defs>\n    <rect width='100%' height='100%' fill='url(#g)'/>\n    <g filter='url(#grain)'>\n      <circle cx='${
          width * 0.15
        }' cy='${height * 0.2}' r='${
          Math.min(width, height) * 0.12
        }' fill='${accent}' opacity='0.4'/>\n      <rect x='${
          width * 0.55
        }' y='${height * 0.6}' width='${width * 0.35}' height='${
          height * 0.3
        }' rx='${
          Math.min(width, height) * 0.04
        }' fill='${accent}' opacity='0.15'/>\n    </g>\n    <text x='24' y='36' font-family='ui-monospace, SFMono-Regular, Menlo, monospace' font-size='14' fill='white' opacity='0.75'>\n      ECF • API Error Fallback • seed:${seed} • sw:${sw}\n    </text>\n    <foreignObject x='24' y='52' width='${
          width - 48
        }' height='${
          height - 80
        }'>\n      <div xmlns='http://www.w3.org/1999/xhtml' style='font-family: ui-sans-serif, system-ui; color:white; opacity:.9; line-height:1.4; font-size:16px; overflow:hidden;'>\n        <div style='font-weight:700;margin-bottom:6px;'>Original Prompt</div>\n        <div style='opacity:.95; word-break:break-word;'>${p}</div>\n      </div>\n    </foreignObject>\n  </svg>`;
        return `data:image/svg+xml;base64,${Buffer.from(
          unescape(encodeURIComponent(svg))
        ).toString("base64")}`;
      });

      return Response.json({
        images: mockImages,
        error: `DALL-E 3 API 調用失敗: ${
          openaiError instanceof Error ? openaiError.message : "未知錯誤"
        }`,
        note: "已回退到模擬模式",
      });
    }
  } catch (error) {
    console.error("API Error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
