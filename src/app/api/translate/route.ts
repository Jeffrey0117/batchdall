import type { NextRequest } from 'next/server';
import OpenAI from 'openai';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, target, apiKey } = body;

    if (!apiKey || !text) {
      return Response.json({ error: "Missing API key or text" }, { status: 400 });
    }

    const openai = new OpenAI({ apiKey });

    // 翻譯功能
    const prompt = target === "en" 
      ? `請將以下中文翻譯成英文，保持專業的圖像生成提示詞風格：${text}`
      : `請將以下英文翻譯成中文：${text}`;

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "你是一個專業的翻譯助手，專門處理圖像生成提示詞的翻譯。"
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 500,
      temperature: 0.3
    });

    const translatedText = response.choices[0]?.message?.content || text;

    return Response.json({ 
      translatedText,
      originalText: text,
      target 
    });

  } catch (error) {
    console.error('Translation API Error:', error);
    return Response.json({ 
      error: `Translation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      translatedText: text // 返回原文作為備用
    }, { status: 500 });
  }
}
