"use server"

import { revalidatePath } from "next/cache"

export async function chatWithAI(prompt: string, context: string) {
  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama3-70b-8192",
        messages: [
          {
            role: "system",
            content:
              "You are a helpful AI tutor that assists with flashcard studying. Provide concise, accurate explanations about the current flashcard content. Keep responses focused, educational, and under 150 words when possible.",
          },
          {
            role: "user",
            content: `I'm studying a flashcard with the following content:
            
Front (Question): ${context.split("|||")[0]}
Back (Answer): ${context.split("|||")[1]}

My question is: ${prompt}`,
          },
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error?.message || "Failed to get AI response")
    }

    const data = await response.json()
    const content = data.choices[0]?.message?.content

    if (!content) {
      throw new Error("No content returned from Groq")
    }

    revalidatePath("/deck/[id]/study")
    return { message: content }
  } catch (error) {
    console.error("Error in AI chat:", error)
    return { error: error instanceof Error ? error.message : "Failed to get AI response" }
  }
}
