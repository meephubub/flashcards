import { ChatGroq } from "@langchain/groq"
import { createReactAgent } from "@langchain/langgraph/prebuilt"
import { HumanMessage, AIMessage, SystemMessage, BaseMessage, ToolMessage } from "@langchain/core/messages"
import { tool } from "@langchain/core/tools"
import { MessagesAnnotation } from "@langchain/langgraph"
import { z } from "zod"

// Calculator tool
const calc = tool(
  async (input: string) => {
    let expressionToEvaluate = input
    try {
      const parsedInput = JSON.parse(input)
      if (typeof parsedInput === "object" && parsedInput !== null && "input" in parsedInput) {
        expressionToEvaluate = parsedInput.input
      }
    } catch {
      // Not JSON, use as-is
    }
    try {
      // eslint-disable-next-line no-eval
      const result = eval(expressionToEvaluate)
      return result?.toString() ?? "Invalid expression"
    } catch {
      return "Invalid expression"
    }
  },
  {
    name: "calc",
    description: "Evaluate simple math expressions. Input should be a valid JavaScript math expression.",
    schema: z.string(),
  }
)

// Web search tool
const webSearch = tool(
  async (input: string) => {
    try {
      const response = await fetch(
        `https://duckduckgo.com/?q=${encodeURIComponent(input)}&format=json&no_redirect=1&no_html=1&t=flashcards`
      )
      if (!response.ok) return "Web search failed."
      const data = await response.json()
      let results = []
      if (data?.RelatedTopics?.length) {
        results = data.RelatedTopics.slice(0, 3).map(
          (item: any, i: number) =>
            `**${item.Text || item.Name || `Result ${i + 1}`}**\n${item.FirstURL || item.URL || ""}`
        )
      } else if (data?.AbstractText) {
        results = [data.AbstractText]
      } else {
        results = ["No results found."]
      }
      return results.join("\n\n")
    } catch (err) {
      return `Web search error: ${err}`
    }
  },
  {
    name: "webSearch",
    description: "Search the web using DuckDuckGo and return the top 3 results as markdown.",
    schema: z.string(),
  }
)

// Date/time tool
const dateTime = tool(
  async () => {
    try {
      const now = new Date()
      return `Current date and time: ${now.toLocaleString()}`
    } catch (err) {
      return `Error getting date and time: ${err}`
    }
  },
  {
    name: "dateTime",
    description: "Get the current date and time. Input is ignored.",
    schema: z.string(),
  }
)

// Wikipedia tool
const wikipedia = tool(
  async (input: string) => {
    try {
      const response = await fetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(input)}`
      )
      if (!response.ok) return "Wikipedia lookup failed."
      const data = await response.json()
      if (data.extract) {
        return `**${data.title}**\n${data.extract}`
      }
      return "No summary found."
    } catch (err) {
      return `Wikipedia error: ${err}`
    }
  },
  {
    name: "wikipedia",
    description: "Get a summary of a topic from Wikipedia. Input is the topic name.",
    schema: z.string(),
  }
)

const tools = [calc, webSearch, dateTime, wikipedia]

const systemPrompt = `You are a helpful AI assistant. You have access to tools for calculations, web search, getting the current date/time, and Wikipedia lookups. Use these tools when appropriate to help answer questions accurately.`

export async function POST(req: Request) {
  // Enable LangSmith tracing if API key is present
  if (process.env.LANGSMITH_API_KEY) {
    process.env.LANGCHAIN_TRACING_V2 = "true"
    process.env.LANGCHAIN_PROJECT = process.env.LANGCHAIN_PROJECT || "flashcards-chat"
  }

  let body
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  const { prompt, history } = body || {}

  if (!prompt) {
    return new Response(JSON.stringify({ error: "Missing prompt" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  // Initialize Groq LLM
  const llm = new ChatGroq({
    model: "openai/gpt-oss-120b",
    temperature: 0.2,
    apiKey: process.env.GROQ_API_KEY,
  }).bindTools(tools)

  // Create agent
  const agent = createReactAgent({
    llm,
    tools,
    stateSchema: MessagesAnnotation,
  })

  // Build message history
  const limitedHistory = Array.isArray(history) ? history.slice(-6) : []
  const messages: BaseMessage[] = [
    new SystemMessage(systemPrompt),
    ...limitedHistory.map((m: any) =>
      m.role === "user" ? new HumanMessage(m.content) : new AIMessage(m.content)
    ),
    new HumanMessage(prompt),
  ]

  // Streaming response
  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      let currentMessages: BaseMessage[] = messages
      let maxLoops = 5
      let loopCount = 0
      let done = false

      while (!done && loopCount < maxLoops) {
        loopCount++

        let agentStream
        try {
          agentStream = await agent.stream({ messages: currentMessages })
        } catch (err) {
          console.error("[Chat API] Agent stream error:", err)
          controller.enqueue(
            encoder.encode(JSON.stringify({ type: "error", error: `Agent error: ${err}` }) + "\n")
          )
          controller.close()
          return
        }

        let lastMsg: BaseMessage | null = null

        for await (const chunk of agentStream) {
          // The chunk structure from createReactAgent stream can vary.
          // It might be { agent: { messages: [...] } } or { tools: { messages: [...] } } or just { messages: [...] }
          let msgs: BaseMessage[] = []

          // Safe check for chunk structure
          if (chunk && typeof chunk === "object") {
            if ("agent" in chunk && (chunk as any).agent && "messages" in (chunk as any).agent) {
              const agentMsgs = (chunk as any).agent.messages
              msgs = Array.isArray(agentMsgs) ? agentMsgs : [agentMsgs]
            } else if ("tools" in chunk && (chunk as any).tools && "messages" in (chunk as any).tools) {
              const toolsMsgs = (chunk as any).tools.messages
              msgs = Array.isArray(toolsMsgs) ? toolsMsgs : [toolsMsgs]
            } else if ("messages" in chunk) {
              const chunkMsgs = (chunk as any).messages
              msgs = Array.isArray(chunkMsgs) ? chunkMsgs : [chunkMsgs]
            }
          }

          for (const msg of msgs) {
            lastMsg = msg

            if (!msg || typeof msg.getType !== "function") {
              // Skip invalid messages but log warning
              // console.warn("Received invalid message object:", msg)
              continue
            }

            if (msg.getType() === "ai") {
              const aiMessage = msg as AIMessage
              if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
                for (const toolCall of aiMessage.tool_calls) {
                  let toolName: string | undefined
                  let toolArgs: string | undefined
                  const id = (toolCall as any).id

                  if ((toolCall as any).name && (toolCall as any).args) {
                    toolName = (toolCall as any).name
                    toolArgs =
                      typeof (toolCall as any).args === "string"
                        ? (toolCall as any).args
                        : JSON.stringify((toolCall as any).args)
                  } else if ((toolCall as any).function) {
                    toolName = (toolCall as any).function.name
                    toolArgs = (toolCall as any).function.arguments
                  }

                  // Stream tool_call event
                  controller.enqueue(
                    encoder.encode(JSON.stringify({ type: "tool_call", tool: toolName, args: toolArgs, id }) + "\n")
                  )

                  // Execute tool
                  let toolResult = ""
                  try {
                    const toolMap: Record<string, any> = {
                      calc,
                      webSearch,
                      dateTime,
                      wikipedia,
                    }
                    if (toolName && toolMap[toolName]) {
                      toolResult = await toolMap[toolName].invoke(toolArgs)
                    } else {
                      toolResult = `Tool ${toolName} not found.`
                    }
                    if (typeof toolResult !== "string") {
                      toolResult = JSON.stringify(toolResult)
                    }
                  } catch (err) {
                    toolResult = `Error executing tool: ${err}`
                  }

                  // Stream tool_result event
                  controller.enqueue(
                    encoder.encode(
                      JSON.stringify({ type: "tool_result", tool: toolName, result: toolResult, id }) + "\n"
                    )
                  )

                  // Add tool result to messages for next loop
                  currentMessages = [
                    ...currentMessages,
                    new ToolMessage({
                      content: toolResult,
                      tool_call_id: id,
                    }),
                  ]
                }
              }
            } else if (msg.content) {
              controller.enqueue(encoder.encode(JSON.stringify({ type: "chunk", content: msg.content }) + "\n"))
            }
          }
        }

        // Check if we need to loop again (if last message had tool calls)
        if (lastMsg && (lastMsg as BaseMessage).getType() === "ai") {
          const aiMessage = lastMsg as AIMessage
          if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
            continue
          }
        }

        // Send final message
        controller.enqueue(
          encoder.encode(JSON.stringify({ type: "final", content: lastMsg?.content || "" }) + "\n")
        )
        done = true
        break
      }

      controller.close()
    },
  })

  return new Response(readable, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Transfer-Encoding": "chunked",
    },
  })
}