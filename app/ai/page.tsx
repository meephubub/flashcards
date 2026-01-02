"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function AiPage() {
  const [prompt, setPrompt] = useState("");
  const [system, setSystem] = useState("You are a helpful assistant for flashcard learning.");
  const [temperature, setTemperature] = useState(0.7);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmed = prompt.trim();
    if (!trimmed) return;

    const userMessage: Message = { role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt: trimmed, system, temperature }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Request failed with ${res.status}`);
      }

      const data = (await res.json()) as { content?: string };
      const content = data.content?.trim() || "(no response)";

      const assistantMessage: Message = { role: "assistant", content };
      setMessages((prev) => [...prev, assistantMessage]);
      setPrompt("");
    } catch (err: any) {
      setError(err?.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-3xl">
        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">Pollinations AI Playground</CardTitle>
            <CardDescription>
              Talk to Pollinations (text) through a secure backend proxy. Use this to
              brainstorm notes, explanations, or flashcards.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="system">
                  System instruction
                </label>
                <Input
                  id="system"
                  value={system}
                  onChange={(e) => setSystem(e.target.value)}
                  placeholder="You are a helpful assistant..."
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="prompt">
                  Prompt
                </label>
                <Textarea
                  id="prompt"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Ask Pollinations anything..."
                  rows={4}
                />
              </div>

              <div className="flex items-center gap-4">
                <div className="flex flex-1 items-center gap-2">
                  <label htmlFor="temperature" className="text-sm font-medium">
                    Temperature
                  </label>
                  <input
                    id="temperature"
                    type="range"
                    min={0}
                    max={2}
                    step={0.1}
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                    className="flex-1"
                  />
                  <span className="w-10 text-right text-xs text-muted-foreground">
                    {temperature.toFixed(1)}
                  </span>
                </div>
                <Button type="submit" disabled={loading}>
                  {loading ? "Thinking..." : "Send"}
                </Button>
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
            </form>

            {messages.length > 0 && (
              <div className="mt-4 space-y-3 rounded-md border border-border/60 bg-muted/40 p-3 text-sm">
                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={
                      m.role === "user"
                        ? "flex justify-end"
                        : "flex justify-start"
                    }
                  >
                    <div
                      className={
                        m.role === "user"
                          ? "max-w-[80%] rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm"
                          : "max-w-[80%] rounded-lg bg-background px-3 py-2 text-sm border border-border/60"
                      }
                    >
                      <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                        {m.role === "user" ? "You" : "Pollinations"}
                      </p>
                      <p className="whitespace-pre-wrap break-words">{m.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
          <CardFooter className="text-xs text-muted-foreground">
            Uses Pollinations text API via /api/ai. Make sure pollinations_key is set on the server.
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}
