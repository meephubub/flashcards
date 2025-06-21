import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const apiDocs = {
    title: "Flashcards API Documentation",
    version: "1.0.0",
    description: "Comprehensive API documentation for the Flashcards application",
    baseUrl: "https://flashcards-api-mhmd.onrender.com",
    endpoints: {
      health: {
        path: "/api/keep-alive",
        method: "GET",
        description: "Health check endpoint that monitors all services",
        response: {
          status: "success | error",
          message: "string",
          db_connected: "boolean",
          image_api_status: "success | error | unknown",
          image_api_error: "string | null",
          text_api_status: "success | error | unknown", 
          text_api_error: "string | null",
          groq_api_status: "success | error | unknown",
          groq_api_error: "string | null",
          timestamp: "ISO string",
          card_count: "number"
        },
        example: {
          status: "success",
          message: "Health check completed",
          db_connected: true,
          image_api_status: "success",
          image_api_error: null,
          text_api_status: "success",
          text_api_error: null,
          groq_api_status: "success", 
          groq_api_error: null,
          timestamp: "2024-01-01T12:00:00.000Z",
          card_count: 42
        }
      },
      textGeneration: {
        path: "https://flashcards-api-mhmd.onrender.com/v1/chat/completions",
        method: "POST",
        description: "Text generation using GPT-4o-mini (primary) with Groq fallback",
        headers: {
          "Content-Type": "application/json"
        },
        body: {
          messages: "array of message objects",
          model: "gpt-4o-mini (primary) | llama-3.3-70b-versatile (fallback)",
          temperature: "number (0.0-3.0)",
          max_tokens: "number",
          top_p: "number (0.0-1.0)",
          presence_penalty: "number (-2.0-2.0)",
          frequency_penalty: "number (-2.0-2.0)"
        },
        example: {
          messages: [
            {
              role: "system",
              content: "You are a helpful assistant."
            },
            {
              role: "user", 
              content: "Hello, this is a test message."
            }
          ],
          model: "gpt-4o-mini",
          temperature: 0.7,
          max_tokens: 1000
        }
      },
      imageGeneration: {
        path: "https://flashcards-api-mhmd.onrender.com/v1/images/generate",
        method: "POST",
        description: "Image generation with multiple model support",
        headers: {
          "Content-Type": "application/json"
        },
        body: {
          prompt: "string (required)",
          model: "flux | turbo | gptimage | together | dall-e-3 | sdxl-1.0 | sdxl-l | sdxl-turbo | sd-3.5-large | flux-pro | flux-dev | flux-schnell | flux-canny | midjourney",
          width: "number (256-2048)",
          height: "number (256-2048)",
          response_format: "url | b64_json",
          image_url: "string (required for flux-canny)"
        },
        example: {
          prompt: "A beautiful sunset over mountains",
          model: "flux-pro",
          width: 1024,
          height: 1024,
          response_format: "url"
        },
        response: {
          url: "string (when response_format is url)",
          data: "array of image objects (when response_format is b64_json)"
        }
      },
      groqFallback: {
        path: "https://api.groq.com/openai/v1/chat/completions",
        method: "POST",
        description: "Groq API fallback for text generation",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer {GROQ_API_KEY}"
        },
        body: {
          messages: "array of message objects",
          model: "llama-3.3-70b-versatile",
          temperature: "number",
          max_tokens: "number"
        }
      },
      deckManagement: {
        decks: {
          path: "/api/decks",
          method: "GET",
          description: "Get all decks for the authenticated user"
        },
        createDeck: {
          path: "/api/decks",
          method: "POST", 
          description: "Create a new deck",
          body: {
            title: "string",
            description: "string (optional)",
            category: "string (optional)"
          }
        },
        getDeck: {
          path: "/api/decks/[id]",
          method: "GET",
          description: "Get a specific deck by ID"
        },
        updateDeck: {
          path: "/api/decks/[id]",
          method: "PUT",
          description: "Update a deck",
          body: {
            title: "string",
            description: "string",
            category: "string"
          }
        },
        deleteDeck: {
          path: "/api/decks/[id]",
          method: "DELETE",
          description: "Delete a deck"
        }
      },
      cardManagement: {
        getCards: {
          path: "/api/decks/[id]/cards",
          method: "GET",
          description: "Get all cards in a deck"
        },
        createCard: {
          path: "/api/decks/[id]/cards",
          method: "POST",
          description: "Create a new card in a deck",
          body: {
            front: "string",
            back: "string",
            image_url: "string (optional)"
          }
        },
        getCard: {
          path: "/api/decks/[id]/cards/[cardId]",
          method: "GET", 
          description: "Get a specific card"
        },
        updateCard: {
          path: "/api/decks/[id]/cards/[cardId]",
          method: "PUT",
          description: "Update a card",
          body: {
            front: "string",
            back: "string",
            image_url: "string (optional)"
          }
        },
        deleteCard: {
          path: "/api/decks/[id]/cards/[cardId]",
          method: "DELETE",
          description: "Delete a card"
        }
      },
      studyProgress: {
        updateProgress: {
          path: "/api/decks/[id]/cards/[cardId]/progress",
          method: "POST",
          description: "Update study progress for a card",
          body: {
            difficulty: "easy | medium | hard",
            confidence: "number (1-5)"
          }
        }
      },
      aiFeatures: {
        generateQuestions: {
          path: "/api/generate",
          method: "POST",
          description: "Generate questions from note content",
          body: {
            content: "string",
            title: "string (optional)",
            numberOfQuestions: "number (default: 3)"
          }
        },
        generateMCQ: {
          path: "/api/generate-mcq",
          method: "POST",
          description: "Generate multiple choice questions",
          body: {
            content: "string",
            numberOfQuestions: "number"
          }
        },
        gradeAnswer: {
          path: "/api/grade-answer",
          method: "POST",
          description: "Grade a user's answer",
          body: {
            question: "string",
            userAnswer: "string",
            correctAnswer: "string"
          }
        },
        aiChat: {
          path: "/api/chat",
          method: "POST",
          description: "AI chat assistant",
          body: {
            message: "string",
            context: "string (optional)"
          }
        },
        aiNotesAssistant: {
          path: "/api/ai-notes-assistant",
          method: "POST",
          description: "AI assistant for note creation",
          body: {
            content: "string",
            action: "summarize | expand | clarify | generate_questions"
          }
        }
      },
      imageSearch: {
        search: {
          path: "/api/image-search",
          method: "POST",
          description: "Search for images",
          body: {
            query: "string",
            limit: "number (optional)"
          }
        },
        health: {
          path: "/api/image-search/health",
          method: "GET",
          description: "Check image search service health"
        }
      },
      import: {
        markdown: {
          path: "/api/import",
          method: "POST",
          description: "Import markdown content",
          body: {
            content: "string",
            deckTitle: "string"
          }
        }
      },
      settings: {
        get: {
          path: "/api/settings",
          method: "GET",
          description: "Get user settings"
        },
        update: {
          path: "/api/settings",
          method: "PUT",
          description: "Update user settings",
          body: {
            theme: "light | dark | system",
            autoPlay: "boolean",
            soundEnabled: "boolean"
          }
        }
      }
    },
    authentication: {
      description: "Most endpoints require authentication via Supabase",
      method: "JWT tokens via cookies",
      required: "User must be logged in for deck/card operations"
    },
    rateLimiting: {
      description: "Rate limiting may apply to AI generation endpoints",
      limits: "Varies by endpoint and user tier"
    },
    errorCodes: {
      "400": "Bad Request - Invalid input data",
      "401": "Unauthorized - Authentication required",
      "403": "Forbidden - Insufficient permissions", 
      "404": "Not Found - Resource not found",
      "429": "Too Many Requests - Rate limit exceeded",
      "500": "Internal Server Error - Server error"
    },
    examples: {
      curl: {
        textGeneration: `curl -X POST "https://flashcards-api-mhmd.onrender.com/v1/chat/completions" \\
  -H "Content-Type: application/json" \\
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "Hello"
      }
    ],
    "model": "gpt-4o-mini"
  }'`,
        imageGeneration: `curl -X POST "https://flashcards-api-mhmd.onrender.com/v1/images/generate" \\
  -H "Content-Type: application/json" \\
  -d '{
    "prompt": "A beautiful sunset",
    "model": "flux-pro",
    "width": 1024,
    "height": 1024,
    "response_format": "url"
  }'`,
        healthCheck: `curl -X GET "https://your-domain.com/api/keep-alive"`
      }
    }
  };

  return NextResponse.json(apiDocs, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache'
    }
  });
} 