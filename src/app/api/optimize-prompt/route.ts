import type { NextRequest } from 'next/server';
import OpenAI from 'openai';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt, apiKey } = body;

    if (!apiKey || !prompt) {
      return Response.json({ error: "Missing API key or prompt" }, { status: 400 });
    }

    const openai = new OpenAI({ apiKey });

    // 提示詞優化
    const optimizationPrompt = `請優化以下圖像生成提示詞，使其更專業、更具描述性，並添加適當的風格詞彙：

原始提示詞：${prompt}

請提供優化後的提示詞，要求：
1. 保持原意不變
2. 添加專業攝影術語
3. 包含光照、構圖、風格描述
4. 使用英文輸出
5. 長度控制在100-200字之間`;

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "你是一個專業的圖像生成提示詞優化專家，擅長將簡單的描述轉換為專業、詳細的提示詞。"
        },
        {
          role: "user",
          content: optimizationPrompt
        }
      ],
      max_tokens: 300,
      temperature: 0.7
    });

    const optimizedPrompt = response.choices[0]?.message?.content || prompt;

    return Response.json({ 
      optimizedPrompt,
      originalPrompt: prompt
    });

  } catch (error) {
    console.error('Optimization API Error:', error);
    return Response.json({ 
      error: `Optimization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      optimizedPrompt: prompt // 返回原文作為備用
    }, { status: 500 });
  }
}
