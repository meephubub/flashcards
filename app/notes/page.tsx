"use client"

import React from "react"
import { useState, useEffect, useRef, useCallback, useMemo } from "react"
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
  FlaskConical,
  PanelLeft,
  Keyboard
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
import { generateImage, type ImageModel } from "../../lib/generate-image"
import { toast } from "@/components/ui/use-toast"
import { Select, SelectTrigger, SelectValue, SelectItem, SelectContent } from "@/components/ui/select"

interface McqOption {
  text: string;
  isCorrect: boolean;
  // Add other potential fields if necessary, e.g., explanation?: string;
}
import { ImageSearchDialog } from "@/components/image-search-dialog";
import { AddNoteDialog } from "@/components/add-note-dialog";
import { EditNoteDialog } from "@/components/edit-note-dialog";
import mermaid from "mermaid";
import { generateNoteWithGroq } from "@/lib/groq";
import { formatNoteWithGroq } from "@/lib/groq";

// Helper to generate slugs for IDs
// Keep track of used slugs to avoid duplicates

// Mermaid diagram renderer
const MermaidDiagram = ({ code, theme }: { code: string; theme: string | undefined }) => {
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    mermaid.initialize({ startOnLoad: false, theme: theme === "dark" ? "dark" : "default" });
    mermaid.render(`mermaid-${Math.random().toString(36).substr(2, 9)}`, code)
      .then(({ svg }) => {
        if (isMounted) {
          setSvg(svg);
          setError(null);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err?.message || "Failed to render diagram");
        }
      });
    return () => { isMounted = false; };
  }, [code, theme]);

  if (error) {
    return <div className="text-red-500">Diagram error: {error}</div>;
  }
  return <div className="w-full overflow-x-auto" dangerouslySetInnerHTML={{ __html: svg }} />;
};

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
    // Check for YouTube URLs
    const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/;
    const youtubeMatch = src.match(youtubeRegex);

    if (youtubeMatch) {
      const videoId = youtubeMatch[1];
      return `<iframe 
        class="w-full aspect-video rounded-md my-2"
        src="https://www.youtube.com/embed/${videoId}" 
        frameborder="0" 
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
        allowfullscreen>
      </iframe>`;
    }
    
    // Check if alt text contains height specification
    const heightMatch = alt.match(/\|\s*maxheight=(\d+)/)
    let maxHeight = 400 // Default max height
    let cleanAlt = alt

    if (heightMatch) {
      maxHeight = Number.parseInt(heightMatch[1], 10)
      // Remove the height specification from alt text
      cleanAlt = alt.replace(/\|\s*maxheight=\d+/, "").trim()
    }

    // Check if the source is a base64 image
    const isBase64 = src.startsWith('data:image/') && src.includes(';base64,')
    
    // If it's a base64 image, use it directly, otherwise use the URL
    const imageSrc = isBase64 ? src : src

    return `<img src="${imageSrc}" alt="${cleanAlt}" class="max-w-full max-h-[${maxHeight}px] h-auto rounded-md my-2" />`
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

// Regex for [gap:answer] syntax
const gapRegex = /\[gap:([^\]]+)\]/g;

// Import levenshtein distance from fastest-levenshtein
import { distance as levenshteinDistance } from 'fastest-levenshtein';

// Helper to get color class based on levenshtein distance or similarity score
const getGapColorClass = (value: string, answer: string, similarity: number, isEmpty: boolean, theme: "dark" | "light" | undefined) => {
  const isDark = theme === "dark";
  
  if (isEmpty) {
    return isDark 
      ? "bg-neutral-800 border-neutral-600 text-neutral-200" 
      : "bg-gray-100 border-gray-300 text-gray-700";
  }
  
  // Use levenshtein distance for immediate feedback
  const distance = levenshteinDistance(value.toLowerCase().trim(), answer.toLowerCase().trim());
  
  // If using similarity score from Xenova
  if (similarity > 0) {
    if (similarity > 0.85) {
      return isDark 
        ? "bg-green-900/30 border-green-700 text-green-200" 
        : "bg-green-100 border-green-500 text-green-800";
    } else if (similarity > 0.6) {
      return isDark 
        ? "bg-yellow-900/30 border-yellow-700 text-yellow-200" 
        : "bg-yellow-100 border-yellow-500 text-yellow-800";
    } else {
      return isDark 
        ? "bg-red-900/30 border-red-700 text-red-200" 
        : "bg-red-100 border-red-500 text-red-800";
    }
  } else {
    // Using levenshtein distance
    if (distance === 0) {
      return isDark 
        ? "bg-green-900/30 border-green-700 text-green-200" 
        : "bg-green-100 border-green-500 text-green-800";
    } else if (distance <= 2) {
      return isDark 
        ? "bg-yellow-900/30 border-yellow-700 text-yellow-200" 
        : "bg-yellow-100 border-yellow-500 text-yellow-800";
    } else {
      return isDark 
        ? "bg-red-900/30 border-red-700 text-red-200" 
        : "bg-red-100 border-red-500 text-red-800";
    }
  }
};

// Enhanced renderNoteContent function
const renderNoteContent = (
  content: string,
  mcqStates: Record<string, any>,
  handleMcqOptionClick: Function,
  shuffledOptionsStorage?: Record<string, any>,
  gapStates?: Record<string, { value: string; similarity: number; isRevealed?: boolean }>,
  setGapStates?: React.Dispatch<React.SetStateAction<Record<string, { value: string; similarity: number; isRevealed?: boolean }>>>,
  getSimilarity?: (input: string, answer: string) => Promise<number>,
  dragDropStates?: Record<string, { answers: Record<number, string>; showAnswers: boolean }>,
  setDragDropStates?: React.Dispatch<React.SetStateAction<Record<string, { answers: Record<number, string>; showAnswers: boolean }>>>,
  noteCategory?: string,
  getCategoryColorClass?: (category: string) => { bg: string, accent: string, border: string }
) => {
  console.log('[RAW CONTENT]', JSON.stringify(content));
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let currentList: string[] = [];
  let inTable = false;
  let tableRows: string[][] = [];
  let currentTableHeaders: string[] = [];
  let inInfoBox = false;
  let infoBoxContent: string[] = [];
  let infoBoxColor = "";
  let inMathBlock = false;
  let mathBlockContent: string[] = [];
  let inMcqBlock = false;
  let currentMcqQuestion = "";
  let currentMcqOptions: McqOption[] = [];
  let inDragDrop = false;
  let dragDropLines: string[] = [];
  let dragDropBlockKey = '';

  // Process functions
  const processList = () => {
    if (currentList.length > 0) {
      elements.push(
        <ul key={`list-${elements.length}`} className="list-disc pl-6 my-4 space-y-2">
          {currentList.map((item, index) => (
            <li key={index} className="text-neutral-200">{parseInlineMarkdown(item)}</li>
          ))}
        </ul>
      );
      currentList = [];
    }
  };

  const processTable = () => {
    // Get the current theme
    const { theme } = useTheme();
    const isDark = theme === "dark";
  
    if (tableRows.length > 0) {
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
              {tableRows.map((row, rowIndex) => (
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
    tableRows = [];
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

      // Fixed: processInfoBoxContent function to properly handle ** for bold text
      const processInfoBoxContent = (text: string) => {
        // First handle special case for bold text in info boxes
        let processedText = text.replace(
          /\*\*(.*?)\*\*/g,
          '<strong class="font-bold text-neutral-200">$1</strong>'
        );

        // Handle highlighted text
        processedText = processedText.replace(/==(.*?)==/g, (match, p1) => {
          return `<span class="${isDark ? 'text-white' : 'text-black'} font-medium">${p1}</span>`;
        });
        
        // Use the original parseInlineMarkdown for other formatting
        // But we need to make sure we don't re-process the bold text we just processed
        return <span dangerouslySetInnerHTML={{ __html: processedText }} />;
      };

      elements.push(
        <div key={`infobox-${elements.length}`} className={`my-4 p-4 rounded-lg border ${colorClass}`}>
          {infoBoxContent.map((line, index) => (
            <p key={index} className={`mb-2 last:mb-0 ${textColorClass}`}>
              {processInfoBoxContent(line)}
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
    if (inMathBlock && mathBlockContent.length > 0) {
      const { theme } = useTheme();
      const isDark = theme === "dark";
      const mathTextColor = isDark ? "text-white" : "text-black";
      
      try {
        const mathString = mathBlockContent.join("\n");
        elements.push(
          <div key={`math-${elements.length}`} className={`my-4 p-4 rounded-lg ${mathTextColor}`}>
            {mathString}
          </div>
        );
      } catch (error) {
        console.error("Error rendering math block:", error);
        elements.push(
          <div key={`math-error-${elements.length}`} className="text-red-500">
            Error rendering math block
          </div>
        );
      }
      inMathBlock = false;
      mathBlockContent = [];
    }
  };

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
      const mcqBlockIdentifier = elements.length.toString();
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

  // Process drag and drop block
  const processDragDropBlock = () => {
    if (dragDropLines.length > 0) {
      let question = '';
      let pairs: { left: string, right: string }[] = [];
      let options: string[] = [];
      
      dragDropLines.forEach(l => {
        if (l.startsWith('Question:')) {
          question = l.replace('Question:', '').trim();
        } else if (l.startsWith('-')) {
          const match = l.match(/^\-\s*(.*?)\s*=>\s*\[drop:(.*?)\]/);
          if (match) {
            pairs.push({ left: match[1].trim(), right: match[2].trim() });
          }
        } else if (l.startsWith('Options:')) {
          options = l.replace('Options:', '').split(',').map(s => s.trim()).filter(Boolean);
        }
      });

      const blockState = dragDropStates?.[dragDropBlockKey] || { answers: {}, showAnswers: false };

      elements.push(
        <DragDropBlock
          key={dragDropBlockKey}
          question={question}
          pairs={pairs}
          options={options}
          userAnswers={blockState.answers}
          setUserAnswers={(fn) => {
            if (setDragDropStates) {
              setDragDropStates(prev => {
                const currentBlockState = prev[dragDropBlockKey] || { answers: {}, showAnswers: false };
                const newAnswers = typeof fn === 'function' ? fn(currentBlockState.answers) : fn;
                return {
                  ...prev,
                  [dragDropBlockKey]: { ...currentBlockState, answers: newAnswers }
                };
              });
            }
          }}
          showAnswers={blockState.showAnswers}
          setShowAnswers={(show) => {
            if (setDragDropStates) {
              setDragDropStates(prev => ({
                ...prev,
                [dragDropBlockKey]: { ...(prev[dragDropBlockKey] || { answers: {}, showAnswers: false }), showAnswers: show }
              }));
            }
          }}
          theme={useTheme().theme as "dark" | "light"}
        />
      );
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
       // Tree/Mermaid diagram block
   if (line.startsWith("```tree") || line.startsWith("```mermaid")) {
    processList();
    processTable();
    processInfoBox();
    processMathBlock();
    if (inMcqBlock) processMcqBlock();
    let diagramLines: string[] = [];
    let j = i + 1;
    // Collect all lines until the closing ```
    while (j < lines.length && !lines[j].trim().startsWith("```")) {
      diagramLines.push(lines[j]);
      j++;
    }
    // Skip the closing ``` line as well
    i = j;
    const diagramCode = diagramLines.join("\n");
    // Get category color classes
    const category = noteCategory || 'teal';
    const { bg, accent, border } = getCategoryColorClass ? getCategoryColorClass(category) : { bg: 'bg-teal-100', accent: 'bg-teal-500', border: 'border-teal-300' };
    elements.push(
      <div
        key={`tree-diagram-${elements.length}`}
        className={`my-10 rounded-3xl border ${border} bg-white/60 dark:bg-neutral-900/60 backdrop-blur-xl shadow-lg transition-all duration-200 hover:shadow-[0_8px_16px_0_rgba(31,41,55,0.10)] hover:${border} group`}
        style={{ overflow: 'hidden', position: 'relative', fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif' }}
      >
        <div className={`flex items-center gap-3 px-8 pt-7 pb-3 border-b ${border} bg-gradient-to-r from-white/70 via-white/60 to-white/40 dark:from-neutral-900/80 dark:via-neutral-900/30 dark:to-neutral-900/60 backdrop-blur-md`}>
          <div className={`flex items-center justify-center w-11 h-11 rounded-xl ${accent} group-hover:${accent} transition`}>
            <svg xmlns='http://www.w3.org/2000/svg' className='w-6 h-6 text-white dark:text-neutral-100' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth='2'><path strokeLinecap='round' strokeLinejoin='round' d='M12 4v16m8-8H4' /></svg>
          </div>
          <span className="font-semibold text-lg md:text-xl text-neutral-800 dark:text-neutral-100 tracking-tight drop-shadow-sm">Diagram</span>
          <span className={`ml-auto text-xs ${accent} font-mono uppercase tracking-wider`}>Mermaid</span>
        </div>
        <div className="px-8 py-8 bg-transparent">
          <MermaidDiagram code={diagramCode} theme={useTheme().theme} />
        </div>
      </div>
    );
    continue;
  }
    // Handle drag and drop blocks first
    if (line.toLowerCase() === '::dragdrop') {
      processList();
      processTable();
      processInfoBox();
      processMathBlock();
      if (inMcqBlock) processMcqBlock();
      inDragDrop = true;
      dragDropLines = [];
      dragDropBlockKey = `dragdrop-block-${elements.length}`;
      continue;
    }

    if (line === '::' && inDragDrop) {
      processDragDropBlock();
      inDragDrop = false;
      dragDropLines = [];
      dragDropBlockKey = '';
      continue;
    }

    if (inDragDrop) {
      dragDropLines.push(lines[i]);
      continue;
    }

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
        tableRows.push(cells) // FIX: Was tableRows
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

    // Fill-in-the-gap block: if line contains [gap:answer]
    if (gapRegex.test(line)) {
      let gapIndex = 0;
      const lineKey = `gap-line-${i}`;
      // Reset regex state for re-use
      gapRegex.lastIndex = 0;
      // Split the line into text and gaps
      const parts = [];
      let lastIndex = 0;
      let match;
      
      // Get the current theme
      const { theme } = useTheme();
      const isDark = theme === "dark";
      const gapBgClass = isDark ? "bg-neutral-800/60" : "bg-gray-100";
      const gapBorderClass = isDark ? "border-blue-700" : "border-blue-400";
      const gapTextClass = isDark ? "text-neutral-100" : "text-gray-900";
      
      while ((match = gapRegex.exec(line)) !== null) {
        const before = line.slice(lastIndex, match.index);
        if (before) parts.push(before);
        const answer = match[1];
        const gapKey = `${lineKey}-gap-${gapIndex}`;
        
        // Get state for this gap
        let gapValue = gapStates?.[gapKey]?.value || "";
        let similarity = gapStates?.[gapKey]?.similarity ?? 0;
        let isRevealed = gapStates?.[gapKey]?.isRevealed ?? false;
        
        // Get color class based on levenshtein distance or similarity
        let colorClass = getGapColorClass(gapValue, answer, similarity, gapValue.length === 0, theme as "dark" | "light" | undefined);
        
        // Create a container for the input only (no reveal button)
        parts.push(
          <div key={gapKey} className="inline-flex items-center mx-1 gap-1">
            <Input
              id={gapKey}
              type="text"
              // Always use the current value from state, which will be the answer if revealed
              value={isRevealed ? answer : gapValue}
              disabled={isRevealed}
              spellCheck={false}
              className={`inline-block w-36 text-center font-mono transition-all duration-300 border-2 rounded-md shadow-sm ${colorClass} ${isRevealed ? (theme === "dark" ? "bg-green-900/30 border-green-700 text-green-200" : "bg-green-100 border-green-500 text-green-800") : ""} ${isRevealed ? "opacity-80" : ""}`}
              style={{ display: "inline-block", minWidth: 80, maxWidth: 200 }}
              onChange={(e) => {
                const val = e.target.value;
                
                // First update the input value immediately for responsiveness
                setGapStates?.((prev: any) => ({
                  ...prev,
                  [gapKey]: { ...prev[gapKey], value: val },
                }));
                
                // Skip if already revealed or empty
                if (!val.length || gapStates?.[gapKey]?.isRevealed) return;
                
                  // The initial setGapStates above handles the visual update of the typed character.
                  // Now, immediately process for autofill.

                  // Check if the input or revealed state has changed since timeout started
                  // No, this check is not needed if we are running synchronously right after the input event.
                  // const currentState = gapStates?.[gapKey]; 
                  // if (!currentState || currentState.value !== val || currentState.isRevealed) return; // val here is from the event, currentState.value might be stale if setGapStates hasn't re-rendered yet.

                  // Do the Levenshtein distance check using 'val' from the current input event
                  const userInput = val.toLowerCase().trim();
                  const correctAnswer = answer.toLowerCase().trim();
                  const distance = levenshteinDistance(userInput, correctAnswer);
                  
                  // Check if input is a partial match (beginning of the answer)
                  const isPartialMatch = correctAnswer.startsWith(userInput) && userInput.length >= 3;
                  
                  // Auto-fill if within 2 edit distances or is a partial match with at least 3 chars
                  if (distance <= 2 || isPartialMatch) {
                    // Force update with the correct answer and mark as revealed
                    setGapStates?.((prev: any) => ({
                      ...prev,
                      [gapKey]: { 
                        ...(prev[gapKey] || {}), // Ensure prev[gapKey] exists
                        value: answer, 
                        similarity: 1, 
                        isRevealed: true 
                      },
                    }));
                    
                    // Log for debugging
                    console.log(`Autofilled gap ${gapKey} with answer: ${answer} (distance: ${distance}, partial: ${isPartialMatch})`);
                  }
              }}
              // Keep onBlur for when user leaves field without completing
              onBlur={(e) => {
                const val = e.target.value;
                if (!val.length || gapStates?.[gapKey]?.isRevealed) return;
                
                // Do the Levenshtein distance check with the same logic as onChange
                const userInput = val.toLowerCase().trim();
                const correctAnswer = answer.toLowerCase().trim();
                const distance = levenshteinDistance(userInput, correctAnswer);
                
                // Check if input is a partial match (beginning of the answer)
                const isPartialMatch = correctAnswer.startsWith(userInput) && userInput.length >= 3;
                
                // Auto-fill if within 2 edit distances or is a partial match with at least 3 chars
                if (distance <= 2 || isPartialMatch) {
                  // Force update with the correct answer and mark as revealed
                  setGapStates?.((prev: any) => ({
                    ...prev,
                    [gapKey]: { 
                      ...prev[gapKey], 
                      value: answer, 
                      similarity: 1, 
                      isRevealed: true 
                    },
                  }));
                  
                  console.log(`Autofilled gap ${gapKey} on blur with answer: ${answer} (distance: ${distance})`);
                }
              }}
              onKeyDown={(e) => {
                // Handle keyboard navigation between gaps
                if (e.key === 'Enter' || e.key === 'Tab') {
                  e.preventDefault();
                  // Find the next gap input
                  const allGapInputs = document.querySelectorAll('input[id^="gap-line-"]');
                  const currentIndex = Array.from(allGapInputs).findIndex(input => (input as HTMLElement).id === gapKey);
                  const nextInput = allGapInputs[currentIndex + 1] as HTMLInputElement | undefined;
                  if (nextInput) {
                    nextInput.focus();
                  }
                }
              }}
              placeholder="Type answer..."
              autoComplete="off"
            />
            {isRevealed && (
              <div className="h-8 w-8 flex items-center justify-center text-green-400">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5"></path>
                </svg>
              </div>
            )}
          </div>
        );
        lastIndex = gapRegex.lastIndex;
        gapIndex++;
      }
      
      // Add any trailing text
      if (lastIndex < line.length) {
        parts.push(line.slice(lastIndex));
      }
      
      // Calculate progress for this line's gaps
      const totalGaps = gapIndex;
      const filledGaps = Object.entries(gapStates || {}).filter(([key, state]) => 
        key.startsWith(lineKey) && (state.similarity > 0.6 || state.isRevealed)
      ).length;
      
      elements.push(
        <div
          key={lineKey}
          className="my-6 bg-neutral-850 border border-neutral-700 rounded-lg shadow-lg p-5 transition-all"
        >
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-neutral-700">
            <div className="flex items-center">
              <span className="text-lg font-semibold text-neutral-100">Fill in the gaps</span>
            </div>
            
            {/* Progress indicator */}
            <div className="flex items-center space-x-3">
              <div className="text-sm text-neutral-400 font-medium">
                {filledGaps}/{totalGaps} completed
              </div>
              <div className="w-24 h-2 bg-neutral-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-neutral-500 transition-all duration-300"
                  style={{ width: `${totalGaps > 0 ? (filledGaps / totalGaps) * 100 : 0}%` }}
                ></div>
              </div>
            </div>
          </div>
          
          <div className="py-2 leading-relaxed text-neutral-200">{parts}</div>
          
          {/* Grade with Xenova button in bottom right */}
          <div className="flex justify-end mt-4 pt-3 border-t border-neutral-800">
            <Button
              type="button"
              size="sm"
              className="bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-medium border border-neutral-700 transition-colors duration-150"
              onClick={async () => {
                // Process all gaps in this line with Xenova similarity
                const gapKeys = Object.keys(gapStates || {}).filter(key => key.startsWith(lineKey));
                
                for (const key of gapKeys) {
                  const state = gapStates?.[key];
                  if (state && !state.isRevealed && state.value.length > 0) {
                    // Extract the answer from the key pattern
                    const gapMatch = Array.from(line.matchAll(gapRegex));
                    const gapIndex = parseInt(key.split('-gap-')[1] || '0');
                    const answer = gapMatch[gapIndex]?.[1] || '';
                    
                    // Get similarity using Xenova
                    const sim = await getSimilarity?.(state.value, answer) || 0;
                    
                    // Update state with the similarity score
                    setGapStates?.((prev: any) => ({
                      ...prev,
                      [key]: { ...prev[key], similarity: sim },
                    }));
                  }
                }
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                <path d="m9 11-6 6v3h9l3-3"></path>
                <path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"></path>
              </svg>
              Grade with AI
            </Button>
          </div>
        </div>
      );
      continue;
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
    // Tree/Mermaid diagram block
    if (line.startsWith("```tree") || line.startsWith("```mermaid")) {
      processList();
      processTable();
      processInfoBox();
      processMathBlock();
      if (inMcqBlock) processMcqBlock();
      let diagramLines: string[] = [];
      let j = i + 1;
      // Collect all lines until the closing ```
      while (j < lines.length && !lines[j].trim().startsWith("```")) {
        diagramLines.push(lines[j]);
        j++;
      }
      // Skip the closing ``` line as well
      i = j;
      const diagramCode = diagramLines.join("\n");
      // Get category color classes
      const category = noteCategory || 'teal';
      const { bg, accent, border } = getCategoryColorClass ? getCategoryColorClass(category) : { bg: 'bg-teal-100', accent: 'bg-teal-500', border: 'border-teal-300' };
      elements.push(
        <div
          key={`tree-diagram-${elements.length}`}
          className={`my-10 rounded-3xl border ${border} bg-white/60 dark:bg-neutral-900/60 backdrop-blur-xl shadow-lg transition-all duration-200 hover:shadow-[0_8px_16px_0_rgba(31,41,55,0.10)] hover:${border} group`}
          style={{ overflow: 'hidden', position: 'relative', fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif' }}
        >
          <div className={`flex items-center gap-3 px-8 pt-7 pb-3 border-b ${border} bg-gradient-to-r from-white/70 via-white/60 to-white/40 dark:from-neutral-900/80 dark:via-neutral-900/30 dark:to-neutral-900/60 backdrop-blur-md`}>
            <div className={`flex items-center justify-center w-11 h-11 rounded-xl ${accent} group-hover:${accent} transition`}>
              <svg xmlns='http://www.w3.org/2000/svg' className='w-6 h-6 text-white dark:text-neutral-100' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth='2'><path strokeLinecap='round' strokeLinejoin='round' d='M12 4v16m8-8H4' /></svg>
            </div>
            <span className="font-semibold text-lg md:text-xl text-neutral-800 dark:text-neutral-100 tracking-tight drop-shadow-sm">Diagram</span>
            <span className={`ml-auto text-xs ${accent} font-mono uppercase tracking-wider`}>Mermaid</span>
          </div>
          <div className="px-8 py-8 bg-transparent">
            <MermaidDiagram code={diagramCode} theme={useTheme().theme} />
          </div>
        </div>
      );
      continue;
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
  if (inDragDrop) processDragDropBlock();

  return <>{elements}</> // Return a fragment
}

import { getSentenceEmbedding, cosineSimilarity } from "../actions/xenova-similarity";

// Drag and Drop Block Component
const DragDropItem = React.memo(({ 
  pair, 
  index, 
  userAnswer, 
  showAnswers, 
  onDrop, 
  onRemove,
  theme 
}: { 
  pair: { left: string, right: string },
  index: number,
  userAnswer?: string,
  showAnswers: boolean,
  onDrop: (e: React.DragEvent, index: number) => void,
  onRemove: (index: number) => void,
  theme: "dark" | "light"
}) => {
  const getDropColor = useCallback(() => {
    if (!showAnswers) return theme === "dark" ? "bg-neutral-800 border-neutral-700" : "bg-gray-100 border-gray-300";
    const correct = pair.right;
    if (userAnswer === correct) return theme === "dark" ? "bg-green-900/30 border-green-700 text-green-200" : "bg-green-100 border-green-500 text-green-800";
    if (userAnswer) return theme === "dark" ? "bg-red-900/30 border-red-700 text-red-200" : "bg-red-100 border-red-500 text-red-800";
    return theme === "dark" ? "bg-neutral-800 border-neutral-700" : "bg-gray-100 border-gray-300";
  }, [showAnswers, theme, pair.right, userAnswer]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.add('border-blue-500');
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('border-blue-500');
  }, []);

  return (
    <div className="flex items-center gap-3">
      <span className="min-w-[80px] font-medium text-neutral-200">{pair.left}</span>
      <div
        className={`flex-1 min-w-[120px] min-h-[38px] px-3 py-2 border rounded-md transition-all duration-200 flex items-center ${getDropColor()}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={(e) => onDrop(e, index)}
        data-index={index}
      >
        {userAnswer ? (
          <span className="inline-block font-mono text-base">
            {userAnswer}
            {showAnswers && userAnswer !== pair.right && (
              <span className="ml-2 text-xs text-red-400">(Wrong)</span>
            )}
            {showAnswers && userAnswer === pair.right && (
              <span className="ml-2 text-xs text-green-400">(Correct)</span>
            )}
          </span>
        ) : (
          <span className="text-neutral-400">Drop here</span>
        )}
      </div>
      {userAnswer && !showAnswers && (
        <button
          className="ml-2 text-xs text-neutral-400 hover:text-red-400"
          onClick={() => onRemove(index)}
          title="Remove answer"
        >
          <XIcon size={16} />
        </button>
      )}
    </div>
  );
});

const DragDropOption = React.memo(({ 
  option, 
  isUsed, 
  onDragStart,
  theme 
}: { 
  option: string,
  isUsed: boolean,
  onDragStart: (e: React.DragEvent, option: string) => void,
  theme: "dark" | "light"
}) => (
  <div
    className={`cursor-move px-3 py-1.5 rounded-md border font-mono text-base select-none transition-all ${
      isUsed 
        ? 'opacity-40 cursor-not-allowed' 
        : theme === "dark" 
          ? 'bg-neutral-700 border-neutral-600 text-neutral-100 hover:bg-neutral-600' 
          : 'bg-gray-200 border-gray-400 text-gray-800 hover:bg-gray-300'
    }`}
    draggable={!isUsed}
    onDragStart={(e) => onDragStart(e, option)}
    style={{ pointerEvents: isUsed ? 'none' : 'auto' }}
  >
    {option}
  </div>
));

type DragDropState = {
  answers: Record<number, string>;
  showAnswers: boolean;
};

type DragDropAction = 
  | { type: 'SET_ANSWER'; index: number; answer: string }
  | { type: 'REMOVE_ANSWER'; index: number }
  | { type: 'RESET' }
  | { type: 'SHOW_ANSWERS' };

const dragDropReducer = (state: DragDropState, action: DragDropAction): DragDropState => {
  switch (action.type) {
    case 'SET_ANSWER':
      return {
        ...state,
        answers: { ...state.answers, [action.index]: action.answer }
      };
    case 'REMOVE_ANSWER':
      const newAnswers = { ...state.answers };
      delete newAnswers[action.index];
      return { ...state, answers: newAnswers };
    case 'RESET':
      return { answers: {}, showAnswers: false };
    case 'SHOW_ANSWERS':
      return { ...state, showAnswers: true };
    default:
      return state;
  }
};

const DragDropBlock = ({ question, pairs, options, userAnswers, setUserAnswers, showAnswers, setShowAnswers, theme }: {
  question: string,
  pairs: { left: string, right: string }[],
  options: string[],
  userAnswers: Record<number, string>,
  setUserAnswers: React.Dispatch<React.SetStateAction<Record<number, string>>>,
  showAnswers: boolean,
  setShowAnswers: (show: boolean) => void,
  theme: "dark" | "light"
}) => {
  const [state, dispatch] = React.useReducer(dragDropReducer, {
    answers: userAnswers,
    showAnswers
  });

  const usedOptions = useMemo(() => 
    Object.values(state.answers).filter(v => v !== undefined && v !== null),
    [state.answers]
  );
  
  const [shuffledOptions] = useState(() => {
    const shuffled = [...options];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  });

  const handleDragStart = useCallback((e: React.DragEvent, option: string) => {
    e.dataTransfer.setData("text/plain", option);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('border-blue-500');
    
    const option = e.dataTransfer.getData("text/plain");
    if (option && !usedOptions.includes(option)) {
      dispatch({ type: 'SET_ANSWER', index, answer: option });
      setUserAnswers(prev => ({ ...prev, [index]: option }));
    }
  }, [usedOptions, setUserAnswers]);

  const handleRemoveAnswer = useCallback((index: number) => {
    dispatch({ type: 'REMOVE_ANSWER', index });
    setUserAnswers(prev => {
      const newAnswers = { ...prev };
      delete newAnswers[index];
      return newAnswers;
    });
  }, [setUserAnswers]);

  const handleReset = useCallback(() => {
    dispatch({ type: 'RESET' });
    setUserAnswers({});
    setShowAnswers(false);
  }, [setUserAnswers, setShowAnswers]);

  const handleCheckAnswers = useCallback(() => {
    dispatch({ type: 'SHOW_ANSWERS' });
    setShowAnswers(true);
  }, [setShowAnswers]);

  return (
    <div className={`my-6 ${theme === "dark" ? 'border border-neutral-700 bg-neutral-800/40 rounded-lg shadow-md p-5' : 'bg-white rounded-lg shadow-md p-6 border border-gray-200'}`}>
      <div className="mb-4 font-semibold text-lg text-neutral-100">{question}</div>
      <div className="flex flex-col gap-3 mb-6">
        {pairs.map((pair, idx) => (
          <DragDropItem
            key={idx}
            pair={pair}
            index={idx}
            userAnswer={state.answers[idx]}
            showAnswers={state.showAnswers}
            onDrop={handleDrop}
            onRemove={handleRemoveAnswer}
            theme={theme}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-2 mb-4">
        {shuffledOptions.map((opt, i) => (
          <DragDropOption
            key={i}
            option={opt}
            isUsed={usedOptions.includes(opt)}
            onDragStart={handleDragStart}
            theme={theme}
          />
        ))}
      </div>
      <div className="flex justify-end">
        <Button
          type="button"
          size="sm"
          className="bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-medium border border-neutral-700 transition-colors duration-150"
          onClick={handleReset}
        >
          Reset
        </Button>
        <Button
          type="button"
          size="sm"
          className="ml-3 bg-blue-700 hover:bg-blue-600 text-white font-medium border border-blue-800 transition-colors duration-150"
          onClick={handleCheckAnswers}
        >
          Check Answers
        </Button>
      </div>
    </div>
  );
};

interface NoteCardProps {
  note: Note
  focusedNoteId: string | null
  activeNoteRef: React.RefObject<HTMLDivElement>
  theme: string | undefined
  startEditingNote: (note: Note) => void
  handleDeleteNote: (noteId: string) => void
  setNoteForFlashcards: (note: Note | null) => void
  setIsFlashcardsDialogOpen: (open: boolean) => void
  inlineEditingNoteId: string | null
  handleSaveInlineEdit: (noteId: string, content: string) => Promise<void>
  setInlineEditingNoteId: (noteId: string | null) => void
  mcqStates: Record<string, any>
  handleMcqOptionClick: (blockId: string | number, optionIndex: number, isCorrect: boolean) => void
  shuffledMcqOptionsRef: React.MutableRefObject<Record<string, any>>
  gapStates: Record<string, { value: string; similarity: number; isRevealed?: boolean }>
  setGapStates: React.Dispatch<React.SetStateAction<Record<string, { value: string; similarity: number; isRevealed?: boolean }>>>
  getSimilarity: (input: string, answer: string) => Promise<number>
  dragDropStates: Record<string, { answers: Record<number, string>; showAnswers: boolean }>
  setDragDropStates: React.Dispatch<React.SetStateAction<Record<string, { answers: Record<number, string>; showAnswers: boolean }>>>
  onSelectNote: (noteId: string) => void
}

// Update the NoteCard component for modern color styling
const NoteCard = React.memo(function NoteCard({
  note,
  focusedNoteId,
  activeNoteRef,
  theme,
  startEditingNote,
  handleDeleteNote,
  setNoteForFlashcards,
  setIsFlashcardsDialogOpen,
  inlineEditingNoteId,
  handleSaveInlineEdit,
  setInlineEditingNoteId,
  mcqStates,
  handleMcqOptionClick,
  shuffledMcqOptionsRef,
  gapStates,
  setGapStates,
  getSimilarity,
  dragDropStates,
  setDragDropStates,
  onSelectNote
}: NoteCardProps) {
  const [inlineEditContent, setInlineEditContent] = useState(note.content);
  const inlineEditRef = useRef<HTMLTextAreaElement>(null);
  const isDark = theme === "dark";
  const isActive = focusedNoteId === note.id;

  // Update the category color map to use the same color scheme as info boxes
  const categoryColorMap: { [key: string]: { bg: string, accent: string, border: string } } = {
    biology: isDark 
      ? { bg: "bg-green-900/30", accent: "bg-green-500/80", border: "border-green-700/60" }
      : { bg: "bg-green-100", accent: "bg-green-500/70", border: "border-green-300" },
    chemistry: isDark 
      ? { bg: "bg-rose-900/30", accent: "bg-rose-500/80", border: "border-rose-700/60" }
      : { bg: "bg-rose-100", accent: "bg-rose-500/70", border: "border-rose-300" },
    physics: isDark 
      ? { bg: "bg-amber-900/30", accent: "bg-amber-400/80", border: "border-amber-700/60" }
      : { bg: "bg-amber-100", accent: "bg-amber-500/70", border: "border-amber-300" },
    english: isDark 
      ? { bg: "bg-blue-900/30", accent: "bg-blue-500/80", border: "border-blue-700/60" }
      : { bg: "bg-blue-100", accent: "bg-blue-500/70", border: "border-blue-300" },
    math: isDark 
      ? { bg: "bg-purple-900/30", accent: "bg-purple-500/80", border: "border-purple-700/60" }
      : { bg: "bg-purple-100", accent: "bg-purple-500/70", border: "border-purple-300" },
    history: isDark 
      ? { bg: "bg-orange-900/30", accent: "bg-orange-500/80", border: "border-orange-700/60" }
      : { bg: "bg-orange-100", accent: "bg-orange-500/70", border: "border-orange-300" },
    art: isDark 
      ? { bg: "bg-pink-900/30", accent: "bg-pink-500/80", border: "border-pink-700/60" }
      : { bg: "bg-pink-100", accent: "bg-pink-500/70", border: "border-pink-300" },
    music: isDark 
      ? { bg: "bg-indigo-900/30", accent: "bg-indigo-500/80", border: "border-indigo-700/60" }
      : { bg: "bg-indigo-100", accent: "bg-indigo-500/70", border: "border-indigo-300" },
    computer: isDark 
      ? { bg: "bg-cyan-900/30", accent: "bg-cyan-500/80", border: "border-cyan-700/60" }
      : { bg: "bg-cyan-100", accent: "bg-cyan-500/70", border: "border-cyan-300" },
    programming: isDark 
      ? { bg: "bg-teal-900/30", accent: "bg-teal-500/80", border: "border-teal-700/60" }
      : { bg: "bg-teal-100", accent: "bg-teal-500/70", border: "border-teal-300" },
  };

  const getCategoryColorClass = (category: string): { bg: string, accent: string, border: string } => {
    const lowerCategory = category.toLowerCase().trim();
    return categoryColorMap[lowerCategory] || (isDark 
      ? { bg: "bg-neutral-800/30", accent: "bg-neutral-500/80", border: "border-neutral-700/60" }
      : { bg: "bg-gray-100", accent: "bg-gray-400/70", border: "border-gray-300" });
  };

  const categoryColors = getCategoryColorClass(note.category);

  useEffect(() => {
    if (inlineEditingNoteId === note.id) {
      setInlineEditContent(note.content);
      setTimeout(() => {
        inlineEditRef.current?.focus();
      }, 50);
    }
  }, [inlineEditingNoteId, note.id, note.content]);

  const onSave = useCallback(() => {
    handleSaveInlineEdit(note.id, inlineEditContent);
  }, [handleSaveInlineEdit, note.id, inlineEditContent]);

  const handleCardClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (
      e.target instanceof Element && 
      (e.target.tagName === 'BUTTON' || 
       e.target.tagName === 'INPUT' || 
       e.target.tagName === 'A' ||
       e.target.closest('button') ||
       e.target.closest('input') ||
       e.target.closest('a'))
    ) {
      return;
    }
    
    onSelectNote(note.id);
  }, [note.id, onSelectNote]);
  
  return (
    <Card
      key={note.id}
      id={`note-${note.id}`}
      ref={isActive ? activeNoteRef : null}
      onClick={handleCardClick}
      className={`
        bg-neutral-900 border-neutral-800 border-[0.5px] rounded-xl 
        transition-all duration-300 ease-in-out 
        hover:shadow-2xl hover:scale-[1.008] hover:translate-y-[-2px]
        data-[focused='true']:ring-2 data-[focused='true']:ring-blue-500/60
        data-[focused='true']:shadow-2xl
        mx-0 w-full overflow-hidden
        ${isDark ? "bg-neutral-900/95" : "bg-white/95 border-neutral-200"}
      `}
      style={{
        backdropFilter: 'blur(10px)',
        boxShadow: isDark 
          ? isActive 
            ? '0 20px 40px -15px rgba(0, 0, 0, 0.6), 0 0 15px -5px rgba(0, 0, 0, 0.3)'
            : '0 8px 16px -8px rgba(0, 0, 0, 0.5)'
          : isActive 
            ? '0 20px 40px -15px rgba(0, 0, 0, 0.2), 0 0 15px -5px rgba(0, 0, 0, 0.08)'
            : '0 8px 16px -8px rgba(0, 0, 0, 0.1)',
        transformOrigin: 'center top'
      }}
      data-focused={isActive}
    >
      {/* Modern category color bar */}
      <div className={`${categoryColors.bg} p-0.5 border-b ${categoryColors.border}`}>
        <div className={`h-1 w-16 ${categoryColors.accent} rounded-full mx-auto`}></div>
      </div>
      
      <div className="relative overflow-hidden">
        <div className="p-6 md:p-8 pt-4">
          <div className="flex justify-between items-start mb-4 md:mb-6 pb-3 md:pb-4 border-b border-neutral-700/50">
            <h3 className={`text-2xl md:text-3xl font-bold mr-2 ${isDark ? "text-neutral-50" : "text-gray-800"}`}>
              {note.title}
            </h3>
            <div className="flex items-center space-x-2">
              <div className="flex gap-1.5 md:gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    startEditingNote(note);
                  }}
                  className={`p-2 rounded-full ${isDark 
                    ? "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/80" 
                    : "text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100/80"} 
                    transition-colors cursor-pointer`}
                  aria-label="Edit note"
                >
                  <PencilIcon className="h-4 w-4" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteNote(note.id);
                  }}
                  className={`p-2 rounded-full ${isDark 
                    ? "text-neutral-400 hover:text-red-300 hover:bg-red-950/30" 
                    : "text-neutral-500 hover:text-red-600 hover:bg-red-50"} 
                    transition-colors cursor-pointer`}
                  aria-label="Delete note"
                >
                  <Trash2Icon className="h-4 w-4" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setNoteForFlashcards(note);
                    setIsFlashcardsDialogOpen(true);
                  }}
                  className={`p-2 rounded-full ${isDark 
                    ? "text-neutral-400 hover:text-blue-300 hover:bg-blue-950/30" 
                    : "text-neutral-500 hover:text-blue-600 hover:bg-blue-50"} 
                    transition-colors cursor-pointer`}
                  aria-label="Create flashcards from note"
                >
                  <FlaskConical className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
          
          <div className={`prose-custom max-w-none text-sm md:text-base ${isDark ? "text-neutral-300" : "text-neutral-700"}`}>
            {inlineEditingNoteId === note.id ? (
              <div className="relative">
                <Textarea
                  ref={inlineEditRef}
                  value={inlineEditContent}
                  onChange={(e) => setInlineEditContent(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  className={`min-h-[300px] w-full rounded-lg ${isDark 
                    ? "bg-neutral-800/70 border-neutral-700 text-neutral-100 placeholder:text-neutral-500 focus:border-neutral-500 focus:ring-neutral-500" 
                    : "bg-gray-50 border-gray-200 text-gray-800 placeholder:text-gray-400 focus:border-gray-300 focus:ring-gray-300"} 
                    font-mono text-sm p-4`}
                  placeholder="Edit your note content..."
                />
                <div className="flex justify-end mt-4 space-x-3">
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      setInlineEditingNoteId(null);
                    }}
                    variant="outline"
                    className={`${isDark 
                      ? "bg-neutral-800 border-neutral-700 text-neutral-300 hover:bg-neutral-700 hover:text-neutral-100" 
                      : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-800"} 
                      cursor-pointer`}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSave();
                    }}
                    className={`${isDark 
                      ? "bg-blue-600 hover:bg-blue-700 text-white" 
                      : "bg-blue-600 hover:bg-blue-700 text-white"} 
                      font-semibold py-2 px-4 rounded-lg shadow-sm cursor-pointer`}
                  >
                    Save Changes
                  </Button>
                </div>
              </div>
            ) : (
              <div id={`note-content-${note.id}`} className="mt-2">
                {renderNoteContent(note.content, mcqStates, handleMcqOptionClick, shuffledMcqOptionsRef.current, gapStates, setGapStates, getSimilarity, dragDropStates, setDragDropStates, note.category, getCategoryColorClass)}
              </div>
            )}
          </div>
          
          <div className={`flex items-center justify-between text-xs mt-6 md:mt-8 pt-3 md:pt-4 border-t ${isDark ? "border-neutral-800" : "border-gray-200"}`}>
            <div className={`flex items-center ${isDark ? "text-neutral-500" : "text-gray-500"}`}>
              <span className={`mr-2 px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wide ${categoryColors.bg} ${categoryColors.border} border 
                ${isDark ? "text-neutral-200" : "text-gray-700"}`}>
                {note.category.charAt(0).toUpperCase() + note.category.slice(1)}
              </span>
              <span className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 mr-1">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z" clipRule="evenodd" />
                </svg>
                {new Date(note.created_at).toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" })}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}, (prevProps, nextProps) => {
  // Existing comparison logic
  const isThisNotesFocusStatusChanged = 
    (prevProps.note.id === prevProps.focusedNoteId) !== (nextProps.note.id === nextProps.focusedNoteId);
  const isThisNoteBeingEdited = 
    (prevProps.note.id === prevProps.inlineEditingNoteId) !== (nextProps.note.id === nextProps.inlineEditingNoteId);
  
  if (
    prevProps.note.id !== nextProps.note.id ||
    prevProps.note.title !== nextProps.note.title ||
    prevProps.note.content !== nextProps.note.content ||
    prevProps.note.category !== nextProps.note.category ||
    isThisNotesFocusStatusChanged ||
    isThisNoteBeingEdited ||
    (prevProps.theme !== nextProps.theme)
  ) {
    return false; // Return false to trigger re-render
  }
  
  return true; // Return true to prevent re-render
});

type NoteCardPassthroughProps = Omit<NoteCardProps, 'note'>;

interface NotesListProps extends NoteCardPassthroughProps {
  notes: Note[];
  visibleCount: number;
  isLoadingMore: boolean;
  hasMoreNotes: boolean;
  loadMoreRef: React.RefObject<HTMLDivElement>;
}

const NotesList = React.memo(function NotesList({ notes, visibleCount, isLoadingMore, hasMoreNotes, loadMoreRef, ...rest }: NotesListProps) {
  const visibleNotes = notes.slice(0, visibleCount);
  
  return (
    <>
      {visibleNotes.map((note) => (
        <NoteCard
          key={note.id}
          note={note}
          {...rest}
        />
      ))}
      
      {/* Load more trigger */}
      {hasMoreNotes && (
        <div 
          ref={loadMoreRef}
          className="flex justify-center py-8"
        >
          {isLoadingMore ? (
            <div className="flex items-center space-x-2 text-neutral-400">
              <div className="w-4 h-4 border-2 border-neutral-600 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-sm">Loading more notes...</span>
            </div>
          ) : (
            <div className="h-8" /> // Invisible trigger for intersection observer
          )}
        </div>
      )}
      
      {/* End of notes indicator */}
      {!hasMoreNotes && notes.length > 0 && (
        <div className="text-center py-8 text-neutral-500 text-sm">
          You've reached the end of your notes
        </div>
      )}
    </>
  );
});

export default function NotesPage() {
  const { session, user, isLoading: authIsLoading, error: authError, signOut } = useAuth();
  const router = useRouter();
  const supabase = createClient();
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";
  const [allNotes, setAllNotes] = useState<Note[]>([]);
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [displayedNotes, setDisplayedNotes] = useState<Note[]>([]);
  const [subheadings, setSubheadings] = useState<string[]>([]);
  const [currentNoteHeadings, setCurrentNoteHeadings] = useState<{ text: string; level: number }[]>([]);
  const [availableCategories, setAvailableCategories] = useState<string[]>([])
  const [highlightedText, setHighlightedText] = useState<string>("")
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [showGapInstructions, setShowGapInstructions] = useState<boolean>(true)
  
  // Sidebar collapse state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Virtual scrolling state
  const [visibleNotesCount, setVisibleNotesCount] = useState(5);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreNotes, setHasMoreNotes] = useState(true);

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
  const [isQuizDialogOpen, setIsQuizDialogOpen] = useState(false);
  const [generatedQuestions, setGeneratedQuestions] = useState<any[]>([]);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [quizError, setQuizError] = useState<string | null>(null);
  const [currentQuizNoteTitle, setCurrentQuizNoteTitle] = useState<string | null>(null);
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [showQuizResults, setShowQuizResults] = useState(false);
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

  // Fill-in-the-gap state: { [gapKey]: { value, similarity, isRevealed } }
  const [gapStates, setGapStates] = useState<Record<string, { value: string; similarity: number; isRevealed?: boolean }>>({});

  // Drag and Drop state
  const [dragDropStates, setDragDropStates] = useState<Record<string, { answers: Record<number, string>, showAnswers: boolean }>>({});

  // State for inline editing
  const [inlineEditingNoteId, setInlineEditingNoteId] = useState<string | null>(null)

  const [isGeneratingImages, setIsGeneratingImages] = useState(false);
  const [selectedImageModel, setSelectedImageModel] = useState<ImageModel>("flux");

  const notesContainerRef = useRef<HTMLDivElement>(null)
  const activeNoteRef = useRef<HTMLDivElement>(null) as React.RefObject<HTMLDivElement>
  const loadMoreRef = useRef<HTMLDivElement>(null) as React.RefObject<HTMLDivElement>

  // Utility for similarity grading
  const getSimilarity = async (input: string, answer: string): Promise<number> => {
    if (!input || !answer) return 0;
    try {
      // Optionally spellcheck here
      const [embA, embB] = await Promise.all([
        getSentenceEmbedding(input),
        getSentenceEmbedding(answer),
      ]);
      return cosineSimilarity(embA, embB);
    } catch (e) {
      console.error("[GAP SIMILARITY ERROR]", e);
      return 0;
    }
  };

  // Load more notes function
  const loadMoreNotes = useCallback(() => {
    if (isLoadingMore || !hasMoreNotes) return;
    
    setIsLoadingMore(true);
    
    // Simulate loading delay for better UX
    setTimeout(() => {
      setVisibleNotesCount(prev => {
        const newCount = prev + 5;
        const hasMore = newCount < displayedNotes.length;
        setHasMoreNotes(hasMore);
        return newCount;
      });
      setIsLoadingMore(false);
    }, 300);
  }, [isLoadingMore, hasMoreNotes, displayedNotes.length]);

  // Intersection observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && hasMoreNotes && !isLoadingMore) {
          loadMoreNotes();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => {
      if (loadMoreRef.current) {
        observer.unobserve(loadMoreRef.current);
      }
    };
  }, [loadMoreNotes, hasMoreNotes, isLoadingMore]);

  // Reset virtual scrolling when displayed notes change
  useEffect(() => {
    setVisibleNotesCount(5);
    setHasMoreNotes(displayedNotes.length > 5);
  }, [displayedNotes.length]);

  // Ensure focused note is visible
  useEffect(() => {
    if (focusedNoteId && displayedNotes.length > 0) {
      const focusedNoteIndex = displayedNotes.findIndex(note => note.id === focusedNoteId);
      if (focusedNoteIndex >= 0 && focusedNoteIndex >= visibleNotesCount) {
        // If focused note is beyond visible count, expand to show it
        const newCount = Math.max(visibleNotesCount, focusedNoteIndex + 5); // Show 5 more notes after the focused one
        setVisibleNotesCount(newCount);
        setHasMoreNotes(newCount < displayedNotes.length);
      }
    }
  }, [focusedNoteId, displayedNotes, visibleNotesCount]);

  const handleMcqOptionClick = useCallback((blockId: number | string, optionIndex: number, isCorrect: boolean) => {
    const blockKey = typeof blockId === 'number' ? blockId.toString() : blockId;
    setMcqStates(prev => ({
      ...prev,
      [blockKey]: {
        ...prev[blockKey],
        selectedIndex: optionIndex,
        showAnswers: true
      }
    }));
  }, []);

  const fetchNotes = useCallback(async () => {
    setIsLoading(true)
    try {
      if (!user) {
        setErrorMessage("You must be logged in to view notes")
        setAllNotes([])
        return
      }

      const { data, error } = await supabase
        .from("notes")
        .select("*")
        .eq("user_id", user.id)
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
  }, [supabase, user]);

  // Handle saving inline edits
  const handleSaveInlineEdit = useCallback(async (noteId: string, content: string) => {
    if (!noteId || !content) {
      setErrorMessage("Cannot save empty content or no note selected for inline edit.");
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("notes")
        .update({ content: content, updated_at: new Date().toISOString() })
        .eq("id", noteId);

      if (error) {
        console.error("Error updating note:", error);
        setErrorMessage(`Error updating note: ${error.message}`);
        // Potentially, throw error to be caught by the outer catch if needed for more complex scenarios
      } else {
        setErrorMessage("Note updated successfully!");
        setTimeout(() => setErrorMessage(null), 2000);
        
        // Update local state immediately for responsiveness
        const updateNotesState = (prevNotes: Note[]) => prevNotes.map(note => 
          note.id === noteId
            ? { ...note, content: content, updated_at: new Date().toISOString() } 
            : note
        );
        setAllNotes(updateNotesState);

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
  }, [supabase, fetchNotes, setAllNotes, setInlineEditingNoteId]);

  const handleAddNote = useCallback(async (note: Omit<Note, "id" | "created_at" | "updated_at" | "user_id" | "flashcards">) => {
    setIsLoading(true);
    let errorResult: string | undefined;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("You must be logged in to add a note.");
      }
      const noteToInsert = { ...note, user_id: user.id };
      const { data, error } = await supabase.from("notes").insert(noteToInsert).select().single();
      if (error) throw error;

      await fetchNotes();
      if (data) {
        if (selectedSidebarCategory === "all" || data.category === selectedSidebarCategory) {
          setFocusedNoteId(data.id);
        }
      }
    } catch (error: any) {
      console.error("Supabase error adding note:", error);
      errorResult = error.message || "An unexpected error occurred.";
    } finally {
      setIsLoading(false);
    }
    return errorResult;
  }, [fetchNotes, selectedSidebarCategory, supabase]);

  const handleEditNote = useCallback(async (note: Note) => {
    setIsLoading(true);
    let errorResult: string | undefined;
    try {
      const { error } = await supabase
        .from("notes")
        .update({
          title: note.title,
          content: note.content,
          category: note.category.trim().toLowerCase(),
        })
        .eq("id", note.id);

      if (error) throw error;
      
      await fetchNotes(); // Refresh all notes
    } catch (error: any) {
      console.error("Supabase error updating note:", error);
      errorResult = error.message || "An unexpected error occurred.";
    } finally {
      setIsLoading(false);
    }
    return errorResult;
  }, [fetchNotes, supabase]);

  const startEditingNote = useCallback((note: Note) => {
    setEditingNote(note);
    setIsEditNoteDialogOpen(true);
  }, []);

  // Listen for Ctrl+S to toggle sidebar
  useEffect(() => {
    const handleSidebarToggle = (e: KeyboardEvent) => {
      if (e.ctrlKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        setSidebarCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleSidebarToggle);
    return () => window.removeEventListener('keydown', handleSidebarToggle);
  }, []);

  // Protect route - redirect to login if not authenticated
  useEffect(() => {
    if (!authIsLoading && !session) {
      router.push('/');
    }
  }, [session, authIsLoading, router]);

  // Fetch notes when authenticated
  useEffect(() => {
    if (session) {
      fetchNotes();
    }
  }, [session, fetchNotes])

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
      
      // Check if the image URL is a base64 string
      const isBase64 = imageUrl.startsWith('data:image/') && imageUrl.includes(';base64,')
      
      // If it's a base64 image, use it directly, otherwise use the URL
      const imageSrc = isBase64 ? imageUrl : imageUrl

      const updatedContent = currentTextareaContent.replace(
        activeEditorContext.originalTag,
        `![${imageSearchQuery}](${imageSrc})`
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
            // This part of logic needs to be adapted as we can't directly call handleSaveInlineEdit without content
            // For now, we'll just let it be, the user can click the save button.
            // A more advanced solution would be to use a ref to get the content from the card.
            return;
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
            }
          }
        }
      } else if (e.key === "Escape" && inlineEditingNoteId) {
        // Cancel inline editing on Escape key
        setInlineEditingNoteId(null)
      } else if (e.key === "Enter" && e.ctrlKey && inlineEditingNoteId) {
        // Save changes on Ctrl+Enter
        // This is tricky now. We can't directly call save.
        // The user should use the save button.
        // Or we would need to trigger a save on the specific NoteCard instance.
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [allNotes, inlineEditingNoteId, handleSaveInlineEdit, fetchNotes, supabase, focusedNoteId])

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
    /* Enhanced scrollbar hiding */
    .no-scrollbar::-webkit-scrollbar {
      display: none !important;
      width: 0 !important;
      height: 0 !important;
    }
    .no-scrollbar {
      -ms-overflow-style: none !important;
      scrollbar-width: none !important;
    }
    /* Hide all scrollbars in the app */
    ::-webkit-scrollbar {
      width: 0px !important;
      height: 0px !important;
      display: none !important;
    }
    * {
      scrollbar-width: none !important;
      -ms-overflow-style: none !important;
    }
  `
    // Append to head
    document.head.appendChild(styleElement)

    // Cleanup function
    return () => {
      document.head.removeChild(styleElement)
    }
  }, [theme])

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

  // Replace original handleNoteSelectInSidebar with optimized version
  const handleNoteSelectInSidebar = useCallback((noteId: string) => {
    if (focusedNoteId !== noteId) {
      setFocusedNoteId(noteId);
    }
  }, [focusedNoteId]);

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

  // Replace original clearFocus with optimized version
  const clearFocus = useCallback((e: React.MouseEvent) => {
    // Only clear if we're clicking directly on the background container, not on any child
    if (e.target === e.currentTarget) {
      setFocusedNoteId(null);
    }
  }, []);

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
      setQuizError("Please select a note to generate quiz questions from.");
      return;
    }
    const noteToGenerateFrom = allNotes.find((note) => note.id === focusedNoteId);
    if (!noteToGenerateFrom) {
      setQuizError("Focused note not found.");
      return;
    }

    setIsGeneratingQuiz(true);
    setQuizError(null);
    setGeneratedQuestions([]);
    setUserAnswers({});
    setShowQuizResults(false);
    setCurrentQuizNoteTitle(noteToGenerateFrom.title);

    try {
      const response = await fetch("/api/quiz-me", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: noteToGenerateFrom.content,
          numQuestions: 5,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate quiz questions from API.");
      }

      const data = await response.json();
      if (data.questions && data.questions.length > 0) {
        setGeneratedQuestions(data.questions);
        setIsQuizDialogOpen(true);
      } else {
        setQuizError("No quiz questions were generated for this note. The content might be too short or not suitable.");
      }
    } catch (error: any) {
      console.error("Error generating quiz questions:", error);
      setQuizError(error.message || "An unexpected error occurred while generating quiz questions.");
    } finally {
      setIsGeneratingQuiz(false);
    }
  }

  const handleMcqOptionSelect = (questionIndex: number, option: string) => {
    setUserAnswers((prev) => ({ ...prev, [questionIndex]: option }))
  }

  const handleSubmitMcqs = () => {
    setShowQuizResults(true)
  }

  const calculateMcqScore = () => {
    let correctCount = 0
    generatedQuestions.forEach((mcq, index) => {
      if (userAnswers[index] === mcq.correctAnswer) {
        correctCount++
      }
    })
    return {
      correct: correctCount,
      total: generatedQuestions.length,
      percentage: generatedQuestions.length > 0 ? (correctCount / generatedQuestions.length) * 100 : 0,
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

  const extractImageTags = (content: string): string[] => {
    const matches = content.match(/!\(img\)\[(.*?)\]/g) || [];
    return matches.map(tag => {
      const match = tag.match(/!\(img\)\[(.*?)\]/);
      return match ? match[1] : '';
    }).filter(Boolean);
  };

  const generateImageFromTag = async (prompt: string): Promise<string> => {
    try {
      const result = await generateImage(prompt, selectedImageModel);
      if (result.data && result.data.length > 0) {
        return `data:image/png;base64,${result.data[0].b64_json}`;
      }
      throw new Error("No image data received");
    } catch (error) {
      console.error("Error generating image:", error);
      throw error;
    }
  };

  const handleGenerateImagesFromTags = async (content: string, contextType: 'newNote' | 'editNote') => {
    setIsGeneratingImages(true);
    try {
      const imageTags = extractImageTags(content);
      let updatedContent = content;

      for (const tag of imageTags) {
        try {
          const imageData = await generateImageFromTag(tag);
          const originalTag = `!(img)[${tag}]`;
          const markdownImage = `![${tag}](${imageData})`;
          updatedContent = updatedContent.replace(originalTag, markdownImage);
        } catch (err) {
          console.error(`Failed to generate image for tag: ${tag}`, err);
          // Continue with other tags even if one fails
        }
      }

      // Update the content based on context
      if (contextType === 'newNote') {
        setNewNote(prev => ({ ...prev, content: updatedContent }));
      } else if (contextType === 'editNote') {
        setEditingNote(prev => prev ? ({ ...prev, content: updatedContent }) : null);
      }

      toast({
        title: "Success",
        description: "Generated images for all image tags",
      });
    } catch (err) {
      console.error("Error generating images:", err);
      toast({
        title: "Error",
        description: "Failed to generate some images",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingImages(false);
    }
  };

  const [isSyntaxHelpOpen, setIsSyntaxHelpOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey) {
        if (e.key === "h" || e.key === "H") {
          e.preventDefault();
          setIsSyntaxHelpOpen(true);
          return;
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [allNotes, inlineEditingNoteId, handleSaveInlineEdit, fetchNotes, supabase, focusedNoteId]);

  // Helper: Syntax documentation content
  const SyntaxDocs = ({ isDark }: { isDark: boolean }) => (
    <div className="flex flex-col md:flex-row gap-0 md:gap-8 w-full">
      {/* Sidebar: Syntax & Shortcuts */}
      <aside className={`md:w-80 w-full md:rounded-l-2xl rounded-t-2xl md:rounded-t-none p-6 md:p-8 flex-shrink-0 border-r ${isDark ? 'bg-neutral-950/95 border-neutral-800' : 'bg-white/95 border-neutral-200'} shadow-none`}>
        <h2 className="flex items-center gap-2 text-2xl font-extrabold mb-6 tracking-tight text-neutral-900 dark:text-neutral-100">
          <SparklesIcon className={`inline-block h-6 w-6 ${isDark ? 'text-neutral-200' : 'text-neutral-800'}`} /> Syntax Guide
        </h2>
        <ul className="mb-8 space-y-1 text-sm text-neutral-700 dark:text-neutral-300">
          <li><b>Headings:</b> <code># Heading 1</code>, <code>## Heading 2</code>, <code>### Heading 3</code></li>
          <li><b>Bold:</b> <code>**bold**</code> or <code>__bold__</code></li>
          <li><b>Italic:</b> <code>*italic*</code> or <code>_italic_</code></li>
          <li><b>Highlight:</b> <code>==highlight==</code></li>
          <li><b>Strikethrough:</b> <code>~~strikethrough~~</code></li>
          <li><b>Links:</b> <code>[text](url)</code></li>
          <li><b>Images:</b> <code>![alt](url)</code> or <code>![alt|maxheight=300](url)</code></li>
          <li><b>LaTeX Math:</b> <code>$inline$</code> or <code>$$block$$</code></li>
          <li><b>Horizontal Rule:</b> <code>---</code></li>
          <li><b>Info Boxes:</b> <code>::blue</code> ... <code>::</code> (also purple, green, amber, rose)</li>
          <li><b>Tables:</b> <code>| Col1 | Col2 |</code></li>
          <li><b>Lists:</b> <code>- item</code> or <code>* item</code></li>
          <li><b>MCQ Block:</b> <code>?? Question</code> then <code>[x] Correct</code> <code>[ ] Incorrect</code></li>
          <li><b>Fill-in-the-gap:</b> <code>[gap:answer]</code></li>
          <li><b>Drag & Drop:</b> <code>::dragdrop</code> ... <code>::</code> (see docs)</li>
          <li><b>Diagrams:</b> <code>{'```mermaid'}</code> ... <code>{'```'}</code></li>
        </ul>
        <h3 className="flex items-center gap-2 text-base font-semibold mb-3 text-neutral-900 dark:text-neutral-100">
          <Keyboard className={`inline-block h-4 w-4 ${isDark ? 'text-neutral-400' : 'text-neutral-700'}`} /> Shortcuts
        </h3>
        <ul className="mb-2 space-y-1 text-sm text-neutral-700 dark:text-neutral-300">
          <li><b>Ctrl+K</b>: AI chat about selected text</li>
          <li><b>Ctrl+B</b>: Highlight/unhighlight selected text</li>
          <li><b>Ctrl+E</b>: Edit note inline or toggle AI assistant</li>
          <li><b>Ctrl+S</b>: Toggle sidebar</li>
          <li><b>Ctrl+H</b>: Show this help</li>
        </ul>
      </aside>
      {/* Main: Examples and AI Format */}
      <main className={`flex-1 min-w-0 p-6 md:p-10 flex flex-col justify-between bg-neutral-50 dark:bg-neutral-950 rounded-b-2xl md:rounded-r-2xl md:rounded-bl-none`}> 
        <div>
          <h3 className="flex items-center gap-2 text-lg font-bold mb-4 text-neutral-900 dark:text-neutral-100">
            <InfoIcon className={`inline-block h-5 w-5 ${isDark ? 'text-neutral-200' : 'text-neutral-800'}`} /> Examples
          </h3>
          <div
            className={`rounded-xl border shadow overflow-x-auto p-4 mt-2 ${isDark ? 'bg-neutral-900/80 border-neutral-800' : 'bg-white/80 border-neutral-200'}`}
            style={{
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              boxShadow: isDark
                ? '0 4px 16px rgba(0,0,0,0.10), 0 1.5px 0 0 rgba(255,255,255,0.01)'
                : '0 4px 16px rgba(0,0,0,0.04), 0 1.5px 0 0 rgba(0,0,0,0.01)',
            }}
          >
            <pre className="text-xs leading-relaxed whitespace-pre-wrap break-words font-mono text-neutral-900 dark:text-neutral-100 bg-transparent">
{`# Biology Notes

## Cell Structure
- Nucleus
- Mitochondria

?? What is the powerhouse of the cell?
[x] Mitochondria
[ ] Ribosome
[ ] Chloroplast

Fill in: The capital of France is [gap:Paris].

::blue
This is an info box!
::

// mermaid code block
mermaid
graph TD; A-->B;
// end mermaid code block`}
            </pre>
          </div>
        </div>
        <div className="flex flex-col md:flex-row justify-end items-center gap-3 mt-10">
          <Button
            onClick={() => setIsSyntaxHelpOpen(false)}
            className={`font-medium px-6 py-2 rounded-lg text-base border ${isDark ? 'bg-neutral-950 hover:bg-neutral-900 text-neutral-100 border-neutral-800' : 'bg-white hover:bg-neutral-100 text-neutral-900 border-neutral-300'}`}
          >
            Close
          </Button>
        </div>
      </main>
    </div>
  );

  // Replace the placeholder for AI format function
  const handleAiFormatNote = async () => {
    if (!focusedNoteId) return;
    const note = allNotes.find(n => n.id === focusedNoteId);
    if (!note) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      // Provide more precise formatting guidelines for the AI
      const formattingGuidelines = `
# Formatting Guidelines for Flashcards App Notes

- Use "# " for the main title (h1), "## " for major sections (h2), and more # for deeper subsections.
- Use bullet lists with "- " or "* ", and numbered lists with "1. ", "2. ", etc.
- Use info boxes for important points or summaries:
  - Syntax: ::color (on its own line), then content, then :: (on its own line)
  - Example:
    ::blue
    This is an info box.
    ::
  - Colors: blue, green, amber, rose, purple
- Use bold (**text**) for emphasis, italic (*text*) for nuance, highlight (==text==) for key terms, and inline code (code) for technical references.
- For LaTeX math:
  - Inline: $E = mc^2$
  - Block: $$\n\\frac{d}{dx}(x^n) = nx^{n-1}\n$$
- For multiple choice questions (MCQ):
  - Start with "?? " followed by the question
  - List options with [x] for correct, [ ] for incorrect, e.g.:
    ?? What is 2+2?
    [x] 4
    [ ] 3
    [ ] 5
- For fill-in-the-gap, embed [gap:answer] in the sentence, e.g.:
  The capital of France is [gap:Paris].
- For drag-and-drop (matching):
  - Start with ::dragdrop (on its own line)
  - Question: ...
  - - Item => [drop:Answer]
  - Options: Option1, Option2, ...
  - End with :: (on its own line)
  - Example:
    ::dragdrop
    Question: Match the capitals.
    - France => [drop:Paris]
    - Germany => [drop:Berlin]
    Options: Paris, Berlin
    ::
- For images, use:
  - ![alt text](url) for direct images
  - !(img)[search term] for AI-generated/search images (e.g. !(img)[cat])
- For tables, use Markdown table syntax:
  | Header1 | Header2 |
  |---------|---------|
  | Row1    | Row2    |
- Use --- (three dashes) for horizontal rules/section breaks.
- Use [text](url) for links.
- Make the note visually rich, easy to scan, and use all relevant formatting features from above where appropriate.
- Do not remove any information from the original note, only improve structure, clarity, and formatting.
`;
      const aiNote = await formatNoteWithGroq(note.content, formattingGuidelines);
      // Update the note in the database
      const { error } = await supabase
        .from("notes")
        .update({ title: aiNote.title, content: aiNote.content, updated_at: new Date().toISOString() })
        .eq("id", note.id);
      if (error) {
        setErrorMessage(`Error updating note: ${error.message}`);
        return;
      }
      // Update local state immediately for responsiveness
      setAllNotes(prevNotes => prevNotes.map(n =>
        n.id === note.id
          ? { ...n, title: aiNote.title, content: aiNote.content, updated_at: new Date().toISOString() }
          : n
      ));
      setDisplayedNotes(prevNotes => prevNotes.map(n =>
        n.id === note.id
          ? { ...n, title: aiNote.title, content: aiNote.content, updated_at: new Date().toISOString() }
          : n
      ));
      setErrorMessage("Note formatted with AI!");
      setTimeout(() => setErrorMessage(null), 2000);
      setIsSyntaxHelpOpen(false);
    } catch (error: any) {
      setErrorMessage(error.message || "Failed to format note with AI.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className={`flex h-screen ${theme === "dark" ? "bg-neutral-950 text-neutral-100" : "bg-gray-50 text-gray-900"}`}
      onClick={clearFocus}
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
      <div
        className={`hidden md:block transition-all duration-500 ease-in-out ${sidebarCollapsed ? 'w-0 min-w-0 opacity-0 pointer-events-none' : 'w-72 lg:w-80 min-w-[18rem] opacity-100'} border-r border-neutral-800 flex-shrink-0 h-screen`}
        style={{overflow: 'hidden'}}
      >
        <NotesSidebar
          notes={allNotes}
          categories={availableCategories}
          selectedCategory={selectedSidebarCategory}
          onSelectCategory={handleCategorySelectFromSidebar}
          onSelectNote={handleNoteSelectInSidebar}
          searchQuery={searchQuery}
          onSearchChange={handleSearch}
          onClearSearch={clearSearch}
          className="h-full border-0 no-scrollbar"
        />
      </div>

      <div 
        className={`flex-1 flex flex-col overflow-hidden transition-all duration-500 ease-in-out
          ${isAiAssistantOpen ? 'md:pr-[350px]' : 'pr-0'}
          ${sidebarCollapsed ? 'max-w-full w-full ml-0' : 'md:ml-0'}
        `}
        style={{
          maxWidth: sidebarCollapsed ? '100vw' : undefined,
          width: sidebarCollapsed ? '100vw' : undefined,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Add expand sidebar button when collapsed */}
        {sidebarCollapsed && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarCollapsed(false)}
            className={`fixed top-4 left-4 z-50 ${theme === "dark" ? "bg-neutral-900/90 text-neutral-100 hover:text-neutral-100 hover:bg-neutral-800 border-neutral-700/50" : "bg-white/90 text-gray-700 hover:text-gray-900 hover:bg-gray-100 border-gray-200/50"} backdrop-blur-lg h-10 w-10 rounded-full border shadow-lg transition-all duration-200`}
            aria-label="Expand sidebar"
          >
            <PanelLeft className="h-5 w-5" />
          </Button>
        )}
        <div ref={notesContainerRef} className="flex-1 overflow-y-auto p-4 pt-14 md:pt-4 md:p-6 lg:p-8 pb-24 scroll-smooth no-scrollbar">
          {/* Search results count - only shown when searching */}
          {searchQuery && (
            <div className="text-xs text-neutral-400 mb-6 ml-1">
              Found {displayedNotes.length} {displayedNotes.length === 1 ? "result" : "results"} for "{searchQuery}"
            </div>
          )}
          <div className="mt-6 space-y-8 md:space-y-10 w-full max-w-4xl mx-auto">
            {isLoading && displayedNotes.length === 0 && (
              <div className="text-center py-10">
                <div className="w-8 h-8 border-4 border-neutral-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-neutral-500">Loading notes...</p>
              </div>
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

            {!isLoading && displayedNotes.length > 0 && (
              <NotesList 
                notes={displayedNotes}
                focusedNoteId={focusedNoteId}
                activeNoteRef={activeNoteRef}
                theme={theme}
                startEditingNote={startEditingNote}
                handleDeleteNote={handleDeleteNote}
                setNoteForFlashcards={setNoteForFlashcards}
                setIsFlashcardsDialogOpen={setIsFlashcardsDialogOpen}
                inlineEditingNoteId={inlineEditingNoteId}
                handleSaveInlineEdit={handleSaveInlineEdit}
                setInlineEditingNoteId={setInlineEditingNoteId}
                mcqStates={mcqStates}
                handleMcqOptionClick={handleMcqOptionClick}
                shuffledMcqOptionsRef={shuffledMcqOptionsRef}
                gapStates={gapStates}
                setGapStates={setGapStates}
                getSimilarity={getSimilarity}
                dragDropStates={dragDropStates}
                setDragDropStates={setDragDropStates}
                onSelectNote={handleNoteSelectInSidebar}
                visibleCount={visibleNotesCount}
                isLoadingMore={isLoadingMore}
                hasMoreNotes={hasMoreNotes}
                loadMoreRef={loadMoreRef}
              />
            )}
          </div>
        </div>

        {/* Floating Bottom Nav Bar with enhanced frosted glass effect */}
        <div 
          className={`fixed bottom-6 ${sidebarCollapsed && !isAiAssistantOpen ? 'left-1/2 -translate-x-1/2 w-[80%] max-w-4xl' : 'left-[calc(18rem+3rem)]'} ${isAiAssistantOpen ? 'right-[calc(350px+2rem)]' : 'right-6'} px-4 py-3 rounded-2xl z-40 flex items-center gap-3 transition-all duration-500 ease-in-out overflow-hidden border backdrop-blur-[32px] shadow-2xl`}
          style={{
            background: theme === "dark"
              ? 'linear-gradient(120deg, rgba(20,20,22,0.68) 0%, rgba(38,38,40,0.52) 100%)'
              : 'linear-gradient(120deg, rgba(255,255,255,0.58) 0%, rgba(245,245,250,0.38) 100%)',
            boxShadow: theme === "dark"
               ? '0 8px 32px 0 rgba(0,0,0,0.32), 0 1.5px 0 0 rgba(255,255,255,0.04)'
               : '0 8px 32px 0 rgba(180,180,200,0.10), 0 1.5px 0 0 rgba(255,255,255,0.10)',
            border: theme === "dark"
              ? '1.5px solid rgba(120,120,140,0.32)'
              : '1.5px solid rgba(200,200,220,0.42)',
            backdropFilter: 'blur(32px) saturate(1.2)',
            WebkitBackdropFilter: 'blur(32px) saturate(1.2)',
          }}
        >
          {/* Glass reflection effect */}
          <div 
            className="absolute inset-0 z-[-1] pointer-events-none"
            style={{
              background: theme === "dark"
                ? 'linear-gradient(120deg, rgba(255,255,255,0.10) 0%, transparent 60%)'
                : 'linear-gradient(120deg, rgba(255,255,255,0.32) 0%, transparent 80%)',
            }}
          />
          {/* Top-left corner blue glow (more distinct) */}
          <div 
            className="absolute top-[-32px] left-[-32px] w-40 h-40 z-[-1] rounded-full opacity-60 blur-[48px] pointer-events-none"
            style={{
              background: theme === "dark" 
                ? 'radial-gradient(circle, rgba(59,130,246,0.22) 0%, transparent 80%)' 
                : 'radial-gradient(circle, rgba(59,130,246,0.18) 0%, transparent 80%)',
              transform: 'translate(-10%, -10%)'
            }}
          />
          {/* Bottom-right corner pink glow (more distinct) */}
          <div 
            className="absolute bottom-[-32px] right-[-32px] w-56 h-40 z-[-1] rounded-full opacity-60 blur-[56px] pointer-events-none"
            style={{
              background: theme === "dark" 
                ? 'radial-gradient(circle, rgba(236,72,153,0.22) 0%, transparent 80%)' 
                : 'radial-gradient(circle, rgba(236,72,153,0.16) 0%, transparent 80%)',
              transform: 'translate(10%, 10%)'
            }}
          />
          <div className="flex items-center space-x-1.5">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsAddNoteDialogOpen(true)}
              className={`p-1.5 rounded-xl backdrop-blur-sm border transition-all duration-200 ${theme === "dark" ? "text-neutral-200 hover:text-white bg-white/5 hover:bg-white/10 border-white/10" : "text-gray-700 hover:text-gray-900 bg-gray-100/50 hover:bg-gray-200/60 border-gray-200/50"}`}
              aria-label="Add new note"
            >
              <PlusCircleIcon className="h-4 w-4" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className={`p-1.5 rounded-xl backdrop-blur-sm border transition-all duration-200 ${theme === "dark" ? "text-neutral-200 hover:text-white bg-white/5 hover:bg-white/10 border-white/10" : "text-gray-700 hover:text-gray-900 bg-gray-100/50 hover:bg-gray-200/60 border-gray-200/50"}`}
              aria-label="Toggle theme"
            >
              {theme === "dark" ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
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
                  width="16"
                  height="16"
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

            <span className={`hidden md:inline-flex items-center text-xs rounded-lg px-1.5 py-0.5 backdrop-blur-sm ${theme === "dark" ? "text-neutral-400 border border-white/10 bg-neutral-800/30" : "text-gray-500 border border-gray-200 bg-gray-100/50"}`}>
              <SparklesIcon className="h-2.5 w-2.5 mr-1" /> <kbd className="font-mono text-[9px]">Ctrl+K</kbd>
            </span>
          </div>

          <div className="flex-grow mx-2 overflow-hidden">
            <ScrollArea className="w-full whitespace-nowrap">
              <div className="flex h-8 items-center space-x-1">
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
                      className={`transition-all rounded-lg px-2 py-1 text-xs ${theme === "dark" ? "text-neutral-300 hover:text-white hover:bg-white/5 data-[state=active]:bg-white/10 data-[state=active]:text-white" : "text-gray-600 hover:text-gray-900 hover:bg-gray-100 data-[state=active]:bg-gray-200 data-[state=active]:text-gray-900"} ${
                        heading.level === 1
                          ? "font-semibold"
                          : heading.level === 2
                            ? "pl-2"
                            : heading.level === 3
                              ? "pl-3 text-xs"
                              : "pl-4 text-xs"
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
                      className={`transition-all rounded-lg px-2 py-1 text-xs ${theme === "dark" ? "text-neutral-300 hover:text-white hover:bg-white/5 data-[state=active]:bg-white/10 data-[state=active]:text-white" : "text-gray-600 hover:text-gray-900 hover:bg-gray-100 data-[state=active]:bg-gray-200 data-[state=active]:text-gray-900"}`}
                    >
                      {sh}
                    </Button>
                  ))
                ) : (
                  <p className={`text-xs px-2 ${theme === "dark" ? "text-neutral-500" : "text-gray-500"}`}>
                    No H2 subheadings (##)
                  </p>
                )}
              </div>
            </ScrollArea>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleGenerateMcqs}
            disabled={isGeneratingQuiz || !focusedNoteId}
            className={`flex-shrink-0 backdrop-blur-sm border rounded-xl px-3 py-1.5 transition-all duration-200 text-xs ${
              theme === "dark" 
                ? "text-neutral-200 bg-white/5 border-white/10" + (!focusedNoteId ? " opacity-60" : " hover:text-white hover:bg-white/10")
                : "bg-gray-100/50 border-gray-200/50" + (!focusedNoteId ? " text-gray-500 opacity-70" : " text-gray-700 hover:text-gray-900 hover:bg-gray-200/60")
            }`}
          >
            {isGeneratingQuiz ? (
              <>
                <SparklesIcon className="h-3 w-3 mr-1.5" /> Generating...
              </>
            ) : (
              <>
                <HelpCircleIcon className="h-3 w-3 mr-1.5" /> Quiz Me
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Add Note Dialog */}
      <AddNoteDialog
        open={isAddNoteDialogOpen}
        onOpenChange={setIsAddNoteDialogOpen}
        availableCategories={availableCategories}
        theme={theme as "dark" | "light" | undefined}
        handleAddNote={handleAddNote}
        isLoading={isLoading}
      />

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

      {/* Edit Note Dialog */}
      <EditNoteDialog
        open={isEditNoteDialogOpen}
        onOpenChange={setIsEditNoteDialogOpen}
        noteToEdit={editingNote}
        onUpdateNote={handleEditNote}
        availableCategories={availableCategories}
        theme={theme as "dark" | "light" | undefined}
        isLoading={isLoading}
      />

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

      <Dialog open={isSyntaxHelpOpen} onOpenChange={setIsSyntaxHelpOpen}>
        <DialogContent
          className={`max-w-4xl w-full rounded-2xl shadow-2xl p-0 sm:p-0 overflow-y-auto max-h-[90vh] border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950`}
          style={{
            boxShadow: isDark
              ? '0 8px 32px rgba(0,0,0,0.7), 0 1.5px 0 0 rgba(255,255,255,0.04)'
              : '0 8px 32px rgba(0,0,0,0.10), 0 1.5px 0 0 rgba(0,0,0,0.01)',
            border: isDark ? '1.5px solid #23272e' : '1.5px solid #e5e7eb',
            backdropFilter: 'blur(18px)',
            WebkitBackdropFilter: 'blur(18px)',
            padding: 0,
          }}
        >
          <div className="relative flex flex-col md:flex-row w-full min-h-[500px]">
            <div className="flex-1 flex flex-col md:flex-row w-full z-10">
              <SyntaxDocs isDark={isDark} />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
