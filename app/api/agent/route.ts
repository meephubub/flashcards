import { createReactAgent } from "@langchain/langgraph/prebuilt"
import { ChatOpenAI } from "@langchain/openai"
import { HumanMessage, AIMessage, SystemMessage, BaseMessage } from "@langchain/core/messages"
import { tool } from "@langchain/core/tools"
import { MessagesAnnotation } from "@langchain/langgraph"
import { z } from "zod";
import { config } from "dotenv";
config();

// Add Supabase client
import { createClient } from "@/lib/supabase/server";

// Simple calc tool
const calc = tool(
    async (input: string) => {
      let expressionToEvaluate = input;
      try {
        const parsedInput = JSON.parse(input);
        if (typeof parsedInput === 'object' && parsedInput !== null && 'input' in parsedInput) {
          expressionToEvaluate = parsedInput.input;
        }
      } catch (e) {
        // Not a JSON string, or doesn't have an 'input' key, so use the original input
      }

      try {
        // eslint-disable-next-line no-eval
        const result = eval(expressionToEvaluate);
        return result?.toString() ?? "Invalid expression";
      } catch {
        return "Invalid expression";
      }
    },
    {
      name: "calc",
      description: "Evaluate simple math expressions. Input should be a valid JavaScript math expression.",
      schema: z.string(),
    }
  );

// DuckDuckGo web search tool
const webSearch = tool(
  async (input: string) => {
    try {
      const response = await fetch(`https://duckduckgo.com/?q=${encodeURIComponent(input)}&format=json&no_redirect=1&no_html=1&t=flashcards`);
      if (!response.ok) return "Web search failed.";
      const data = await response.json();
      // DuckDuckGo's public API is limited; fallback to instant answer or related topics
      let results = [];
      if (data?.RelatedTopics?.length) {
        results = data.RelatedTopics.slice(0, 3).map((item: any, i: number) =>
          `**${item.Text || item.Name || `Result ${i + 1}`}**\n${item.FirstURL || item.URL || ''}`
        );
      } else if (data?.AbstractText) {
        results = [data.AbstractText];
      } else {
        results = ["No results found."];
      }
      return results.join("\n\n");
    } catch (err) {
      return `Web search error: ${err}`;
    }
  },
  {
    name: "webSearch",
    description: "Search the web using DuckDuckGo and return the top 3 results as markdown.",
    schema: z.string(),
  }
);

// Image generation tool (Pollinations)
const imageGen = tool(
  async (input: string) => {
    // Use Pollinations API with model flux-pro
    const model = "flux-pro";
    const endpoint = `https://image.pollinations.ai/prompt/${encodeURIComponent(input)}?model=${model}`;
    try {
      // Send a request to the endpoint to trigger image generation
      const response = await fetch(endpoint);
      if (!response.ok) {
        return `Image generation failed: ${response.statusText}`;
      }
      // The endpoint returns an image directly, so use the same URL
      return `!(img)[${endpoint}]`;
    } catch (err) {
      return `Image generation error: ${err}`;
    }
  },
  {
    name: "imageGen",
    description: "Generate an image using Pollinations (model flux-pro) and return a markdown image link. Input is the image prompt.",
    schema: z.string(),
  }
);

// NewsAPI headlines tool
const newsApi = tool(
  async (input: string) => {
    const NEWS_API_KEY = process.env.NEWS_API_KEY;
    if (!NEWS_API_KEY) {
      return "News API key not set.";
    }
    try {
      // Use /everything for broader search
      const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(input)}&apiKey=${NEWS_API_KEY}&language=en&pageSize=3&sortBy=publishedAt`;
      const response = await fetch(url);
      if (!response.ok) return `News search failed: ${response.statusText}`;
      const data = await response.json();
      if (data.articles && data.articles.length > 0) {
        return data.articles.map((a: any, i: number) =>
          `**${a.title}**\n${a.url}`
        ).join("\n\n");
      }
      // Show NewsAPI error message if present
      if (data.message) {
        return `NewsAPI error: ${data.message}`;
      }
      return "No news found.";
    } catch (err) {
      return `News search error: ${err}`;
    }
  },
  {
    name: "newsApi",
    description: "Search the news using NewsAPI.org and return the top 3 headlines as markdown. Input is the news topic or keywords.",
    schema: z.string(),
  }
);

// 1. Dictionary/Definition Tool
const dictionary = tool(
  async (input: string) => {
    try {
      const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(input)}`);
      if (!response.ok) return "Definition lookup failed.";
      const data = await response.json();
      if (Array.isArray(data) && data[0]?.meanings?.length) {
        const defs = data[0].meanings.flatMap((m: any) => m.definitions.map((d: any) => `- ${d.definition}`));
        return `**${data[0].word}**\n${defs.slice(0, 3).join("\n")}`;
      }
      return "No definition found.";
    } catch (err) {
      return `Definition error: ${err}`;
    }
  },
  {
    name: "dictionary",
    description: "Look up the English definition of a word. Input is a single word.",
    schema: z.string(),
  }
);

// 2. Wikipedia Summary Tool
const wikipedia = tool(
  async (input: string) => {
    try {
      const response = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(input)}`);
      if (!response.ok) return "Wikipedia lookup failed.";
      const data = await response.json();
      if (data.extract) {
        return `**${data.title}**\n${data.extract}`;
      }
      return "No summary found.";
    } catch (err) {
      return `Wikipedia error: ${err}`;
    }
  },
  {
    name: "wikipedia",
    description: "Get a summary of a topic from Wikipedia. Input is the topic name.",
    schema: z.string(),
  }
);

// 3. Unit Conversion Tool
const unitConvert = tool(
  async (input: string) => {
    // Input: "10 meters to feet"
    try {
      const response = await fetch(`https://api.api-ninjas.com/v1/convertunit?query=${encodeURIComponent(input)}`, {
        headers: { 'X-Api-Key': process.env.NINJAS_API_KEY || '' }
      });
      if (!response.ok) return "Unit conversion failed.";
      const data = await response.json();
      if (data.new_unit && data.new_value) {
        return `${input.split(" ")[0]} ${data.old_unit} = ${data.new_value} ${data.new_unit}`;
      }
      return "No conversion result.";
    } catch (err) {
      return `Unit conversion error: ${err}`;
    }
  },
  {
    name: "unitConvert",
    description: "Convert between units. Input format: '<value> <from_unit> to <to_unit>' (e.g., '10 meters to feet').",
    schema: z.string(),
  }
);

// 4. Currency Conversion Tool
const currencyConvert = tool(
  async (input: string) => {
    // Input: "10 USD to EUR"
    try {
      const match = input.match(/(\d+(?:\.\d+)?)\s*([A-Za-z]{3})\s*to\s*([A-Za-z]{3})/);
      if (!match) return "Input format: '<amount> <from_currency> to <to_currency>' (e.g., '10 USD to EUR').";
      const [, amount, from, to] = match;
      const response = await fetch(`https://api.exchangerate.host/convert?from=${from}&to=${to}&amount=${amount}`);
      if (!response.ok) return "Currency conversion failed.";
      const data = await response.json();
      if (data.result) {
        return `${amount} ${from} = ${data.result} ${to}`;
      }
      return "No conversion result.";
    } catch (err) {
      return `Currency conversion error: ${err}`;
    }
  },
  {
    name: "currencyConvert",
    description: "Convert between currencies. Input format: '<amount> <from_currency> to <to_currency>' (e.g., '10 USD to EUR').",
    schema: z.string(),
  }
);

// 5. Weather Tool
const weather = tool(
  async (input: string) => {
    // Input: city name
    try {
      const apiKey = process.env.OPENWEATHER_API_KEY;
      if (!apiKey) return "Weather API key not set.";
      const response = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(input)}&appid=${apiKey}&units=metric`);
      if (!response.ok) return "Weather lookup failed.";
      const data = await response.json();
      if (data.weather && data.main) {
        return `Weather in ${data.name}: ${data.weather[0].description}, ${data.main.temp}°C`;
      }
      return "No weather data found.";
    } catch (err) {
      return `Weather error: ${err}`;
    }
  },
  {
    name: "weather",
    description: "Get current weather for a city. Input is the city name.",
    schema: z.string(),
  }
);

// 6. Random Joke Tool
const joke = tool(
  async () => {
    try {
      const response = await fetch("https://official-joke-api.appspot.com/random_joke");
      if (!response.ok) return "Joke lookup failed.";
      const data = await response.json();
      return `${data.setup}\n${data.punchline}`;
    } catch (err) {
      return `Joke error: ${err}`;
    }
  },
  {
    name: "joke",
    description: "Get a random joke. Input is ignored.",
    schema: z.string(),
  }
);

// 7. Translation Tool
const translate = tool(
  async (input: string) => {
    // Input: "<text> to <language>"
    try {
      const match = input.match(/(.+) to ([A-Za-z]+)/);
      if (!match) return "Input format: '<text> to <language>' (e.g., 'Hello to French').";
      const [, text, lang] = match;
      const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${encodeURIComponent(lang)}`);
      if (!response.ok) return "Translation failed.";
      const data = await response.json();
      if (data.responseData?.translatedText) {
        return data.responseData.translatedText;
      }
      return "No translation result.";
    } catch (err) {
      return `Translation error: ${err}`;
    }
  },
  {
    name: "translate",
    description: "Translate text to another language. Input format: '<text> to <language>' (e.g., 'Hello to French').",
    schema: z.string(),
  }
);

// 8. Time and Date Tool
const dateTime = tool(
  async () => {
    try {
      const now = new Date();
      return `Current date and time: ${now.toLocaleString()}`;
    } catch (err) {
      return `Error getting date and time: ${err}`;
    }
  },
  {
    name: "dateTime",
    description: "Get the current date and time. Input is ignored.",
    schema: z.string(),
  }
);

// 9. Synonym/Antonym Tool
const synonyms = tool(
  async (input: string) => {
    // Input: "synonym <word>" or "antonym <word>"
    let type = "";
    try {
      const match = input.match(/(synonym|antonym)\s+(.+)/i);
      if (!match) return "Input format: 'synonym <word>' or 'antonym <word>'.";
      type = match[1];
      const word = match[2];
      const response = await fetch(`https://api.datamuse.com/words?rel_${type === 'synonym' ? 'syn' : 'ant'}=${encodeURIComponent(word)}`);
      if (!response.ok) return `${type} lookup failed.`;
      const data = await response.json();
      if (Array.isArray(data) && data.length) {
        return `${type.charAt(0).toUpperCase() + type.slice(1)}s for ${word}:\n` + data.slice(0, 5).map((w: any) => w.word).join(", ");
      }
      return `No ${type}s found.`;
    } catch (err) {
      return `${type} error: ${err}`;
    }
  },
  {
    name: "synonyms",
    description: "Find synonyms or antonyms for a word. Input: 'synonym <word>' or 'antonym <word>'.",
    schema: z.string(),
  }
);

export const fanOn = tool(
  async () => {
    try {
      const response = await fetch("https://api-v2.voicemonkey.io/trigger?token=814e797e65ae46a6828e1001150bd8ac_0a30f8185cdd6014f8a9b1d0ef1b326a&device=fan-on");
      if (!response.ok) return "Failed to turn fan on.";
      return "Fan turned on successfully.";
    } catch (err) {
      return `Fan on error: ${err}`;
    }
  },
  {
    name: "fanOn",
    description: "Turns the fan on. Input is ignored.",
    schema: z.string(),
  }
);

export const fanOff = tool(
  async () => {
    try {
      const response = await fetch("https://api-v2.voicemonkey.io/trigger?token=814e797e65ae46a6828e1001150bd8ac_0a30f8185cdd6014f8a9b1d0ef1b326a&device=fan-off");
      if (!response.ok) return "Failed to turn fan off.";
      return "Fan turned off successfully.";
    } catch (err) {
      return `Fan off error: ${err}`;
    }
  },
  {
    name: "fanOff",
    description: "Turns the fan off. Input is ignored.",
    schema: z.string(),
  }
);

// 12. Schedule Tool
const schedule = tool(
  async (input: string) => {
    // Input format: "{ \"action\": \"fanOn\", \"run_at\": \"YYYY-MM-DDTHH:MM:SSZ\", \"params\": \"{}\" }"
    try {
      const parsedInput = JSON.parse(input);
      const { action, run_at } = parsedInput;
      let params = parsedInput.params;

      // If params is a string, attempt to parse it as JSON
      if (typeof params === 'string') {
        try {
          params = JSON.parse(params);
        } catch (e) {
          // If parsing fails, treat it as an empty object
          params = {};
        }
      }

      if (!["fanOn", "fanOff"].includes(action)) {
        return `Unsupported action: ${action}. Only 'fanOn' and 'fanOff' are supported.`;
      }

      // Validate run_at is a valid date-time string
      if (isNaN(new Date(run_at).getTime())) {
        return `Invalid run_at time: ${run_at}. Please use ISO 8601 format (e.g., '2024-12-31T23:59:59Z').`;
      }

      // Initialize Supabase client
      const supabase = await createClient(); // Use the server-side client

      // Check if an identical task already exists
      const { data: existingTasks, error: checkError } = await supabase
        .from("tasks")
        .select("id")
        .eq("action", action)
        .eq("run_at", run_at)
        .eq("params", JSON.stringify(params));

      if (checkError) {
        console.error("Supabase check error:", checkError);
        return `Failed to check for existing tasks: ${checkError.message}`;
      }

      if (existingTasks && existingTasks.length > 0) {
        return `Task '${action}' to run at ${run_at} is already scheduled.`;
      }

      // Insert into tasks table
      const { data, error } = await supabase.from("tasks").insert([
        { action, run_at, params: params || {} }, // Ensure params is an object, default to empty if null/undefined
      ]);

      if (error) {
        console.error("Supabase insert error:", error);
        return `Failed to schedule task: ${error.message}`;
      }
      return `Task '${action}' scheduled successfully to run at ${run_at}.`;
    } catch (err) {
      return `Schedule tool error: ${err}. Input format: '{\"action\": \"fanOn\", \"run_at\": \"YYYY-MM-DDTHH:MM:SSZ\", \"params\": \"{}\" }'`;
    }
  },
  {
    name: "schedule",
    description: "Schedule a task (fanOn or fanOff) to run at a specific time. Input is a JSON string with 'action' (fanOn/fanOff), 'run_at' (ISO 8601 datetime, e.g., '2024-12-31T23:59:59Z'), and optional 'params' (JSON object).",
    schema: z.string(),
  }
);

const tools = [calc, webSearch, imageGen, newsApi, dictionary, wikipedia, unitConvert, currencyConvert, weather, joke, translate, dateTime, synonyms, fanOn, fanOff, schedule];
const llm = new ChatOpenAI({
  model: "openai",           // or your desired model
  temperature: 0.2,
  configuration: {
    baseURL: "https://text.pollinations.ai/openai/",  // 🛠️ set your custom API root here
  },
}).bindTools(tools)

const agent = createReactAgent({
  llm,
  tools,
  stateSchema: MessagesAnnotation,
})

// Add system prompt
const systemPrompt = "If the user asks for a calculation or math expression, always use the calc tool. Do not attempt to answer math questions yourself. Use the schedule tool if the user asks to schedule an action like turning on/off the fan at a specific time. The schedule tool requires an 'action' (fanOn or fanOff), 'run_at' (an ISO 8601 formatted datetime string, like '2024-12-31T23:59:59Z'), and optionally 'params' (a JSON object, default to {} if not provided). For example, to turn the fan on tomorrow at 9 AM, use: schedule({\"action\": \"fanOn\", \"run_at\": \"2024-01-01T09:00:00Z\", \"params\": \"{}\"}).";

export async function POST(req: Request) {
  console.log("[POST] /api/agent called");
  let body;
  try {
    body = await req.json();
    console.log("[POST] Parsed body:", body);
  } catch (err) {
    console.error("[POST] Failed to parse JSON body:", err);
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }
  const { prompt, history, stream = true } = body || {};
  console.log("[POST] Extracted:", { prompt, history, stream });
  if (!prompt) {
    console.warn("[POST] Missing prompt");
    return new Response(JSON.stringify({ error: "Missing prompt" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  // Build message history with system prompt
  let messages: BaseMessage[];
  try {
    messages = [
      new SystemMessage(systemPrompt),
      ...(Array.isArray(history)
        ? history.map((m: any) =>
            m.role === "user"
              ? new HumanMessage(m.content)
              : new AIMessage(m.content)
          )
        : []),
      new HumanMessage(prompt),
    ];
    console.log("[POST] Built messages:", messages);
  } catch (err) {
    console.error("[POST] Error building messages:", err);
    return new Response(JSON.stringify({ error: "Failed to build messages" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }

  // TEST TOOL STREAM: If prompt is __test_tool_stream__, forcibly send a fake tool_call and tool_result event
  if (prompt === "__test_tool_stream__" && stream) {
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        // Fake tool_call
        controller.enqueue(encoder.encode(JSON.stringify({ type: "tool_call", tool: "testTool", args: "test argument", id: "test-id-123" }) + "\n"));
        // Fake tool_result
        controller.enqueue(encoder.encode(JSON.stringify({ type: "tool_result", tool: "testTool", result: "This is a test tool result.", id: "test-id-123" }) + "\n"));
        // Final response
        controller.enqueue(encoder.encode(JSON.stringify({ type: "final", content: "This is a test final response from the agent." }) + "\n"));
        controller.close();
      },
    });
    return new Response(readable, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Transfer-Encoding": "chunked",
      },
    });
  }

  if (stream) {
    console.log("[POST] Using streaming response");
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        let currentMessages: BaseMessage[] = messages;
        let maxLoops = 5; // Prevent infinite loops
        let loopCount = 0;
        let done = false;
        while (!done && loopCount < maxLoops) {
          loopCount++;
          let agentStream;
          try {
            agentStream = await agent.stream({ messages: currentMessages });
          } catch (err) {
            controller.enqueue(encoder.encode(JSON.stringify({ type: "error", error: "Failed to create agent stream" }) + "\n"));
            controller.close();
            return;
          }
          let lastMsg: BaseMessage | null = null;
          for await (const chunk of agentStream) {
            const agentChunk = (chunk as { agent?: { messages: BaseMessage[] } }).agent || (chunk as { messages: BaseMessage[] });
            const msgs: BaseMessage[] = Array.isArray(agentChunk.messages) ? agentChunk.messages : [];
            for (const msg of msgs) {
              lastMsg = msg;

              // Check if it's an AIMessage and if it has tool_calls
              if (msg._getType() === 'ai') {
                const aiMessage = msg as AIMessage;
                if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
                  const toolCalls = aiMessage.tool_calls;
                  for (const toolCall of toolCalls) {
                    let toolName: string | undefined;
                    let toolArgs: string | undefined;
                    const id = (toolCall as any).id; // ID seems consistent

                    if ((toolCall as any).name && (toolCall as any).args) {
                      toolName = (toolCall as any).name;
                      toolArgs = (toolCall as any).args;
                    } else if ((toolCall as any).function) {
                      toolName = (toolCall as any).function.name;
                      toolArgs = (toolCall as any).function.arguments;
                    }

                    // If toolArgs is an object with an 'input' property, extract the input string
                    if (typeof toolArgs === 'object' && toolArgs !== null && 'input' in toolArgs) {
                      toolArgs = (toolArgs as any).input;
                    }

                    // Stream tool_call event
                    controller.enqueue(encoder.encode(JSON.stringify({ type: "tool_call", tool: toolName, args: toolArgs, id }) + "\n"));
                    let toolResult: string = "";
                    try {
                      if (toolName === "calc") {
                        toolResult = await calc.invoke(toolArgs) as string;
                      } else if (toolName === "webSearch") {
                        toolResult = await webSearch.invoke(toolArgs) as string;
                      } else if (toolName === "imageGen") {
                        toolResult = await imageGen.invoke(toolArgs) as string;
                      } else if (toolName === "newsApi") {
                        toolResult = await newsApi.invoke(toolArgs) as string;
                      } else if (toolName === "dictionary") {
                        toolResult = await dictionary.invoke(toolArgs) as string;
                      } else if (toolName === "wikipedia") {
                        toolResult = await wikipedia.invoke(toolArgs) as string;
                      } else if (toolName === "unitConvert") {
                        toolResult = await unitConvert.invoke(toolArgs) as string;
                      } else if (toolName === "currencyConvert") {
                        toolResult = await currencyConvert.invoke(toolArgs) as string;
                      } else if (toolName === "weather") {
                        toolResult = await weather.invoke(toolArgs) as string;
                      } else if (toolName === "joke") {
                        toolResult = await joke.invoke(toolArgs) as string;
                      } else if (toolName === "translate") {
                        toolResult = await translate.invoke(toolArgs) as string;
                      } else if (toolName === "dateTime") {
                        toolResult = await dateTime.invoke(toolArgs) as string;
                      } else if (toolName === "synonyms") {
                        toolResult = await synonyms.invoke(toolArgs) as string;
                      } else if (toolName === "fanOn") {
                        toolResult = await fanOn.invoke(toolArgs) as string;
                      } else if (toolName === "fanOff") {
                        toolResult = await fanOff.invoke(toolArgs) as string;
                      } else if (toolName === "schedule") {
                        toolResult = await schedule.invoke(toolArgs) as string;
                      } else {
                        toolResult = `Tool ${toolName} not implemented.`;
                      }
                      if (typeof toolResult !== "string") {
                        toolResult = toolResult && typeof toolResult === "object" && "content" in toolResult && typeof (toolResult as any).content === "string"
                          ? (toolResult as any).content
                          : JSON.stringify(toolResult);
                      }
                    } catch (err) {
                      toolResult = `Error executing tool: ${err}`;
                    }
                    // Stream tool_result event
                    controller.enqueue(encoder.encode(JSON.stringify({ type: "tool_result", tool: toolName, result: toolResult, id }) + "\n"));
                    // Add tool result to messages for next loop
                    currentMessages = [
                      ...currentMessages,
                      new AIMessage({
                        content: toolResult,
                        additional_kwargs: { tool_call_id: id },
                      }),
                    ];
                  }
                }
              } else if (msg.content) {
                // If there's content, stream it as a chunk.
                controller.enqueue(encoder.encode(JSON.stringify({ type: "chunk", content: msg.content }) + "\n"));
              }
            } // End of for (const msg of msgs)
          } // End of for await (const chunk of agentStream)

          // After processing all chunks from agentStream in this loop iteration
          // If the last message processed had tool calls, then we need to loop again.
          // Check for AIMessage and its direct tool_calls property
          if (lastMsg && lastMsg._getType() === 'ai') {
            const aiMessage = lastMsg as AIMessage;
            if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
              const toolCalls = aiMessage.tool_calls;
              continue; // Loop again for the next agent turn
            }
          }
          // If no tool calls were detected in the last message, then this is the final output.
          // The content should have already been streamed as 'chunk' types.
          // Now, send the final event to signal completion.
          controller.enqueue(encoder.encode(JSON.stringify({ type: "final", content: lastMsg?.content || "" }) + "\n"));
          done = true;
          break;
        }
        controller.close();
      },
    });
    return new Response(readable, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Transfer-Encoding": "chunked",
      },
    });
  } else {
    // Non-streaming: implement OpenAI function calling loop
    console.log("[POST] Using non-streaming response (function calling loop)");
    let fullMsg = "";
    let currentMessages: BaseMessage[] = messages;
    let maxLoops = 5; // Prevent infinite loops
    let loopCount = 0;
    while (loopCount < maxLoops) {
      loopCount++;
      let agentStream;
      try {
        agentStream = await agent.stream({ messages: currentMessages });
        console.log(`[nostream] agent.stream created (loop ${loopCount})`);
      } catch (err) {
        console.error(`[nostream] Error creating agent stream (loop ${loopCount}):`, err);
        return new Response(JSON.stringify({ error: "Failed to create agent stream" }), { status: 500, headers: { "Content-Type": "application/json" } });
      }
      let lastMsg: BaseMessage | null = null;
      for await (const chunk of agentStream) {
        console.log(`[nostream] chunk (loop ${loopCount}):`, JSON.stringify(chunk, null, 2));
        const agentChunk = (chunk as { agent?: { messages: BaseMessage[] } }).agent || (chunk as { messages: BaseMessage[] });
        const msgs: BaseMessage[] = Array.isArray(agentChunk.messages) ? agentChunk.messages : [];
        lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;
        if (lastMsg) {
          console.log(`[nostream] lastMsg (loop ${loopCount}):`, lastMsg);
        }
      }
      if (!lastMsg) {
        console.warn(`[nostream] No lastMsg in loop ${loopCount}`);
        break;
      }
      // Check for tool_calls (OpenAI function calling)
      if (lastMsg._getType() === 'ai') {
        const aiMessage = lastMsg as AIMessage;
        if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
          const toolCalls = aiMessage.tool_calls;
          console.log(`[nostream] tool_calls detected (loop ${loopCount}):`, toolCalls);
          // For each tool call, execute the tool and build tool message(s)
          const toolResults = [];
          for (const toolCall of toolCalls) {
            const id = (toolCall as any).id;
            let toolName: string | undefined;
            let toolArgs: string | undefined;

            if ((toolCall as any).name && (toolCall as any).args) {
              toolName = (toolCall as any).name;
              toolArgs = (toolCall as any).args;
            } else if ((toolCall as any).function) {
              toolName = (toolCall as any).function.name;
              toolArgs = (toolCall as any).function.arguments;
            }

            // If toolArgs is an object with an 'input' property, extract the input string
            if (typeof toolArgs === 'object' && toolArgs !== null && 'input' in toolArgs) {
              toolArgs = (toolArgs as any).input;
            }

            let toolResult: any = "";
            try {
              if (toolName === "calc") {
                toolResult = await calc.invoke(toolArgs);
              } else if (toolName === "webSearch") {
                toolResult = await webSearch.invoke(toolArgs);
              } else if (toolName === "imageGen") {
                toolResult = await imageGen.invoke(toolArgs);
              } else if (toolName === "newsApi") {
                toolResult = await newsApi.invoke(toolArgs);
              } else if (toolName === "dictionary") {
                toolResult = await dictionary.invoke(toolArgs);
              } else if (toolName === "wikipedia") {
                toolResult = await wikipedia.invoke(toolArgs);
              } else if (toolName === "unitConvert") {
                toolResult = await unitConvert.invoke(toolArgs);
              } else if (toolName === "currencyConvert") {
                toolResult = await currencyConvert.invoke(toolArgs);
              } else if (toolName === "weather") {
                toolResult = await weather.invoke(toolArgs);
              } else if (toolName === "joke") {
                toolResult = await joke.invoke(toolArgs);
              } else if (toolName === "translate") {
                toolResult = await translate.invoke(toolArgs);
              } else if (toolName === "dateTime") {
                toolResult = await dateTime.invoke(toolArgs);
              } else if (toolName === "synonyms") {
                toolResult = await synonyms.invoke(toolArgs);
              } else if (toolName === "fanOn") {
                toolResult = await fanOn.invoke(toolArgs);
              } else if (toolName === "fanOff") {
                toolResult = await fanOff.invoke(toolArgs);
              } else if (toolName === "schedule") {
                toolResult = await schedule.invoke(toolArgs);
              } else {
                toolResult = `Tool ${toolName} not implemented.`;
              }
              // Ensure toolResult is a string
              if (typeof toolResult !== "string") {
                toolResult = toolResult && typeof toolResult === "object" && "content" in toolResult && typeof toolResult.content === "string"
                  ? toolResult.content
                  : JSON.stringify(toolResult);
              }
            } catch (err) {
              toolResult = `Error executing tool: ${err}`;
            }
            toolResults.push({
              role: "tool",
              tool_call_id: id,
              content: toolResult,
            });
          }
          // Add the tool message(s) to the conversation and continue
          currentMessages = [
            ...currentMessages,
            ...toolResults.map(tr => new AIMessage({
              content: tr.content,
              additional_kwargs: { tool_call_id: tr.tool_call_id },
            })),
          ];
          continue; // Loop again
        }
      } else if (lastMsg.content) {
        // Final answer
        fullMsg += lastMsg.content;
        break;
      } else {
        // No content, no tool_calls: break
        break;
      }
    }
    console.log("[nostream] Full message:", fullMsg);
    console.log("[nostream] Returning response with fullMsg:", fullMsg);
    return new Response(fullMsg, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }
} 