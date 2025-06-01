"use client"

import type React from "react"
import { useState, useEffect, useRef, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { createClient } from "@/lib/supabase/client"
import type { Note } from "@/lib/supabase"
import type { MultipleChoiceQuestion, MCQGenerationResult } from "@/lib/groq"
import { NotesSidebar } from "@/components/NotesSidebar"
import { CategoryCombobox } from "@/components/ui/CategoryCombobox";
import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { GenerateFlashcardsDialog } from "@/components/generate-flashcards-dialog"
import { AIAssistantSidebar } from "@/components/ai-assistant-sidebar"
import {
  SparklesIcon,
  PlusCircleIcon,
  SendIcon,
  HelpCircleIcon,
  CheckCircle2,
  XCircle,
  InfoIcon,
  PencilIcon,
  Trash2Icon,
  SearchIcon,
  XIcon,
  Menu,
  FlaskConical
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle as ShadDialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import "katex/dist/katex.min.css"
import katex from "katex"
import { useTheme } from "@/components/theme-provider"

interface McqOption {
  text: string;
  isCorrect: boolean;
  // Add other potential fields if necessary, e.g., explanation?: string;
}
import { ImageSearchDialog } from "@/components/image-search-dialog";

// Helper to generate slugs for IDs
// Keep track of used slugs to avoid duplicates
const usedSlugs = new Map<string, number>();

const generateSlug = (text: string) => {
  console.log(`[SLUG] generateSlug input: '${text}'`);
  let slug = text
    .toLowerCase()
    .replace(/\s+/g, "-") // Replace spaces with -
    .replace(/[^\w-]+/g, ""); // Remove all non-word chars
  
  // If slug is empty, use a fallback
  if (!slug) {
    slug = "section";
  }
  
  // Check if this slug has been used before
  if (usedSlugs.has(slug)) {
    // Increment the counter for this slug
    const count = usedSlugs.get(slug)! + 1;
    usedSlugs.set(slug, count);
    // Append the counter to make the slug unique
    slug = `${slug}-${count}`;
  } else {
    // Reset usedSlugs map when rendering a new note
    usedSlugs.clear();
    console.log('[RENDER] Starting to render note content');
    usedSlugs.set(slug, 1);
  }
  
  console.log(`[SLUG] generateSlug output: '${slug}' for input '${text}'`);
  return slug;
}

// Helper function for inline Markdown parsing
const parseInlineMarkdown = (text: string): React.ReactNode => {
  // Get the current theme
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const mathTextColor = isDark ? "text-white" : "text-black";

  // Process LaTeX math first
  let processedText = text

  // Process display math ($$...$$)
  // Using a workaround for the 's' flag (dotall) which requires ES2018
  // More strict regex to ensure we only match valid math expressions
  processedText = processedText.replace(/\$\$(([\s\S])*?)\$\$/g, (match, p1) => {
    try {
      // Make sure the content doesn't contain Markdown headers or other problematic patterns
      if (p1.includes("#") || p1.includes("---")) {
        return match // Skip rendering if it contains Markdown syntax
      }
      return `<div class="${mathTextColor}">${katex.renderToString(p1, { displayMode: true })}</div>`
    } catch (error) {
      console.error("KaTeX error:", error)
      return match
    }
  })

  // Process inline math ($...$)
  // More precise regex to avoid capturing non-math content
  processedText = processedText.replace(/(?<!\\)\$([^$\n#]+?)(?<!\\)\$/g, (match, p1) => {
    try {
      // Skip if it contains Markdown syntax
      if (p1.includes("#") || p1.includes("---") || p1.includes("!")) {
        return match
      }
      return `<span class="${mathTextColor}">${katex.renderToString(p1, { displayMode: false })}</span>`
    } catch (error) {
      console.error("KaTeX error:", error)
      return match
    }
  })

  // Images: ![alt](url) or ![alt|maxheight=500](url) for custom height
  processedText = processedText.replace(/!\[(.*?)\]\((.*?)\)/g, (match, alt, src) => {
    // Check if alt text contains height specification
    const heightMatch = alt.match(/\|\s*maxheight=(\d+)/)
    let maxHeight = 400 // Default max height
    let cleanAlt = alt

    if (heightMatch) {
      maxHeight = Number.parseInt(heightMatch[1], 10)
      // Remove the height specification from alt text
      cleanAlt = alt.replace(/\|\s*maxheight=\d+/, "").trim()
    }

    return `<img src="${src}" alt="${cleanAlt}" class="max-w-full max-h-[${maxHeight}px] h-auto rounded-md my-2" />`
  })

  // Links: [text](url)
  processedText = processedText.replace(/\[(.*?)\]\((.*?)\)/g, (match, p1, p2) => {
    return `<a class="text-neutral-400 underline hover:text-neutral-300 cursor-pointer transition-colors" href="${p2}" target="_blank" rel="noopener noreferrer">${p1}</a>`
  })

  // Order matters: Process **bold** and *italic* after links and code to avoid conflicts
  // Strikethrough: ~~text~~
  processedText = processedText.replace(/~~(.*?)~~/g, '<del class="text-neutral-500">$1</del>')

  // Bold: **text** or __text__
  processedText = processedText.replace(
    /(?<!\w)\*\*(?!\s)(.*?)(?<!\s)\*\*(?!\w)/g,
    '<strong class="font-bold text-neutral-200">$1</strong>',
  )
  processedText = processedText.replace(
    /(?<!\w)__(?!\s)(.*?)(?<!\s)__(?!\w)/g,
    '<strong class="font-bold text-neutral-200">$1</strong>',
  )

  // Italic: *text* or _text_
  processedText = processedText.replace(
    /(?<!\w)\*(?!\s)(.*?)(?<!\s)\*(?!\w)/g,
    '<em class="italic text-neutral-300">$1</em>',
  )
  processedText = processedText.replace(
    /(?<![a-zA-Z0-9])_(?!\s)(.*?)(?<!\s)_(?![a-zA-Z0-9])/g,
    '<em class="italic text-neutral-300">$1</em>',
  )

  // Highlight: ==text==
  processedText = processedText.replace(/==(.*?)==/g, (match, p1) => {
    return `<span class="highlight-text px-1 rounded">${p1}</span>`
  })

  // Inline Code: `code`
  processedText = processedText.replace(
    /`(.*?)`/g,
    '<code class="bg-neutral-800 text-neutral-200 px-1.5 py-0.5 rounded-md text-sm font-mono">$1</code>',
  )

  return <span dangerouslySetInnerHTML={{ __html: processedText }} />
}

// Enhanced renderNoteContent function
const renderNoteContent = (content: string, mcqStates: Record<string, any>, handleMcqOptionClick: Function, shuffledOptionsStorage?: Record<string, any>) => {
  console.log('[RAW CONTENT]', JSON.stringify(content));
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];

  // State variables for parsing
  let inList = false;
  let currentListItems: string[] = [];
  let currentListType: "ul" | "ol" | null = null;
  
  let inTable = false;
  let currentTableHeaders: string[] = [];
  let currentTableRows: string[][] = [];
  
  let inInfoBox = false;
  let infoBoxContent: string[] = [];
  let infoBoxColor = "";
  
  let inMathBlock = false;
  let mathBlockContent: string[] = [];
  
  let inMcqBlock = false;
  let currentMcqQuestion = "";
  let currentMcqOptions: McqOption[] = [];

  // Process functions
  const processList = () => {
    if (inList && currentListItems.length > 0) {
      if (currentListType === "ul") {
        elements.push(
          <ul key={`list-${elements.length}`} className="list-disc list-outside pl-6 my-3 space-y-1.5 text-neutral-300">
            {currentListItems.map((item, index) => (
              <li key={index}>{parseInlineMarkdown(item)}</li>
            ))}
          </ul>,
        )
      } else if (currentListType === "ol") {
        elements.push(
          <ol
            key={`list-${elements.length}`}
            className="list-decimal list-outside pl-6 my-3 space-y-1.5 text-neutral-300"
          >
            {currentListItems.map((item, index) => (
              <li key={index}>{parseInlineMarkdown(item)}</li>
            ))}
          </ol>,
        )
      }
    }
    inList = false;
    currentListItems = [];
    currentListType = null;
  }

  const processTable = () => {
    // Get the current theme
    const { theme } = useTheme();
    const isDark = theme === "dark";
  
    if (currentTableRows.length > 0) {
      elements.push(
        <div key={`table-${elements.length}`} className="my-4 overflow-x-auto">
          <table className={`min-w-full border-collapse border ${isDark ? 'border-neutral-700' : 'border-gray-300'}`}>
            <thead>
              <tr>
                {currentTableHeaders.map((header, index) => (
                  <th
                    key={index}
                    className={`border px-4 py-2 text-left font-semibold ${isDark 
                      ? 'border-neutral-700 bg-neutral-800 text-neutral-200' 
                      : 'border-gray-300 bg-gray-100 text-gray-800'}`}
                  >
                    {parseInlineMarkdown(header.trim())}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {currentTableRows.map((row, rowIndex) => (
                <tr key={rowIndex} className={isDark 
                  ? (rowIndex % 2 === 0 ? "bg-neutral-900" : "bg-neutral-800/50")
                  : (rowIndex % 2 === 0 ? "bg-white" : "bg-gray-50")}>
                  {row.map((cell: string, cellIndex: number) => (
                    <td
                      key={cellIndex}
                      className={`border px-3 py-2.5 text-sm whitespace-pre-wrap break-words ${isDark 
                        ? 'border-neutral-700 text-neutral-300' 
                        : 'border-gray-300 text-gray-700'}`}
                    >
                      {parseInlineMarkdown(cell.trim())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
    }
    inTable = false;
    currentTableHeaders = [];
    currentTableRows = [];
  };

  const processInfoBox = () => {
    // Get the current theme
    const { theme } = useTheme();
    const isDark = theme === "dark";
  
    if (infoBoxContent.length > 0) {
      // Define color classes for both dark and light modes
      const colorClasses = isDark ? {
        // Dark mode colors
        blue: "bg-blue-900/30 border-blue-700/60",
        purple: "bg-purple-900/30 border-purple-700/60",
        green: "bg-green-900/30 border-green-700/60",
        amber: "bg-amber-900/30 border-amber-700/60",
        rose: "bg-rose-900/30 border-rose-700/60",
      } : {
        // Light mode colors
        blue: "bg-blue-100 border-blue-300",
        purple: "bg-purple-100 border-purple-300",
        green: "bg-green-100 border-green-300",
        amber: "bg-amber-100 border-amber-300",
        rose: "bg-rose-100 border-rose-300",
      };
      
      // Text colors for the info box content
      const textColorClasses = isDark ? {
        blue: "text-blue-200",
        purple: "text-purple-200",
        green: "text-green-200",
        amber: "text-amber-200",
        rose: "text-rose-200",
      } : {
        blue: "text-blue-800",
        purple: "text-purple-800",
        green: "text-green-800",
        amber: "text-amber-800",
        rose: "text-rose-800",
      };

      const colorClass = colorClasses[infoBoxColor as keyof typeof colorClasses] || colorClasses.blue;
      const textColorClass = textColorClasses[infoBoxColor as keyof typeof textColorClasses] || textColorClasses.blue;

      // Create a modified parseInlineMarkdown function that ensures highlighted text has proper contrast
      const parseInfoBoxContent = (text: string) => {
        // Use a custom class for highlighted text in info boxes to ensure proper contrast
        const highlightedText = text.replace(/==(.*?)==/g, (match, p1) => {
          return `<span class="${isDark ? 'text-white' : 'text-black'} font-medium">${p1}</span>`;
        });
        
        // Use the original parseInlineMarkdown for other formatting
        return parseInlineMarkdown(highlightedText);
      };

      elements.push(
        <div key={`infobox-${elements.length}`} className={`my-4 p-4 rounded-lg border ${colorClass}`}>
          {infoBoxContent.map((line, index) => (
            <p key={index} className={`mb-2 last:mb-0 ${textColorClass}`}>
              {parseInfoBoxContent(line)}
            </p>
          ))}
        </div>,
      )
    }
    inInfoBox = false
    infoBoxContent = []
    infoBoxColor = ""
  }

  const processMathBlock = () => {
    // Get the current theme
    const { theme } = useTheme();
    const isDark = theme === "dark";
    const mathTextColor = isDark ? "text-white" : "text-black";
    
    if (mathBlockContent.length > 0) {
      try {
        const mathContent = mathBlockContent.join("\n")

        // Check for Markdown syntax that would cause KaTeX errors
        if (mathContent.includes("#") || mathContent.includes("---") || mathContent.includes("!")) {
          // If problematic content is found, display it as code instead of trying to render as math
          elements.push(
            <div
              key={`math-code-${elements.length}`}
              className="my-4 p-4 bg-neutral-800 border border-neutral-700 rounded-lg"
            >
              <pre className="text-neutral-200 font-mono text-sm overflow-x-auto">{mathContent}</pre>
            </div>,
          )
        } else {
          // Only try to render with KaTeX if content looks like valid math
          const renderedMath = katex.renderToString(mathContent, { displayMode: true })
          elements.push(
            <div
              key={`math-${elements.length}`}
              className={`my-4 overflow-x-auto ${mathTextColor}`}
              dangerouslySetInnerHTML={{ __html: renderedMath }}
            />,
          )
        }
      } catch (error) {
        console.error("KaTeX error:", error)
        elements.push(
          <div
            key={`math-error-${elements.length}`}
            className="my-4 p-4 bg-red-900/30 border border-red-700/60 text-red-200 rounded-lg"
          >
            Error rendering math: {error instanceof Error ? error.message : "Unknown error"}
          </div>,
        )
      }
    }
    inMathBlock = false
    mathBlockContent = []
  }

  // Helper function to shuffle an array (Fisher-Yates shuffle)
  function shuffleArray<T>(array: T[]): T[] {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  }


  const processMcqBlock = () => {
    // Get the current theme
    const { theme } = useTheme();
    const isDark = theme === "dark";
  
    if (currentMcqQuestion && currentMcqOptions.length > 0) {
      console.log(`[PROCESS MCQ] Called for question: '${currentMcqQuestion}', Options count: ${currentMcqOptions.length}`, currentMcqOptions);
      const mcqBlockIdentifier = elements.length.toString(); // Convert to string for consistent key
      const blockKeySlugPart = generateSlug(currentMcqQuestion.substring(0,30));
      const blockKey = `mcq-block-${mcqBlockIdentifier}-${blockKeySlugPart}`;
      const mcqState = mcqStates[blockKey] || { showAnswers: false };

      // Determine where to store shuffled options
      const storage = shuffledOptionsStorage || {};
      
      // Only shuffle the options if they haven't been shuffled before
      if (!storage[blockKey]) {
        storage[blockKey] = shuffleArray(currentMcqOptions);
      }
      const shuffledOptions = storage[blockKey];
      
      elements.push(
        <div key={blockKey} className={`my-6 ${isDark 
          ? 'border border-neutral-700 bg-neutral-800/40 rounded-lg shadow-md p-5' 
          : 'bg-white rounded-lg shadow-md p-6 border border-gray-200'}`}
        >
          <div className="flex items-start mb-5">
            <div className="flex-shrink-0 mr-3">
              <HelpCircleIcon className={`${isDark ? 'text-blue-400' : 'text-blue-500'} flex-shrink-0`} size={20} />
            </div>
            <div className={`font-semibold ${isDark ? 'text-lg text-neutral-100' : 'text-xl text-gray-800'}`}>
              {parseInlineMarkdown(currentMcqQuestion)}
            </div>
          </div>
          
          <div className={`space-y-3 ${isDark ? 'pl-2' : 'pl-3 pr-1'}`}>
            {shuffledOptions.map((option: McqOption, index: number) => {
              const isSelected = mcqState.selectedIndex === index;
              const showCorrect = mcqState.showAnswers && option.isCorrect;
              const showIncorrect = mcqState.showAnswers && isSelected && !option.isCorrect;
              
              // Define styles for both themes
              let optionClassName = '';
              
              if (showCorrect) {
                optionClassName = isDark 
                  ? 'bg-green-900/30 border border-green-700 text-green-100' 
                  : 'bg-green-50 border border-green-200 text-green-700';
              } else if (showIncorrect) {
                optionClassName = isDark 
                  ? 'bg-red-900/30 border border-red-700 text-red-100' 
                  : 'bg-red-50 border border-red-200 text-red-700';
              } else if (isSelected) {
                optionClassName = isDark 
                  ? 'bg-blue-900/30 border border-blue-700 text-blue-100' 
                  : 'bg-blue-50 border border-blue-200 text-blue-700';
              } else {
                optionClassName = isDark 
                  ? 'bg-neutral-800/60 border border-neutral-700/50 text-neutral-300 hover:bg-neutral-700/30' 
                  : 'bg-gray-50 border border-gray-200 text-gray-700 hover:bg-gray-100';
              }
              
              return (
                <div 
                  key={`${blockKey}-option-${index}`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleMcqOptionClick(blockKey, index, option.isCorrect);
                  }}
                  className={`flex items-start transition-all duration-300 cursor-pointer ${optionClassName} ${isDark ? 'p-3 rounded-md' : 'p-3 rounded-md'} ${showCorrect ? 'animate-correct-answer' : showIncorrect ? 'animate-wrong-answer' : isSelected ? 'animate-pulse-once' : ''}`}
                >
                  <div className="flex-shrink-0 mr-3 mt-0.5">
                    {showCorrect ? (
                      <div className="animate-icon-appear">
                        <CheckCircle2 size={isDark ? 18 : 20} className={`${isDark ? 'text-green-500' : 'text-green-600'}`} />
                      </div>
                    ) : showIncorrect ? (
                      <div className="animate-icon-appear">
                        <XCircle size={isDark ? 18 : 20} className={`${isDark ? 'text-red-500' : 'text-red-600'}`} />
                      </div>
                    ) : (
                      <span className={`inline-flex items-center justify-center rounded-full text-xs font-medium ${isDark 
                        ? 'w-5 h-5 border-2 border-neutral-600 text-neutral-400' 
                        : 'w-5 h-5 border border-gray-300 text-gray-500'}`}
                      >
                        {String.fromCharCode(65 + index)}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex-grow">
                    <div className={`${!isDark && 'font-medium'}`}>
                      {parseInlineMarkdown(option.text)}
                    </div>
                    {showCorrect && (
                      <div className={`mt-1 animate-fade-in ${isDark ? 'text-xs text-green-300' : 'text-sm font-medium text-green-600'}`}>
                        Correct answer!
                      </div>
                    )}
                    {showIncorrect && (
                      <div className={`mt-1 animate-fade-in ${isDark ? 'text-xs text-red-300' : 'text-sm font-medium text-red-600'}`}>
                        Incorrect - try again!
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          
          {mcqState.showAnswers && (
            <div className={`mt-5 ${isDark ? 'text-sm text-neutral-400' : 'text-sm font-medium text-gray-500 text-center'}`}>
              Click any option to try again
            </div>
          )}
        </div>
      );
    }
    inMcqBlock = false;
    currentMcqQuestion = "";
    currentMcqOptions = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Check for headings (# Heading 1, ## Heading 2, ### Heading 3)
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/)
    if (headingMatch) {
      processList() // Process any existing list
      processTable() // Process any existing table
      processInfoBox() // Process any existing info box
      if (inMcqBlock) processMcqBlock() // Process any existing MCQ block

      const level = headingMatch[1].length
      const headingText = headingMatch[2].trim()
      const headingId = generateSlug(headingText)
      console.log(`[HEADING] Rendering heading: '${headingText}' with ID '${headingId}' and level ${level}`)

      // Create appropriate heading element based on level
      if (level === 1) {
        elements.push(
          <h1 
            id={headingId}
            key={`heading-${i}`} 
            className="text-3xl font-bold text-neutral-100 mt-8 mb-4"
          >
            {parseInlineMarkdown(headingText)}
          </h1>
        )
      } else if (level === 2) {
        elements.push(
          <h2 
            id={headingId}
            key={`heading-${i}`} 
            className="text-2xl font-semibold text-neutral-200 mt-6 mb-3"
          >
            {parseInlineMarkdown(headingText)}
          </h2>
        )
      } else if (level === 3) {
        elements.push(
          <h3 
            id={headingId}
            key={`heading-${i}`} 
            className="text-xl font-medium text-neutral-300 mt-5 mb-2"
          >
            {parseInlineMarkdown(headingText)}
          </h3>
        )
      } else if (level === 4) {
        elements.push(
          <h4 
            id={headingId}
            key={`heading-${i}`} 
            className="text-lg font-medium text-neutral-300 mt-4 mb-2"
          >
            {parseInlineMarkdown(headingText)}
          </h4>
        )
      } else {
        elements.push(
          <h5 
            id={headingId}
            key={`heading-${i}`} 
            className="text-base font-medium text-neutral-300 mt-3 mb-2"
          >
            {parseInlineMarkdown(headingText)}
          </h5>
        )
      }
      continue
    }

    // Check for math block start
    if (line.trim() === "$$") {
      processList() // Process any existing list
      processTable() // Process any existing table
      processInfoBox() // Process any existing info box
      inMathBlock = true
      continue
    }

    // Check for math block end
    if (line.trim() === "$$" && inMathBlock) {
      processMathBlock()
      continue
    }

    // If in math block, collect content
    if (inMathBlock) {
      mathBlockContent.push(line)
      continue
    }

    // Check for info box start
    const infoBoxMatch = line.match(/^::(blue|purple|green|amber|rose)\s*$/)
    if (infoBoxMatch) {
      processList() // Process any existing list
      processTable() // Process any existing table
      inInfoBox = true
      infoBoxColor = infoBoxMatch[1]
      continue
    }

    // Check for info box end
    if (line.trim() === "::" && inInfoBox) {
      processInfoBox()
      continue
    }

    // If in info box, collect content
    if (inInfoBox) {
      infoBoxContent.push(line)
      continue
    }

    // Check for table
    if (line.includes("|")) {
      const cells = line.split("|").filter((cell) => cell.trim() !== "")

      // Check if this is a separator line (contains only dashes and |)
      if (line.replace(/[\s|]/g, "").replace(/-/g, "") === "") {
        continue // Skip separator line
      }

      if (!inTable) {
        inTable = true
        currentTableHeaders = cells // FIX: Was tableHeaders
      } else {
        currentTableRows.push(cells) // FIX: Was tableRows
      }
      continue
    } else if (inTable) {
      processTable()
    }

    // Check for line break (---)
    if (line.trim() === "---") {
      elements.push(<hr key={i} className="my-8 border-neutral-700/50" />)
      continue
    }

    // Check for MCQ block
    if (line.startsWith("?? ")) {
      console.log(`[MCQ PARSE] Detected question line: '${line}'`);
      // Finalize any PENDING MCQ block first.
      if (inMcqBlock) {
        processMcqBlock();
      }
      // Then finalize other block types that might be pending.
      processList();
      processTable();
      processInfoBox();
      processMathBlock();
      // (Ensure all other block types that can be 'pending' are processed here too)

      inMcqBlock = true; // Now, set up for the NEW MCQ block
      currentMcqQuestion = line.substring(3).trim(); // Get text after "?? "
      console.log(`[MCQ PARSE] Set currentMcqQuestion: '${currentMcqQuestion}'`);
      currentMcqOptions = []; // Reset options for the new question
      continue; // Consumed line, move to next line
    }

    // If currently in an MCQ block, process options
    if (inMcqBlock) {
      console.log(`[MCQ PARSE] In MCQ block (question: '${currentMcqQuestion}'), checking line for option: '${line}'`);
      // Match both formats: '* [ ] Option' and '[ ] Option'
      const optionMatch = line.match(/^(?:[-*]\s*)?\s*\[(x|X| )\]\s+(.*)/i); // matches:
      // '* [x] Option'
      // '- [ ] Option'
      // '[X] Option'
      // Case insensitive for x/X
      if (optionMatch) {
        const option = {
          text: optionMatch[2].trim(),
          isCorrect: optionMatch[1].toLowerCase() === "x",
        };
        currentMcqOptions.push(option);
        console.log(`[MCQ PARSE] Added option to '${currentMcqQuestion}':`, option, `Current options count: ${currentMcqOptions.length}`);
        continue; // Consumed line, move to next line
      } else {
        // Line is not an option, so current MCQ block ends.
        // Process the collected MCQ.
        console.log(`[MCQ PARSE] End of MCQ block detected (non-option line '${line}'). Processing MCQ for question: '${currentMcqQuestion}'`);
        processMcqBlock();
        // The current line was NOT consumed by MCQ option logic,
        // so it will fall through to be processed by existing rules (e.g., as a paragraph).
        // DO NOT 'continue' here. The current line needs to be re-evaluated by subsequent rules.
      }
    }

    // Default: Paragraph (or empty line for spacing)
    if (line.trim() === "") {
      elements.push(<div key={i} className="h-4"></div>) // Create some space for empty lines
    } else {
      elements.push(
        <p key={i} className="text-neutral-300 leading-relaxed my-3">
          {parseInlineMarkdown(line)}
        </p>,
      )
    }
  }
  processList() // Process any remaining list items after the loop
  processTable() // Process any remaining table after the loop
  processInfoBox()
  processMathBlock()
  if (inMcqBlock || (currentMcqQuestion && currentMcqOptions.length > 0)) { // Only log if there's something to process
    console.log(`[RENDER END] Processing any final MCQ block. Current Question: '${currentMcqQuestion}', Options: ${currentMcqOptions.length}`);
  }
  processMcqBlock(); // Add this line

  return <>{elements}</> // Return a fragment
}

export default function NotesPage() {
  const { session, user, isLoading: authIsLoading, error: authError, signOut } = useAuth();
  const router = useRouter();
  const supabase = createClient();
  const { theme, setTheme } = useTheme();
  const [allNotes, setAllNotes] = useState<Note[]>([]);
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [displayedNotes, setDisplayedNotes] = useState<Note[]>([]);
  const [subheadings, setSubheadings] = useState<string[]>([]);
  const [currentNoteHeadings, setCurrentNoteHeadings] = useState<{ text: string; level: number }[]>([]);
  const [availableCategories, setAvailableCategories] = useState<string[]>([])
  const [highlightedText, setHighlightedText] = useState<string>("")
  const [searchQuery, setSearchQuery] = useState<string>("")
  
  // Persistent storage for shuffled MCQ options that survives re-renders
  const shuffledMcqOptionsRef = useRef<Record<string, any>>({})

  const [newNote, setNewNote] = useState({
    title: "",
    content: "",
    category: "", // Default category to empty, user must select or create
  })

  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const [selectedSidebarCategory, setSelectedSidebarCategory] = useState("all")
  const [focusedNoteId, setFocusedNoteId] = useState<string | null>(null)
  const [generationTopic, setGenerationTopic] = useState<string>("")
  
  // Move all hooks that were after the conditional returns to here
  const [isGeneratingNote, setIsGeneratingNote] = useState<boolean>(false)
  const [isAddNoteDialogOpen, setIsAddNoteDialogOpen] = useState<boolean>(false)
  const [isAiChatDialogOpen, setIsAiChatDialogOpen] = useState<boolean>(false)
  const [selectedText, setSelectedText] = useState<string>("")
  const [aiPrompt, setAiPrompt] = useState<string>("")
  const [aiResponse, setAiResponse] = useState<string>("")
  const [isProcessingAiRequest, setIsProcessingAiRequest] = useState<boolean>(false)
  const [isMcqDialogOpen, setIsMcqDialogOpen] = useState<boolean>(false)
  const [generatedMcqs, setGeneratedMcqs] = useState<MultipleChoiceQuestion[]>([])
  const [isGeneratingMcqs, setIsGeneratingMcqs] = useState<boolean>(false)
  const [mcqError, setMcqError] = useState<string | null>(null)
  const [currentMcqNoteTitle, setCurrentMcqNoteTitle] = useState<string | undefined>(undefined)
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({})
  const [showMcqResults, setShowMcqResults] = useState<boolean>(false)
  const [isEditNoteDialogOpen, setIsEditNoteDialogOpen] = useState<boolean>(false)
  const [isAiAssistantOpen, setIsAiAssistantOpen] = useState<boolean>(false)
  const [editingNote, setEditingNote] = useState<Note | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState<boolean>(false)
  const [noteToDelete, setNoteToDelete] = useState<Note | null>(null)
  const [isFlashcardsDialogOpen, setIsFlashcardsDialogOpen] = useState(false)
  const [noteForFlashcards, setNoteForFlashcards] = useState<Note | null>(null)
  const [isGeneratingFlashcards, setIsGeneratingFlashcards] = useState(false);

  // State for Image Search
  const [isImageSearchDialogOpen, setIsImageSearchDialogOpen] = useState<boolean>(false);
  const [imageSearchQuery, setImageSearchQuery] = useState<string>("");
  const [imageSearchResults, setImageSearchResults] = useState<string[]>([]);
  const [isLoadingImages, setIsLoadingImages] = useState<boolean>(false);
  const [imageSearchError, setImageSearchError] = useState<string | null>(null);
  const [activeEditorContext, setActiveEditorContext] = useState<{
    type: 'newNote' | 'editNote';
    originalTag: string; // The full "!(img)[query]" tag
    // We'll use newNote.content or editingNote.content directly for current content
    // and setNewNote or setEditingNote for updates.
  } | null>(null);

  const [mcqStates, setMcqStates] = useState<Record<string, {selectedIndex?: number, showAnswers: boolean}>>({});

  // Protect route - redirect to login if not authenticated
  useEffect(() => {
    if (!authIsLoading && !session) {
      router.push('/');
    }
  }, [session, authIsLoading, router]);

  // Show loading spinner while authentication state is being determined
  if (authIsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black/5">
        <div className="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Show redirect message if not authenticated
  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Redirecting to login...</p>
      </div>
    );
  }

  const handleMcqOptionClick = (blockId: string, optionIndex: number, isCorrect: boolean) => {
    console.log(`[MCQ CLICK] blockId: ${blockId}, optionIndex: ${optionIndex}, isCorrect: ${isCorrect}`);
    setMcqStates(prev => {
      const newState = {
        ...prev,
        [blockId]: {
          selectedIndex: optionIndex,
          showAnswers: true
        }
      };
      console.log('[MCQ CLICK] New state:', newState);
      return newState;
    });
  };

  const notesContainerRef = useRef<HTMLDivElement>(null)
  const activeNoteRef = useRef<HTMLDivElement>(null)

  // Fetch notes when authenticated
  useEffect(() => {
    if (session) {
      fetchNotes();
    }
  }, [session])

  const IMAGE_TAG_REGEX = /!\(img\)\[([^\]]+)\]$/;

  // Effect to fetch images when dialog is opened and query is set
    // THIS useEffect WILL LIKELY NEED TO BE REVISITED OR REMOVED IF IT HANDLES AUTH
  useEffect(() => {
    if (isImageSearchDialogOpen && imageSearchQuery) {
      const fetchImages = async () => {
        setIsLoadingImages(true);
        setImageSearchError(null);
        setImageSearchResults([]);
        try {
          const response = await fetch(`/api/image-search?query=${encodeURIComponent(imageSearchQuery)}`);
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: `Failed to fetch images: ${response.status}` }));
            throw new Error(errorData.error || `Failed to fetch images: ${response.status}`);
          }
          const data = await response.json();
          setImageSearchResults(data.images || []);
          if ((data.images || []).length === 0) {
            // This case is handled by the dialog itself, but good to be aware of
            // setImageSearchError(`No images found for "${imageSearchQuery}".`); 
          }
        } catch (err: any) {
          console.error("Image search fetch error:", err);
          setImageSearchError(err.message || "An unknown error occurred while searching for images.");
        } finally {
          setIsLoadingImages(false);
        }
      };
      fetchImages();
    }
  }, [isImageSearchDialogOpen, imageSearchQuery]);

  const handleImageSearchTrigger = (
    currentTextValue: string, 
    newTextValue: string,
    contextType: 'newNote' | 'editNote'
  ) => {
    const match = newTextValue.match(IMAGE_TAG_REGEX);
    if (match && match[1]) {
      const query = match[1];
      const originalTag = match[0];
      
      // Update content specific to context immediately (before opening dialog)
      if (contextType === 'newNote') {
        setNewNote(prev => ({ ...prev, content: newTextValue }));
      } else if (contextType === 'editNote') {
        setEditingNote(prev => prev ? ({ ...prev, content: newTextValue }) : null);
      }

      setActiveEditorContext({
        type: contextType,
        originalTag: originalTag,
      });
      setImageSearchQuery(query); // This will trigger the useEffect above to fetch images
      setIsImageSearchDialogOpen(true);
      return true; // Indicates that the image search was triggered
    }
    return false; // Indicates no image search trigger
  };

  const handleImageSelectedFromDialog = (imageUrl: string) => {
    if (activeEditorContext) {
      let currentTextareaContent = "";
      if (activeEditorContext.type === 'newNote') {
        currentTextareaContent = newNote.content;
      } else if (activeEditorContext.type === 'editNote' && editingNote) {
        currentTextareaContent = editingNote.content;
      }
      
      const updatedContent = currentTextareaContent.replace(
        activeEditorContext.originalTag,
        `![${imageSearchQuery}](${imageUrl})`
      );

      if (activeEditorContext.type === 'newNote') {
        setNewNote(prev => ({ ...prev, content: updatedContent }));
      } else if (activeEditorContext.type === 'editNote') {
        setEditingNote(prev => prev ? { ...prev, content: updatedContent } : null);
      }
    }
    closeImageSearchDialog();
  };

  const closeImageSearchDialog = () => {
    setIsImageSearchDialogOpen(false);
    // Keep imageSearchQuery for the dialog title while it closes, then clear if needed
    // setImageSearchQuery(""); 
    setImageSearchResults([]);
    setImageSearchError(null);
    setActiveEditorContext(null);
    setIsLoadingImages(false); // Ensure loading is reset
  };

  // Derive available categories from all notes
    // THIS useEffect WILL LIKELY NEED TO BE REVISITED OR REMOVED IF IT HANDLES AUTH
  useEffect(() => {
    const categoriesFromNotes = Array.from(
      new Set(allNotes.map((note) => note.category.trim().toLowerCase()).filter((cat) => cat)),
    )
    categoriesFromNotes.sort((a, b) => a.localeCompare(b))
    setAvailableCategories(categoriesFromNotes)
    // If current newNote.category is not in the fetched notes and not empty, add it to available for consistency
    // Or, more simply, let the Combobox handle new typed values directly.
  }, [allNotes])

    // THIS useEffect WILL LIKELY NEED TO BE REVISITED OR REMOVED IF IT HANDLES AUTH
  useEffect(() => {
    let notesToDisplay = allNotes
    
    // First filter by category
    if (selectedSidebarCategory !== "all") {
      notesToDisplay = allNotes.filter((note) => note.category === selectedSidebarCategory)
    }
    
    // Then filter by search query if it exists
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      notesToDisplay = notesToDisplay.filter((note) => 
        note.title.toLowerCase().includes(query) || 
        note.content.toLowerCase().includes(query)
      )
    }
    
    // Handle focused note
    if (focusedNoteId) {
      const focused = notesToDisplay.find((note) => note.id === focusedNoteId)
      setDisplayedNotes(focused ? [focused] : [])

      // Extract headings from the focused note
      if (focused) {
        extractHeadingsFromNote(focused)
      } else {
        setCurrentNoteHeadings([])
      }
    } else {
      setDisplayedNotes(notesToDisplay)
      setCurrentNoteHeadings([])
    }
  }, [allNotes, selectedSidebarCategory, focusedNoteId, searchQuery])

    // THIS useEffect WILL LIKELY NEED TO BE REVISITED OR REMOVED IF IT HANDLES AUTH
  useEffect(() => {
    const extracted: string[] = []
    allNotes.forEach((note) => {
      const lines = note.content.split("\n")
      lines.forEach((line) => {
        // Updated to use H2 from the new renderNoteContent logic for consistency
        if (line.match(/^##\s+(.*)/)) {
          const heading = line.match(/^##\s+(.*)/)![1].trim()
          if (heading && !extracted.includes(heading)) {
            extracted.push(heading)
          }
        }
      })
    })
    extracted.sort((a, b) => a.localeCompare(b))
    setSubheadings(extracted)
  }, [allNotes])

    // THIS useEffect WILL LIKELY NEED TO BE REVISITED OR REMOVED IF IT HANDLES AUTH
  useEffect(() => {
    if (focusedNoteId && activeNoteRef.current) {
      activeNoteRef.current.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }, [focusedNoteId, displayedNotes])

const fetchNotes = async () => {
  setIsLoading(true)
  try {
    // User is already authenticated through useAuth()
    if (!user) {
      setErrorMessage("You must be logged in to view notes")
      setAllNotes([])
      return
    }

    // Fetch notes only for the current user
    const { data, error } = await supabase
      .from("notes")
      .select("*")
      .eq("user_id", user.id) // Filter by user ID
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Supabase error fetching notes:", error)
      setErrorMessage(`Error fetching notes: ${error.message}`)
      throw error
    }
    if (data) {
      setAllNotes(data as Note[])
      setErrorMessage(null)
    }
  } catch (error) {
    // Error message already set or logged
  } finally {
    setIsLoading(false)
  }
}

  // State for inline editing
  const [inlineEditingNoteId, setInlineEditingNoteId] = useState<string | null>(null)
  const [inlineEditContent, setInlineEditContent] = useState<string>("")
  const inlineEditRef = useRef<HTMLTextAreaElement>(null)

  // Handle saving inline edits
  const handleSaveInlineEdit = useCallback(async () => {
    if (!inlineEditingNoteId || !inlineEditContent) {
      setErrorMessage("Cannot save empty content or no note selected for inline edit.");
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("notes")
        .update({ content: inlineEditContent, updated_at: new Date().toISOString() })
        .eq("id", inlineEditingNoteId);

      if (error) {
        console.error("Error updating note:", error);
        setErrorMessage(`Error updating note: ${error.message}`);
        // Potentially throw error to be caught by the outer catch if needed for more complex scenarios
      } else {
        setErrorMessage("Note updated successfully!");
        setTimeout(() => setErrorMessage(null), 2000);
        
        // Update local state immediately for responsiveness
        const updateNotesState = (prevNotes: Note[]) => prevNotes.map(note => 
          note.id === inlineEditingNoteId 
            ? { ...note, content: inlineEditContent, updated_at: new Date().toISOString() } 
            : note
        );
        setAllNotes(updateNotesState);
        setDisplayedNotes(updateNotesState); // Assuming displayedNotes should also reflect this change

        setInlineEditingNoteId(null); // Clear editing state
        // Optionally, call fetchNotes() if there's a need to re-sync completely from DB,
        // but optimistic update above should suffice for UI.
        // await fetchNotes(); 
      }
    } catch (error: any) {
      console.error("Outer catch - Error updating note:", error);
      setErrorMessage(`Failed to update note: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [inlineEditingNoteId, inlineEditContent, supabase, fetchNotes, setIsLoading, setErrorMessage, setAllNotes, setDisplayedNotes, setInlineEditingNoteId]);

  // Handle text selection and Ctrl+K, Ctrl+B, and Ctrl+E
    // THIS useEffect WILL LIKELY NEED TO BE REVISITED OR REMOVED IF IT HANDLES AUTH
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey) {
        if (e.key === "k") {
          e.preventDefault()
          const selection = window.getSelection()
          if (selection && selection.toString().trim()) {
            setSelectedText(selection.toString().trim())
            setAiPrompt("")
            setAiResponse("")
            setIsAiChatDialogOpen(true)
          }
        } else if (e.key === "b") {
          e.preventDefault()
          const selection = window.getSelection()
          if (selection && selection.toString().trim()) {
            const range = selection.getRangeAt(0)

            const ancestorNode = range.commonAncestorContainer
            const parentElementForClosest =
              ancestorNode.nodeType === Node.ELEMENT_NODE ? (ancestorNode as Element) : ancestorNode.parentElement
            const noteElement = parentElementForClosest?.closest('[id^="note-"]')

            if (noteElement) {
              const noteId = noteElement.id.replace("note-", "")
              const note = allNotes.find((n) => n.id === noteId)
              if (note) {
                const selectedText = selection.toString().trim()

                if (!selectedText) {
                  return // No text selected
                }

                // Helper to escape regex special characters
                const escapeRegExp = (string: string) => string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

                const highlightedVersion = `==${selectedText}==`
                const noteContent = note.content
                let updatedContent: string | undefined = undefined

                // Find the exact position of the selected text in the original content
                // We need to determine if we're dealing with a highlighted or plain text
                const isHighlighted = noteContent.includes(highlightedVersion)

                if (isHighlighted) {
                  // We're unhighlighting text
                  // Find the highlighted version in the content
                  const highlightedPattern = `==${selectedText}==`

                  // Replace only the first occurrence of the highlighted pattern
                  const firstIndex = noteContent.indexOf(highlightedPattern)
                  if (firstIndex !== -1) {
                    updatedContent =
                      noteContent.substring(0, firstIndex) +
                      selectedText +
                      noteContent.substring(firstIndex + highlightedPattern.length)
                  }
                } else {
                  // We're highlighting plain text
                  // Find the plain text in the content
                  const plainTextIndex = noteContent.indexOf(selectedText)
                  if (plainTextIndex !== -1) {
                    updatedContent =
                      noteContent.substring(0, plainTextIndex) +
                      highlightedVersion +
                      noteContent.substring(plainTextIndex + selectedText.length)
                  } else {
                    console.warn("Text to highlight not found in note content:", selectedText)
                    return
                  }
                }

                // Only update if content actually changed
                if (updatedContent === undefined || updatedContent === note.content) {
                  console.warn("Highlight toggle resulted in no change to content.")
                  return
                }

                // Update the note in Supabase
                supabase
                  .from("notes")
                  .update({ content: updatedContent })
                  .eq("id", noteId)
                  .then(() => {
                    // Refresh notes after update
                    fetchNotes()
                  })
              }
            }
          }
        } else if (e.key === "e") {
          e.preventDefault()

          // Ctrl+E without any additional modifiers toggles the AI Assistant
          if (!e.shiftKey && !e.altKey && !e.metaKey) {
            // Toggle AI Assistant
            setIsAiAssistantOpen(prev => !prev)
            return
          }
          
          // If already in edit mode, save the changes
          if (inlineEditingNoteId) {
            handleSaveInlineEdit()
            return
          }

          // Determine which note to edit
          let targetNoteId: string | null = null

          // 1. Try from selection first - this is most precise
          const selection = window.getSelection()
          if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0)
            const ancestorNode = range.commonAncestorContainer
            const parentElement =
              ancestorNode.nodeType === Node.ELEMENT_NODE ? (ancestorNode as Element) : ancestorNode.parentElement

            // Look for either note-content-X or note-X elements
            const noteContentElement = parentElement?.closest<HTMLElement>('[id^="note-content-"]')
            if (noteContentElement) {
              targetNoteId = noteContentElement.id.replace("note-content-", "")
            } else {
              const noteElement = parentElement?.closest<HTMLElement>('[id^="note-"]')
              if (noteElement) {
                targetNoteId = noteElement.id.replace("note-", "")
              }
            }
          }

          // 2. If no note from selection, try from active element
          if (!targetNoteId && document.activeElement) {
            const noteContentElement = document.activeElement.closest<HTMLElement>('[id^="note-content-"]')
            if (noteContentElement) {
              targetNoteId = noteContentElement.id.replace("note-content-", "")
            } else {
              const noteElement = document.activeElement.closest<HTMLElement>('[id^="note-"]')
              if (noteElement) {
                targetNoteId = noteElement.id.replace("note-", "")
              }
            }
          }

          // 3. If still no note, use focusedNoteId (if a note is uniquely displayed)
          if (!targetNoteId && focusedNoteId) {
            targetNoteId = focusedNoteId
          }

          // If a note was found, prepare it for editing
          if (targetNoteId) {
            const noteToEdit = allNotes.find((n) => n.id === targetNoteId)
            if (noteToEdit) {
              setInlineEditingNoteId(targetNoteId)
              setInlineEditContent(noteToEdit.content)

              // Focus the textarea after it's rendered
              setTimeout(() => {
                if (inlineEditRef.current) {
                  inlineEditRef.current.focus()
                }
              }, 50)
            }
          }
        }
      } else if (e.key === "Escape" && inlineEditingNoteId) {
        // Cancel inline editing on Escape key
        setInlineEditingNoteId(null)
      } else if (e.key === "Enter" && e.ctrlKey && inlineEditingNoteId) {
        // Save changes on Ctrl+Enter
        handleSaveInlineEdit()
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [allNotes, inlineEditingNoteId, handleSaveInlineEdit])

  // Apply text selection styles
    // THIS useEffect WILL LIKELY NEED TO BE REVISITED OR REMOVED IF IT HANDLES AUTH
  useEffect(() => {
    // Create a style element
    const styleElement = document.createElement("style")
    styleElement.textContent = `
      ::-moz-selection {
        background: rgba(140, 140, 140, 0.4) !important;
        color: inherit !important;
      }
      ::selection {
        background: rgba(140, 140, 140, 0.4) !important;
        color: inherit !important;
      }
    `
    // Append to head
    document.head.appendChild(styleElement)

    // Cleanup function
    return () => {
      document.head.removeChild(styleElement)
    }
  }, [])

    // THIS useEffect WILL LIKELY NEED TO BE REVISITED OR REMOVED IF IT HANDLES AUTH
  useEffect(() => {
    // Create a style element
    const styleElement = document.createElement("style")
    styleElement.textContent = `
    ::-moz-selection {
      background: ${theme === "dark" ? "rgba(140, 140, 140, 0.4)" : "rgba(140, 140, 140, 0.4)"} !important;
      color: inherit !important;
    }
    ::selection {
      background: ${theme === "dark" ? "rgba(140, 140, 140, 0.4)" : "rgba(140, 140, 140, 0.4)"} !important;
      color: inherit !important;
    }
    .highlight-text {
      background: ${theme === "dark" ? "rgba(140, 140, 140, 0.4)" : "rgba(34, 197, 94, 0.3)"} !important;
      color: ${theme === "dark" ? "#e5e5e5" : "#166534"} !important;
      font-weight: ${theme === "light" ? "500" : "normal"} !important;
    }
    html.light {
      background-color: #f8fafc;
      color: #1e293b;
    }
    html.light .bg-neutral-900 {
      background-color: #ffffff;
    }
    html.light .bg-neutral-800 {
      background-color: #f1f5f9;
    }
    html.light .border-neutral-800 {
      border-color: #e2e8f0;
    }
    html.light .border-neutral-700 {
      border-color: #cbd5e1;
    }
    html.light .text-neutral-100 {
      color: #0f172a;
    }
    html.light .text-neutral-200 {
      color: #1e293b;
    }
    html.light .text-neutral-300 {
      color: #334155;
    }
    html.light .text-neutral-400 {
      color: #475569;
    }
    html.light .text-neutral-500 {
      color: #64748b;
    }
    html.light .bg-neutral-950 {
      background-color: #f8fafc;
    }
  `
    // Append to head
    document.head.appendChild(styleElement)

    // Cleanup function
    return () => {
      document.head.removeChild(styleElement)
    }
  }, [theme])



  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!newNote.title || !newNote.content) {
      setErrorMessage("Title and content are required.");
      return;
    }
    if (!newNote.category.trim()) {
      setErrorMessage("Category is required. Please select or create one.");
      return;
    }

    setIsLoading(true);
    try {
      // Get the current user
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setErrorMessage("You must be logged in to add a note.");
        setIsLoading(false);
        // Optionally, redirect to login: router.push('/login');
        return;
      }

      const noteToInsert = {
        title: newNote.title,
        content: newNote.content,
        category: newNote.category.trim().toLowerCase(),
        user_id: user.id, // Add the user_id here
      };

      const { data, error } = await supabase.from("notes").insert(noteToInsert).select().single();

      if (error) {
        console.error("Supabase error adding note:", error);
        setErrorMessage(`Error adding note: ${error.message}`);
        throw error;
      }

      setNewNote({ title: "", content: "", category: "" });
      await fetchNotes(); // Refresh all notes
      if (data) {
        if (selectedSidebarCategory === "all" || data.category === selectedSidebarCategory) {
          setFocusedNoteId(data.id);
        }
      }
    } catch (error: any) {
      // Error message already set or caught by general try-catch
      if (!errorMessage) { // Ensure an error message is set if not already
        setErrorMessage(error.message || "An unexpected error occurred.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleNoteSelectInSidebar = (noteId: string) => {
    setFocusedNoteId(noteId)
  }

  const handleCategorySelectFromSidebar = (category: string) => {
    setSelectedSidebarCategory(category)
    setFocusedNoteId(null)
  }

  const handleSubheadingClick = (subheading: string) => {
    const targetNote = allNotes.find((note) => {
      const lines = note.content.split("\n")
      // Updated to use H2 from the new renderNoteContent logic for consistency
      return lines.some((line) => line.match(/^##\s+(.*)/) && line.match(/^##\s+(.*)/)![1].trim() === subheading)
    })
    if (targetNote) {
      if (selectedSidebarCategory !== "all" && targetNote.category !== selectedSidebarCategory) {
        setSelectedSidebarCategory("all")
      }
      setFocusedNoteId(targetNote.id)
    }
  }

  const clearFocus = () => {
    setFocusedNoteId(null)
  }

  // Search function
  const handleSearch = (query: string) => {
    setSearchQuery(query)
    // Clear focus when searching to show all matching results
    if (query.trim()) {
      setFocusedNoteId(null)
    }
  }

  // Clear search
  const clearSearch = () => {
    setSearchQuery("")
  }

  const handleGenerateNote = async () => {
    if (!generationTopic.trim()) {
      setErrorMessage("Please enter a topic to generate the note.")
      return
    }
    setIsGeneratingNote(true)
    setErrorMessage(null)
    try {
      const response = await fetch("/api/generate-note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: generationTopic }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.details || "Failed to generate note from API.")
      }

      const data = await response.json()
      setNewNote({ title: data.title, content: data.content, category: newNote.category || "" })
      setGenerationTopic("") // Clear topic input after generation
      setErrorMessage(null)
    } catch (error: any) {
      console.error("Error generating note via API:", error)
      setErrorMessage(error.message || "An unexpected error occurred while generating the note.")
      // Optionally, clear title/content if generation fails badly
      // setNewNote({ title: "", content: "", category: newNote.category || "" });
    } finally {
      setIsGeneratingNote(false)
    }
  }

  const handleSuccessfulNoteAdd = () => {
    setIsAddNoteDialogOpen(false)
  }

  // Extract headings from a note
  const extractHeadingsFromNote = (note: Note) => {
    const headings: { text: string; level: number }[] = []
    const lines = note.content.split("\n")

    lines.forEach((line) => {
      const headingMatch = line.match(/^(#{1,6})\s+(.*)/)
      if (headingMatch) {
        const level = headingMatch[1].length
        const text = headingMatch[2].trim()
        headings.push({ text, level })
      }
    })

    setCurrentNoteHeadings(headings)
  }

  // Handle AI chat request
  const handleAiChatRequest = async () => {
    if (!aiPrompt.trim() && !selectedText.trim()) return

    setIsProcessingAiRequest(true)
    try {
      const prompt = aiPrompt.trim()
        ? `Selected text: "${selectedText}"\n\nUser query: ${aiPrompt}`
        : `Analyze or explain this text: "${selectedText}"`

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      })

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`)
      }

      const data = await response.json()
      setAiResponse(data.response || "I couldn't generate a response. Please try again.")
    } catch (error) {
      console.error("Error in AI chat request:", error)
      setAiResponse("Sorry, there was an error processing your request. Please try again later.")
    } finally {
      setIsProcessingAiRequest(false)
    }
  }

  const handleGenerateMcqs = async () => {
    if (!focusedNoteId) {
      setMcqError("Please select a note to generate MCQs from.")
      return
    }
    const noteToGenerateFrom = allNotes.find((note) => note.id === focusedNoteId)
    if (!noteToGenerateFrom) {
      setMcqError("Focused note not found.")
      return
    }

    setIsGeneratingMcqs(true)
    setMcqError(null)
    setGeneratedMcqs([])
    setUserAnswers({})
    setShowMcqResults(false)
    setCurrentMcqNoteTitle(noteToGenerateFrom.title)

    try {
      const response = await fetch("/api/generate-mcq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          noteContent: noteToGenerateFrom.content,
          noteTitle: noteToGenerateFrom.title,
          numberOfQuestions: 5, // Or make this configurable
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to generate MCQs from API.")
      }

      const data: MCQGenerationResult = await response.json()
      if (data.mcqs && data.mcqs.length > 0) {
        setGeneratedMcqs(data.mcqs)
        setIsMcqDialogOpen(true)
      } else {
        setMcqError("No MCQs were generated for this note. The content might be too short or not suitable.")
      }
    } catch (error: any) {
      console.error("Error generating MCQs:", error)
      setMcqError(error.message || "An unexpected error occurred while generating MCQs.")
    } finally {
      setIsGeneratingMcqs(false)
    }
  }

  const handleMcqOptionSelect = (questionIndex: number, option: string) => {
    setUserAnswers((prev) => ({ ...prev, [questionIndex]: option }))
  }

  const handleSubmitMcqs = () => {
    setShowMcqResults(true)
  }

  const calculateMcqScore = () => {
    let correctCount = 0
    generatedMcqs.forEach((mcq, index) => {
      if (userAnswers[index] === mcq.correctAnswer) {
        correctCount++
      }
    })
    return {
      correct: correctCount,
      total: generatedMcqs.length,
      percentage: generatedMcqs.length > 0 ? (correctCount / generatedMcqs.length) * 100 : 0,
    }
  }

  const handleEditNote = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingNote) return

    setErrorMessage(null)

    if (!editingNote.title || !editingNote.content) {
      setErrorMessage("Title and content are required.")
      return
    }
    if (!editingNote.category.trim()) {
      setErrorMessage("Category is required. Please select or create one.")
      return
    }

    setIsLoading(true)
    try {
      const { error } = await supabase
        .from("notes")
        .update({
          title: editingNote.title,
          content: editingNote.content,
          category: editingNote.category.trim().toLowerCase(),
        })
        .eq("id", editingNote.id)

      if (error) {
        console.error("Supabase error updating note:", error)
        setErrorMessage(`Error updating note: ${error.message}`)
        throw error
      }

      setEditingNote(null)
      setIsEditNoteDialogOpen(false)
      await fetchNotes() // Refresh all notes
    } catch (error: any) {
      // Error message already set
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteNote = async (noteId: string) => {
    const note = allNotes.find((n) => n.id === noteId)
    if (note) {
      setNoteToDelete(note)
      setIsDeleteDialogOpen(true)
    }
  }

  const confirmDelete = async () => {
    if (!noteToDelete) return

    setIsLoading(true)
    try {
      const { error } = await supabase.from("notes").delete().eq("id", noteToDelete.id)

      if (error) {
        console.error("Supabase error deleting note:", error)
        setErrorMessage(`Error deleting note: ${error.message}`)
        throw error
      }

      if (focusedNoteId === noteToDelete.id) {
        setFocusedNoteId(null)
      }
      await fetchNotes() // Refresh all notes
      setIsDeleteDialogOpen(false)
      setNoteToDelete(null)
    } catch (error: any) {
      // Error message already set
    } finally {
      setIsLoading(false)
    }
  }

  const startEditingNote = (note: Note) => {
    setEditingNote(note);
    setIsEditNoteDialogOpen(true);
  }

  // Handle AI note edit - apply edits from the AI Assistant
  const handleAiNoteEdit = async (newContent: string) => {
    if (focusedNoteId) {
      const noteToEdit = allNotes.find(note => note.id === focusedNoteId);
      if (noteToEdit) {
        setIsLoading(true);
        setErrorMessage(null);
        
        try {
          // setIsLoading(true); // Assuming setIsLoading(true) is handled before this block or at the start of handleImageSelected
          const { error: updateError } = await supabase
            .from("notes")
            .update({ content: newContent, updated_at: new Date().toISOString() })
            .eq("id", focusedNoteId);

          if (updateError) {
            console.error("Error updating note after image selection:", updateError);
            setErrorMessage(`Failed to update note: ${updateError.message}`);
            // Consider if you need to throw updateError here for an outer catch block
          } else {
            // Update the notes in state optimistically or after confirmation
            const updateNoteContent = (prevNotes: Note[]) =>
              prevNotes.map(note =>
                note.id === focusedNoteId
                  ? { ...note, content: newContent, updated_at: new Date().toISOString() }
                  : note
              );
            setAllNotes(updateNoteContent);
            setDisplayedNotes(updateNoteContent);
            // setErrorMessage("Note updated with image!"); // Optional success message
            // setTimeout(() => setErrorMessage(null), 2000);
          }
        } catch (error: any) {
          console.error("Exception during note update after image selection:", error);
          setErrorMessage(`An unexpected error occurred: ${error.message}`);
        } finally {
          setIsLoading(false); // Ensure this is managed correctly
        }
      }
    }
  }

  const handleGenerateFlashcards = async () => {
    if (!noteForFlashcards) return;
    
    setIsGeneratingFlashcards(true);
    
    try {
      const response = await fetch('/api/generate-flashcards', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          noteId: noteForFlashcards.id,
          noteContent: noteForFlashcards.content
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate flashcards');
      }
      
      const data = await response.json();
      
      // Update the note with the generated flashcards
      const updatedNotes = allNotes.map(note => {
        if (note.id === noteForFlashcards.id) {
          return {
            ...note,
            flashcards: data.flashcards
          };
        }
        return note;
      });
      
      setAllNotes(updatedNotes);
      setActiveNote(updatedNotes.find(note => note.id === noteForFlashcards.id) || null);
    } catch (error) {
      console.error('Error generating flashcards:', error);
      // Handle error appropriately, e.g. show a toast notification
    } finally {
      setIsGeneratingFlashcards(false);
      setIsFlashcardsDialogOpen(false);
    }
  };

  return (
    <div
      className={`flex h-screen ${theme === "dark" ? "bg-neutral-950 text-neutral-100" : "bg-gray-50 text-gray-900"}`}
    >
      {/* Mobile Hamburger Menu */}
      <div className="md:hidden fixed top-4 left-4 z-50">
        <Sheet>
          <SheetTrigger asChild>
            <Button 
              variant="ghost"
              size="icon"
              className="bg-neutral-900/90 backdrop-blur-lg text-neutral-100 hover:text-neutral-100 hover:bg-neutral-800 h-10 w-10 rounded-full border border-neutral-700/50 shadow-lg"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 border-r border-neutral-800 w-4/5 max-w-[300px] bg-neutral-950 rounded-r-xl">
            <NotesSidebar
              notes={allNotes}
              categories={availableCategories}
              selectedCategory={selectedSidebarCategory}
              onSelectCategory={(category) => {
                handleCategorySelectFromSidebar(category);
                // Close the sheet after selecting a category on mobile
                const closeButton = document.querySelector('[data-state="open"] [data-radix-collection-item]');
                if (closeButton) {
                  (closeButton as HTMLButtonElement).click();
                }
              }}
              onSelectNote={(noteId) => {
                handleNoteSelectInSidebar(noteId);
                // Close the sheet after selecting a note on mobile
                const closeButton = document.querySelector('[data-state="open"] [data-radix-collection-item]');
                if (closeButton) {
                  (closeButton as HTMLButtonElement).click();
                }
              }}
              searchQuery={searchQuery}
              onSearchChange={handleSearch}
              onClearSearch={clearSearch}
              className="h-full border-0"
            />
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <NotesSidebar
          notes={allNotes}
          categories={availableCategories}
          selectedCategory={selectedSidebarCategory}
          onSelectCategory={handleCategorySelectFromSidebar}
          onSelectNote={handleNoteSelectInSidebar}
          searchQuery={searchQuery}
          onSearchChange={handleSearch}
          onClearSearch={clearSearch}
          className="w-72 lg:w-80 border-r border-neutral-800 flex-shrink-0 h-screen"
        />
      </div>

      <div 
        className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ease-in-out ${isAiAssistantOpen ? 'md:pr-[350px]' : 'pr-0'}`}
      >
        <div ref={notesContainerRef} className="flex-1 overflow-y-auto p-4 pt-14 md:pt-4 md:p-6 lg:p-8 pb-24 scroll-smooth">
          {/* Search results count - only shown when searching */}
          {searchQuery && (
            <div className="text-xs text-neutral-400 mb-6 ml-1">
              Found {displayedNotes.length} {displayedNotes.length === 1 ? "result" : "results"} for "{searchQuery}"
            </div>
          )}
          <div className="mt-6 space-y-6 md:space-y-8 w-full max-w-5xl mx-auto">
            {isLoading && displayedNotes.length === 0 && (
              <p className="text-center text-neutral-500 py-10">Loading notes...</p>
            )}
            {!isLoading && displayedNotes.length === 0 && selectedSidebarCategory === "all" && !focusedNoteId && !searchQuery && (
              <div className="text-center text-neutral-400 py-10 text-lg">
                <p>No notes yet. Create your first note!</p>
                <Button
                  onClick={() => setIsAddNoteDialogOpen(true)}
                  className="mt-4 bg-neutral-800 hover:bg-neutral-700 text-neutral-100 border border-neutral-700"
                >
                  <PlusCircleIcon className="mr-2 h-5 w-5" /> Add Your First Note
                </Button>
              </div>
            )}
            {!isLoading && displayedNotes.length === 0 && selectedSidebarCategory !== "all" && !focusedNoteId && !searchQuery && (
              <p className="text-center text-neutral-400 py-10 text-lg">
                No notes in "{selectedSidebarCategory.charAt(0).toUpperCase() + selectedSidebarCategory.slice(1)}".
              </p>
            )}
            {!isLoading && displayedNotes.length === 0 && searchQuery && (
              <p className="text-center text-neutral-400 py-10 text-lg">No notes match your search "{searchQuery}".</p>
            )}
            {!isLoading && displayedNotes.length === 0 && focusedNoteId && !searchQuery && (
              <p className="text-center text-neutral-400 py-10 text-lg">Note not found or does not match category.</p>
            )}

            {displayedNotes.map((note) => (
              <Card
                key={note.id}
                id={`note-${note.id}`}
                ref={focusedNoteId === note.id ? activeNoteRef : null}
                className="bg-neutral-900 border-neutral-800 border-[0.5px] rounded-xl shadow-xl p-5 md:p-8 transition-all duration-300 ease-in-out hover:shadow-2xl data-[focused='true']:ring-1 data-[focused='true']:ring-blue-500/60 data-[focused='true']:scale-[1.01] mx-0 w-full"
                data-focused={focusedNoteId === note.id}
              >
                <div className="flex justify-between items-start mb-4 md:mb-6 pb-3 md:pb-4 border-b border-neutral-700">
                  <h3 className={`text-2xl md:text-4xl font-bold mr-2 ${theme === "dark" ? "text-neutral-50" : "text-gray-800"}`}>{note.title}</h3>
                  <div className="flex items-center space-x-2 md:space-x-3">
                    <button
                      onClick={() => startEditingNote(note)}
                      className="text-neutral-400 hover:text-neutral-300 text-xs transition-colors"
                      aria-label="Edit note"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        setNoteToDelete(note)
                        setIsDeleteDialogOpen(true)
                      }}
                      className="text-neutral-400 hover:text-neutral-300 text-xs transition-colors"
                      aria-label="Delete note"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => {
                        // Set the current note for flashcard generation
                        setNoteForFlashcards(note);
                        setIsFlashcardsDialogOpen(true)
                      }}
                      className="text-neutral-400 hover:text-neutral-300 text-xs transition-colors"
                      aria-label="Create flashcards from note"
                    >
                      Create Flashcards
                    </button>
                  </div>
                </div>
                <div className="prose-custom max-w-none text-sm md:text-base">
                  {inlineEditingNoteId === note.id ? (
                    <div className="relative">
                      <Textarea
                        ref={inlineEditRef}
                        value={inlineEditContent}
                        onChange={(e) => setInlineEditContent(e.target.value)}
                        className="min-h-[300px] w-full bg-neutral-800 border-neutral-700 text-neutral-100 placeholder:text-neutral-500 focus:border-neutral-500 focus:ring-neutral-500 font-mono text-sm p-4"
                        placeholder="Edit your note content..."
                      />
                      <div className="flex justify-end mt-4 space-x-3">
                        <Button
                          onClick={() => setInlineEditingNoteId(null)}
                          variant="outline"
                          className="bg-neutral-100 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 hover:bg-neutral-200 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-100"
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handleSaveInlineEdit}
                          className="bg-neutral-900 dark:bg-neutral-800 hover:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-900 dark:text-neutral-100 font-semibold py-2.5 rounded-lg shadow-md transition-colors duration-150 focus:ring-2 focus:ring-neutral-600 dark:focus:ring-neutral-600 focus:ring-offset-2 focus:ring-offset-neutral-100 dark:focus:ring-offset-neutral-900 border border-neutral-200 dark:border-neutral-700"
                        >
                          Save Changes
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div id={`note-content-${note.id}`}>{renderNoteContent(note.content, mcqStates, handleMcqOptionClick, shuffledMcqOptionsRef.current)}</div>
                  )}
                </div>
                <div className="text-xs text-neutral-500 mt-6 md:mt-8 pt-3 md:pt-4 border-t border-neutral-700">
                  Category:{" "}
                  <span className="font-medium text-neutral-400">
                    {note.category.charAt(0).toUpperCase() + note.category.slice(1)}
                  </span>{" "}
                  | Created:{" "}
                  {new Date(note.created_at).toLocaleDateString([], { year: "numeric", month: "long", day: "numeric" })}
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Floating Bottom Nav Bar */}
        <div className={`w-full p-3 md:p-4 border-t ${theme === "dark" ? "border-neutral-800/50 bg-neutral-950/90" : "border-gray-200 bg-white/90"} backdrop-blur-xl ${theme === "dark" ? "shadow-[0_-8px_32px_rgba(0,0,0,0.4)]" : "shadow-[0_-8px_32px_rgba(0,0,0,0.1)]"} sticky bottom-0 z-20 flex items-center justify-between`}>
          <div className="flex items-center space-x-2 md:space-x-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsAddNoteDialogOpen(true)}
              className={`p-2 md:p-2.5 rounded-lg backdrop-blur-sm border transition-all duration-200 ${theme === "dark" ? "text-neutral-200 hover:text-white bg-white/5 hover:bg-white/10 border-white/10" : "text-gray-700 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 border-gray-200"}`}
              aria-label="Add new note"
            >
              <PlusCircleIcon className="h-5 w-5" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className={`p-2 md:p-2.5 rounded-lg backdrop-blur-sm border transition-all duration-200 ${theme === "dark" ? "text-neutral-200 hover:text-white bg-white/5 hover:bg-white/10 border-white/10" : "text-gray-700 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 border-gray-200"}`}
              aria-label="Toggle theme"
            >
              {theme === "dark" ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="lucide lucide-sun"
                >
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2" />
                  <path d="M12 20v2" />
                  <path d="m4.93 4.93 1.41 1.41" />
                  <path d="m17.66 17.66 1.41 1.41" />
                  <path d="M2 12h2" />
                  <path d="M20 12h2" />
                  <path d="m6.34 17.66-1.41 1.41" />
                  <path d="m19.07 4.93-1.41 1.41" />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="lucide lucide-moon"
                >
                  <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
                </svg>
              )}
            </Button>

            <span className={`hidden md:inline-flex items-center text-xs rounded-lg px-2 py-1 md:px-2.5 md:py-1.5 backdrop-blur-sm ${theme === "dark" ? "text-neutral-400 border border-white/10 bg-neutral-800/30" : "text-gray-500 border border-gray-200 bg-gray-100/50"}`}>
              <SparklesIcon className="h-3 w-3 mr-1" /> <kbd className="font-mono text-[10px]">Ctrl+K</kbd>
            </span>
          </div>

          <ScrollArea className="whitespace-nowrap flex-grow mx-2 md:mx-4">
            <div className="flex space-x-1.5 md:space-x-2 items-center h-10">
              {focusedNoteId && currentNoteHeadings.length > 0 ? (
                currentNoteHeadings.map((heading, index) => (
                  <Button
                    key={`heading-${index}`}
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const headingEl = document.getElementById(`heading-${generateSlug(heading.text)}`)
                      if (headingEl) headingEl.scrollIntoView({ behavior: "smooth", block: "start" })
                    }}
                    className={`transition-all rounded-lg px-3 py-2 text-sm ${theme === "dark" ? "text-neutral-300 hover:text-white hover:bg-white/5 data-[state=active]:bg-white/10 data-[state=active]:text-white" : "text-gray-600 hover:text-gray-900 hover:bg-gray-100 data-[state=active]:bg-gray-200 data-[state=active]:text-gray-900"} ${
                      heading.level === 1
                        ? "font-semibold"
                        : heading.level === 2
                          ? "pl-3"
                          : heading.level === 3
                            ? "pl-4 text-sm"
                            : "pl-5 text-xs"
                    }`}
                  >
                    {heading.level > 1 && <span className="opacity-60 mr-1">{"•".repeat(heading.level - 1)}</span>}
                    {heading.text}
                  </Button>
                ))
              ) : subheadings.length > 0 ? (
                subheadings.map((sh) => (
                  <Button
                    key={generateSlug(sh)}
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSubheadingClick(sh)}
                    className={`transition-all rounded-lg px-3 py-2 text-sm ${theme === "dark" ? "text-neutral-300 hover:text-white hover:bg-white/5 data-[state=active]:bg-white/10 data-[state=active]:text-white" : "text-gray-600 hover:text-gray-900 hover:bg-gray-100 data-[state=active]:bg-gray-200 data-[state=active]:text-gray-900"}`}
                  >
                    {sh}
                  </Button>
                ))
              ) : (
                <p className={`text-sm px-3 ${theme === "dark" ? "text-neutral-500" : "text-gray-500"}`}>
                  No H2 subheadings (##). Add notes with `## Your Subheading`.
                </p>
              )}
            </div>
            <ScrollBar orientation="horizontal" className={theme === "dark" ? "[&>div]:bg-neutral-700/50 hover:[&>div]:bg-neutral-600/60" : "[&>div]:bg-gray-300/50 hover:[&>div]:bg-gray-400/60"} />
          </ScrollArea>
          {focusedNoteId && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleGenerateMcqs}
              disabled={isGeneratingMcqs}
              className={`flex-shrink-0 backdrop-blur-sm border rounded-lg px-4 py-2 transition-all duration-200 ${theme === "dark" ? "text-neutral-200 hover:text-white bg-white/5 hover:bg-white/10 border-white/10" : "text-gray-700 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 border-gray-200"}`}
            >
              {isGeneratingMcqs ? (
                <>
                  <SparklesIcon className="h-4 w-4 mr-2 animate-spin" /> Generating...
                </>
              ) : (
                <>
                  <HelpCircleIcon className="h-4 w-4 mr-2" /> Quiz Me
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Add Note Dialog */}
      <Dialog open={isAddNoteDialogOpen} onOpenChange={setIsAddNoteDialogOpen}>
        <DialogContent className={`max-w-2xl rounded-xl shadow-2xl p-0 sm:p-0 ${theme === "dark" ? "bg-neutral-900 border-neutral-800 text-neutral-100" : "bg-white border-gray-200 text-gray-900"}`}>
          <div className="p-6 sm:p-8">
            <DialogHeader className="mb-6">
              <ShadDialogTitle className={`text-2xl font-bold ${theme === "dark" ? "text-neutral-100" : "text-gray-900"}`}>Add New Note</ShadDialogTitle>
            </DialogHeader>

            <div className={`space-y-4 mb-6 p-4 border rounded-lg ${theme === "dark" ? "border-neutral-700 bg-neutral-800/50" : "border-gray-200 bg-gray-50"}`}>
              <p className={`text-sm font-medium ${theme === "dark" ? "text-neutral-300" : "text-gray-700"}`}>Generate with AI ✨</p>
              <div className="flex space-x-2">
                <Input
                  placeholder="Enter a topic for AI note generation..."
                  value={generationTopic}
                  onChange={(e) => setGenerationTopic(e.target.value)}
                  className={`flex-grow ${theme === "dark" ? "bg-neutral-700 border-neutral-600 text-neutral-100 placeholder:text-neutral-400 focus:border-neutral-500 focus:ring-neutral-500" : "bg-white border-gray-300 text-gray-900 placeholder:text-gray-500 focus:border-gray-400 focus:ring-gray-400"}`}
                  disabled={isGeneratingNote}
                />
                <Button
                  onClick={handleGenerateNote}
                  disabled={isGeneratingNote || !generationTopic.trim()}
                  className={`font-semibold transition-all duration-150 whitespace-nowrap ${theme === "dark" ? "bg-neutral-800 hover:bg-neutral-700 text-neutral-100 focus:ring-2 focus:ring-neutral-600 focus:ring-offset-2 focus:ring-offset-neutral-900 border border-neutral-700" : "bg-gray-100 hover:bg-gray-200 text-gray-900 focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 focus:ring-offset-white border border-gray-300"}`}
                >
                  {isGeneratingNote ? (
                    <>
                      <SparklesIcon className="h-4 w-4 mr-2 animate-pulse" /> Generating...
                    </>
                  ) : (
                    <>
                      <SparklesIcon className="h-4 w-4 mr-2" /> Generate Note
                    </>
                  )}
                </Button>
              </div>
            </div>

            <form
              onSubmit={async (e) => {
                await handleAddNote(e)
                if (!errorMessage) handleSuccessfulNoteAdd()
              }}
              className="space-y-6"
            >
              <div>
                <Input
                  placeholder="Note Title"
                  value={newNote.title}
                  onChange={(e) => setNewNote({ ...newNote, title: e.target.value })}
                  className={`${theme === "dark" ? "bg-neutral-800 border-neutral-700 text-neutral-100 placeholder:text-neutral-500 focus:border-neutral-500 focus:ring-neutral-500" : "bg-white border-gray-300 text-gray-900 placeholder:text-gray-500 focus:border-gray-400 focus:ring-gray-400"}`}
                />
              </div>
              <div>
                <Textarea
                  placeholder="Note Content (use #, ##, *, -, 1., etc. for formatting)"
                  value={newNote.content}
                  onChange={(e) => {
                    const triggered = handleImageSearchTrigger(newNote.content, e.target.value, 'newNote');
                    if (!triggered) {
                      setNewNote({ ...newNote, content: e.target.value });
                    }
                  }}
                  className={`min-h-[160px] font-mono text-sm ${theme === "dark" ? "bg-neutral-800 border-neutral-700 text-neutral-100 placeholder:text-neutral-500 focus:border-neutral-500 focus:ring-neutral-500" : "bg-white border-gray-300 text-gray-900 placeholder:text-gray-500 focus:border-gray-400 focus:ring-gray-400"}`}
                />
              </div>
              <div>
                <CategoryCombobox
                  categories={availableCategories}
                  value={newNote.category}
                  onChange={(value) => setNewNote({ ...newNote, category: value })}
                  placeholder="Select or create category..."
                  inputPlaceholder="Search/Create category..."
                  emptyPlaceholder="Type to create new category."
                  theme={theme}
                />
              </div>

              {errorMessage && (
                <div className={`p-3 rounded-lg ${theme === "dark" ? "bg-red-900/30 border border-red-700/60 text-red-200" : "bg-red-100 border border-red-300 text-red-800"}`}>
                  {errorMessage}
                </div>
              )}
              <DialogFooter className="flex justify-between mt-8">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddNoteDialogOpen(false)}
                  className={`${theme === "dark" ? "bg-transparent border-neutral-700 text-neutral-300 hover:bg-neutral-800 hover:text-neutral-100" : "bg-transparent border-gray-300 text-gray-700 hover:bg-gray-100 hover:text-gray-900"}`}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition-all duration-150"
                >
                  {isLoading ? "Adding..." : "Add Note"}
                </Button>
              </DialogFooter>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      {/* AI Chat Dialog */}
      <Dialog open={isAiChatDialogOpen} onOpenChange={setIsAiChatDialogOpen}>
        <DialogContent className="bg-neutral-900 border-neutral-800 text-neutral-100 max-w-2xl rounded-xl shadow-2xl p-0 sm:p-0">
          <div className="p-6 sm:p-8">
            <DialogHeader className="mb-6">
              <ShadDialogTitle className="text-2xl font-bold text-neutral-100">AI Chat</ShadDialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="p-3 bg-neutral-800/50 border border-neutral-700 rounded-md">
                <p className="text-sm text-neutral-400 mb-1">Selected Text:</p>
                <p className="text-neutral-200 font-mono text-sm whitespace-pre-wrap">{selectedText}</p>
              </div>

              <div className="flex space-x-2">
                <Input
                  placeholder="Ask a question about this text..."
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      handleAiChatRequest()
                    }
                  }}
                  className="bg-neutral-800 border-neutral-700 text-neutral-100 placeholder:text-neutral-500 focus:border-neutral-500 focus:ring-neutral-500 flex-grow"
                  disabled={isProcessingAiRequest}
                />
                <Button
                  onClick={handleAiChatRequest}
                  disabled={isProcessingAiRequest || (!aiPrompt.trim() && !selectedText.trim())}
                  className="bg-neutral-800 hover:bg-neutral-700 text-neutral-100 font-semibold transition-all duration-150 focus:ring-2 focus:ring-neutral-600 focus:ring-offset-2 focus:ring-offset-neutral-900 whitespace-nowrap border border-neutral-700"
                >
                  {isProcessingAiRequest ? (
                    <>
                      <SparklesIcon className="h-4 w-4 mr-2 animate-pulse" /> Thinking...
                    </>
                  ) : (
                    <>
                      <SendIcon className="h-4 w-4 mr-2" /> Ask
                    </>
                  )}
                </Button>
              </div>

              {aiResponse && (
                <div className="mt-4">
                  <p className="text-sm text-neutral-400 mb-2">AI Response:</p>
                  <div className="bg-neutral-800/80 border border-neutral-700 rounded-md p-4 max-h-[300px] overflow-y-auto">
                    <div className="prose prose-invert prose-sm max-w-none">{renderNoteContent(aiResponse, mcqStates, handleMcqOptionClick)}</div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end mt-6">
              <Button
                onClick={() => setIsAiChatDialogOpen(false)}
                className="bg-neutral-800 hover:bg-neutral-700 text-neutral-100 font-medium border border-neutral-700"
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* MCQ Dialog */}
      <Dialog
        open={isMcqDialogOpen}
        onOpenChange={(isOpen) => {
          setIsMcqDialogOpen(isOpen)
          if (!isOpen) {
            setGeneratedMcqs([])
            setUserAnswers({})
            setShowMcqResults(false)
            setCurrentMcqNoteTitle(undefined)
          }
        }}
      >
        <DialogContent className="bg-neutral-900 border-neutral-800 text-neutral-100 max-w-3xl rounded-xl shadow-2xl p-0 sm:p-0">
          <ScrollArea className="max-h-[80vh]">
            <div className="p-6 sm:p-8">
              <DialogHeader className="mb-6">
                <ShadDialogTitle className="text-2xl font-bold text-neutral-100">
                  Quiz: {currentMcqNoteTitle || "Multiple Choice Questions"}
                </ShadDialogTitle>
                {generatedMcqs.length > 0 && (
                  <DialogDescription className="text-neutral-400">
                    Test your knowledge based on the selected note.
                  </DialogDescription>
                )}
              </DialogHeader>

              {mcqError && (
                <div className="text-red-400 text-sm p-3 bg-red-900/40 border border-red-700/60 rounded-md mb-4">
                  {mcqError}
                </div>
              )}

              {generatedMcqs.length > 0 ? (
                <div className="space-y-6">
                  {generatedMcqs.map((mcq, index) => (
                    <Card
                      key={index}
                      className={`bg-neutral-850 border-neutral-700 p-5 rounded-lg transition-all ${showMcqResults && userAnswers[index] !== mcq.correctAnswer ? "border-red-500/70" : showMcqResults && userAnswers[index] === mcq.correctAnswer ? "border-green-500/70" : ""}`}
                    >
                      <CardHeader className="p-0 pb-3 mb-3 border-b border-neutral-700">
                        <CardTitle className="text-lg font-semibold text-neutral-100">
                          Question {index + 1}: {mcq.question}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-0 space-y-2">
                        {mcq.options.map((option: string, optIndex: number) => {
                          const isSelected = userAnswers[index] === option
                          const isCorrect = option === mcq.correctAnswer
                          const isUserChoiceIncorrect = isSelected && !isCorrect

                          let optionButtonClasses =
                            "w-full justify-start text-left h-auto py-2.5 px-4 whitespace-normal rounded-md transition-colors duration-150 disabled:opacity-70 disabled:cursor-default border"

                          if (showMcqResults) {
                            if (isCorrect) {
                              optionButtonClasses +=
                                " bg-green-500/20 border-green-500/60 text-green-200 hover:bg-green-500/30"
                            } else if (isUserChoiceIncorrect) {
                              optionButtonClasses += " bg-red-500/20 border-red-500/60 text-red-200 hover:bg-red-500/30"
                            } else {
                              optionButtonClasses +=
                                " bg-neutral-800 border-neutral-700 text-neutral-500 opacity-70 hover:bg-neutral-750" // Other options during results
                            }
                          } else {
                            // Not showing results yet
                            if (isSelected) {
                              optionButtonClasses +=
                                " bg-neutral-600 border-neutral-500 text-neutral-100 ring-2 ring-neutral-500 hover:bg-neutral-550" // Selected
                            } else {
                              optionButtonClasses +=
                                " bg-neutral-800 border-neutral-700 text-neutral-200 hover:bg-neutral-750" // Default, unselected
                            }
                          }

                          return (
                            <Button
                              key={optIndex}
                              onClick={() => !showMcqResults && handleMcqOptionSelect(index, option)}
                              className={optionButtonClasses}
                              disabled={showMcqResults}
                            >
                              <span
                                className={`mr-3 h-5 w-5 rounded-full flex items-center justify-center border ${
                                  showMcqResults
                                    ? option === mcq.correctAnswer
                                      ? "bg-green-500 border-green-400"
                                      : userAnswers[index] === option && option !== mcq.correctAnswer
                                        ? "bg-red-500 border-red-400"
                                        : "border-neutral-600"
                                  : userAnswers[index] === option
                                    ? "bg-neutral-500 border-neutral-500"
                                    : "border-neutral-600"
                                }`}
                              >
                                {showMcqResults && option === mcq.correctAnswer && (
                                  <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                                )}
                                {showMcqResults && userAnswers[index] === option && option !== mcq.correctAnswer && (
                                  <XCircle className="h-3.5 w-3.5 text-white" />
                                )}
                              </span>
                              {option}
                            </Button>
                          )
                        })}
                      </CardContent>
                      {showMcqResults && (
                        <div
                          className={`mt-4 p-3 rounded-md text-sm 
                                      ${userAnswers[index] === mcq.correctAnswer ? "bg-green-800/50 text-green-200 border border-green-700/60" : "bg-red-800/50 text-red-200 border border-red-700/60"}`}
                        >
                          <p className="font-semibold mb-1">
                            {userAnswers[index] === mcq.correctAnswer ? "Correct!" : "Incorrect."}
                            {userAnswers[index] !== mcq.correctAnswer && ` Correct answer: ${mcq.correctAnswer}`}
                          </p>
                          {mcq.explanation && <p className="text-xs opacity-90">{mcq.explanation}</p>}
                        </div>
                      )}
                    </Card>
                  ))}

                  {!showMcqResults && generatedMcqs.length > 0 && (
                    <DialogFooter className="mt-8 sm:justify-center">
                      <Button
                        onClick={handleSubmitMcqs}
                        disabled={Object.keys(userAnswers).length !== generatedMcqs.length}
                        className="w-full md:w-auto bg-sky-600 hover:bg-sky-700 text-white font-semibold py-2.5 rounded-lg shadow-md transition-colors duration-150 focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-neutral-900 border border-sky-700"
                      >
                        Submit Answers & See Results
                      </Button>
                    </DialogFooter>
                  )}

                  {showMcqResults && (
                    <div className="mt-8 p-5 bg-neutral-800/60 border border-neutral-700 rounded-lg text-center">
                      <h3 className="text-xl font-semibold text-neutral-100 mb-2">Quiz Completed!</h3>
                      <p className="text-neutral-300 mb-1">
                        You scored:{" "}
                        <strong className="text-xl">
                          {calculateMcqScore().correct} out of {calculateMcqScore().total}
                        </strong>{" "}
                        ({calculateMcqScore().percentage.toFixed(0)}%)
                      </p>
                      {mcqError && <p className="text-xs text-red-400 mt-2">Note: {mcqError}</p>}
                      <Button
                        onClick={() => setIsMcqDialogOpen(false)}
                        className="mt-4 bg-neutral-700 hover:bg-neutral-600 text-neutral-100"
                      >
                        Close Quiz
                      </Button>
                    </div>
                  )}
                </div>
              ) : isGeneratingMcqs ? (
                <div className="text-center py-10">
                  <SparklesIcon className="h-12 w-12 text-neutral-500 animate-pulse mx-auto mb-4" />
                  <p className="text-neutral-400">Generating your quiz, please wait...</p>
                </div>
              ) : (
                <div className="text-center py-10">
                  <InfoIcon className="h-12 w-12 text-neutral-600 mx-auto mb-4" />
                  <p className="text-neutral-400">
                    No MCQs to display. {mcqError || "Try generating some from a note."}
                  </p>
                  <Button
                    onClick={() => setIsMcqDialogOpen(false)}
                    className="mt-6 bg-neutral-700 hover:bg-neutral-600 text-neutral-100"
                  >
                    Close
                  </Button>
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Edit Note Dialog */}
      <Dialog open={isEditNoteDialogOpen} onOpenChange={setIsEditNoteDialogOpen}>
        <DialogContent className="bg-neutral-900 border-neutral-800 text-neutral-100 max-w-2xl rounded-xl shadow-2xl p-0 sm:p-0">
          <div className="p-6 sm:p-8">
            <DialogHeader className="mb-6">
              <ShadDialogTitle className="text-2xl font-bold text-neutral-100">Edit Note</ShadDialogTitle>
            </DialogHeader>

            <form onSubmit={handleEditNote} className="space-y-6">
              <div>
                <Input
                  placeholder="Note Title"
                  value={editingNote?.title || ""}
                  onChange={(e) => editingNote && setEditingNote({ ...editingNote, title: e.target.value })}
                  className="bg-neutral-800 border-neutral-700 text-neutral-100 placeholder:text-neutral-500 focus:border-neutral-500 focus:ring-neutral-500"
                />
              </div>
              <div>
                <Textarea
                  placeholder="Note Content (use #, ##, *, -, 1., etc. for formatting)"
                  value={editingNote?.content || ""}
                  onChange={(e) => editingNote && setEditingNote({ ...editingNote, content: e.target.value })}
                  className="min-h-[160px] bg-neutral-800 border-neutral-700 text-neutral-100 placeholder:text-neutral-500 focus:border-neutral-500 focus:ring-neutral-500 font-mono text-sm"
                />
              </div>
              <div>
                <CategoryCombobox
                  categories={availableCategories}
                  value={editingNote?.category || ""}
                  onChange={(value) => editingNote && setEditingNote({ ...editingNote, category: value })}
                  placeholder="Select or create category..."
                  inputPlaceholder="Search/Create category..."
                  emptyPlaceholder="Type to create new category."
                />
              </div>

              {errorMessage && (
                <div className="text-red-400 text-sm p-3 bg-red-900/40 border border-red-700/60 rounded-md">
                  {errorMessage}
                </div>
              )}
              <div className="flex justify-end space-x-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditNoteDialogOpen(false)}
                  className="bg-neutral-100 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 hover:bg-neutral-200 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-100"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="bg-neutral-900 dark:bg-neutral-800 hover:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-900 dark:text-neutral-100 font-semibold py-2.5 rounded-lg shadow-md transition-colors duration-150 focus:ring-2 focus:ring-neutral-600 dark:focus:ring-neutral-600 focus:ring-offset-2 focus:ring-offset-neutral-100 dark:focus:ring-offset-neutral-900 border border-neutral-200 dark:border-neutral-700"
                >
                  {isLoading ? "Updating Note..." : "Update Note"}
                </Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      {/* Generate Flashcards Dialog */}
      <GenerateFlashcardsDialog 
        open={isFlashcardsDialogOpen}
        onOpenChange={(open) => {
          setIsFlashcardsDialogOpen(open);
          if (!open) setNoteForFlashcards(null);
        }}
        noteContent={noteForFlashcards?.content}
        noteTitle={noteForFlashcards?.title}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={isDeleteDialogOpen}
        onOpenChange={(isOpen) => {
          setIsDeleteDialogOpen(isOpen)
          if (!isOpen) {
            setNoteToDelete(null)
          }
        }}
      >
        <DialogContent className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 max-w-md rounded-xl shadow-2xl p-0 sm:p-0">
          <div className="p-6 sm:p-8">
            <DialogHeader className="mb-6">
              <ShadDialogTitle className="text-2xl font-bold text-neutral-100">Delete Note</ShadDialogTitle>
              <DialogDescription className="text-neutral-400 mt-2">
                Are you sure you want to delete "{noteToDelete?.title}"? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>

            {errorMessage && (
              <div className="text-red-400 text-sm p-3 bg-red-900/40 border border-red-700/60 rounded-md mb-4">
                {errorMessage}
              </div>
            )}

            <div className="flex justify-end space-x-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDeleteDialogOpen(false)}
                className="bg-neutral-100 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 hover:bg-neutral-200 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-100"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={confirmDelete}
                disabled={isLoading}
                className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 rounded-lg shadow-md transition-colors duration-150 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-neutral-900 border border-red-700"
              >
                {isLoading ? "Deleting..." : "Delete Note"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* AI Assistant Sidebar */}
      <AIAssistantSidebar
        isOpen={isAiAssistantOpen}
        onClose={() => setIsAiAssistantOpen(false)}
        currentNote={allNotes.find(note => note.id === focusedNoteId) || null}
        onApplyEdit={handleAiNoteEdit}
      />

      {/* Image Search Dialog */}
      <ImageSearchDialog
        isOpen={isImageSearchDialogOpen}
        onClose={closeImageSearchDialog}
        query={imageSearchQuery}
        images={imageSearchResults}
        isLoading={isLoadingImages}
        error={imageSearchError}
        onImageSelect={handleImageSelectedFromDialog}
      />
    </div>
  );
}
