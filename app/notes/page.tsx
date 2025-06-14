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
  PanelLeft
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
  setDragDropStates?: React.Dispatch<React.SetStateAction<Record<string, { answers: Record<number, string>; showAnswers: boolean }>>>
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
  activeNoteRef: React.RefObject<HTMLDivElement> | null
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
}

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
  setDragDropStates
}: NoteCardProps) {
  const [inlineEditContent, setInlineEditContent] = useState(note.content);
  const inlineEditRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (inlineEditingNoteId === note.id) {
      setInlineEditContent(note.content);
      setTimeout(() => {
        inlineEditRef.current?.focus();
      }, 50);
    }
  }, [inlineEditingNoteId, note.id, note.content]);

  const onSave = () => {
    handleSaveInlineEdit(note.id, inlineEditContent);
  };
  
  return (
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
              handleDeleteNote(note.id);
            }}
            className="text-neutral-400 hover:text-neutral-300 text-xs transition-colors"
            aria-label="Delete note"
          >
            Delete
          </button>
          <button
            onClick={() => {
              setNoteForFlashcards(note);
              setIsFlashcardsDialogOpen(true);
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
                onClick={onSave}
                className="bg-neutral-900 dark:bg-neutral-800 hover:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-900 dark:text-neutral-100 font-semibold py-2.5 rounded-lg shadow-md transition-colors duration-150 focus:ring-2 focus:ring-neutral-600 dark:focus:ring-neutral-600 focus:ring-offset-2 focus:ring-offset-neutral-100 dark:focus:ring-offset-neutral-900 border border-neutral-200 dark:border-neutral-700"
              >
                Save Changes
              </Button>
            </div>
          </div>
        ) : (
          <div id={`note-content-${note.id}`}>{renderNoteContent(note.content, mcqStates, handleMcqOptionClick, shuffledMcqOptionsRef.current, gapStates, setGapStates, getSimilarity, dragDropStates, setDragDropStates)}</div>
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
  );
});

type NoteCardPassthroughProps = Omit<NoteCardProps, 'note'>;

interface NotesListProps extends NoteCardPassthroughProps {
  notes: Note[];
}

const NotesList = React.memo(function NotesList({ notes, ...rest }: NotesListProps) {
  return (
    <>
      {notes.map((note) => (
        <NoteCard
          key={note.id}
          note={note}
          {...rest}
        />
      ))}
    </>
  );
});

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
  const [showGapInstructions, setShowGapInstructions] = useState<boolean>(true)
  
  // Sidebar collapse state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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

  // Fill-in-the-gap state: { [gapKey]: { value, similarity, isRevealed } }
  const [gapStates, setGapStates] = useState<Record<string, { value: string; similarity: number; isRevealed?: boolean }>>({});

  // Drag and Drop state
  const [dragDropStates, setDragDropStates] = useState<Record<string, { answers: Record<number, string>, showAnswers: boolean }>>({});

  // State for inline editing
  const [inlineEditingNoteId, setInlineEditingNoteId] = useState<string | null>(null)

  const [isGeneratingImages, setIsGeneratingImages] = useState(false);
  const [selectedImageModel, setSelectedImageModel] = useState<ImageModel>("flux");

  const notesContainerRef = useRef<HTMLDivElement>(null)
  const activeNoteRef = useRef<HTMLDivElement | null>(null)

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
        // Potentially throw error to be caught by the outer catch if needed for more complex scenarios
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
          className="h-full border-0"
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
            />
          </div>
        </div>

        {/* Floating Bottom Nav Bar with enhanced frosted glass effect */}
        <div 
          className={`fixed bottom-6 ${sidebarCollapsed && !isAiAssistantOpen ? 'left-1/2 -translate-x-1/2 w-[80%] max-w-4xl' : 'left-[calc(18rem+3rem)]'} ${isAiAssistantOpen ? 'right-[calc(350px+2rem)]' : 'right-6'} px-3 py-2.5 rounded-2xl backdrop-blur-3xl z-20 flex items-center justify-between gap-3 transition-all duration-500 ease-in-out overflow-hidden`}
          style={{
            background: theme === "dark" 
              ? 'linear-gradient(135deg, rgba(23, 23, 23, 0.45) 0%, rgba(38, 38, 38, 0.35) 100%)' 
              : 'linear-gradient(135deg, rgba(255, 255, 255, 0.6) 0%, rgba(255, 255, 255, 0.4) 100%)',
            boxShadow: theme === "dark"
              ? '0 8px 32px rgba(0, 0, 0, 0.5), inset 0 1px 0 0 rgba(255, 255, 255, 0.08)'
              : '0 8px 32px rgba(0, 0, 0, 0.15), inset 0 1px 0 0 rgba(255, 255, 255, 0.8)',
            border: theme === "dark"
              ? '1px solid rgba(255, 255, 255, 0.12)'
              : '1px solid rgba(255, 255, 255, 0.8)'
          }}
        >
          {/* Glass reflection effect */}
          <div 
            className="absolute inset-0 z-[-1]"
            style={{
              background: theme === "dark"
                ? 'linear-gradient(to bottom, rgba(255, 255, 255, 0.05) 0%, transparent 50%)'
                : 'linear-gradient(to bottom, rgba(255, 255, 255, 0.6) 0%, transparent 60%)'
            }}
          ></div>
          
          {/* Top-left corner glow */}
          <div 
            className="absolute top-0 left-0 w-20 h-20 z-[-1] rounded-full opacity-60 blur-md"
            style={{
              background: theme === "dark" 
                ? 'radial-gradient(circle, rgba(103, 232, 249, 0.3) 0%, transparent 70%)' 
                : 'radial-gradient(circle, rgba(59, 130, 246, 0.3) 0%, transparent 70%)',
              transform: 'translate(-30%, -30%)'
            }}
          ></div>
          
          {/* Bottom-right corner glow */}
          <div 
            className="absolute bottom-0 right-0 w-20 h-20 z-[-1] rounded-full opacity-60 blur-md"
            style={{
              background: theme === "dark" 
                ? 'radial-gradient(circle, rgba(217, 70, 239, 0.3) 0%, transparent 70%)' 
                : 'radial-gradient(circle, rgba(236, 72, 153, 0.3) 0%, transparent 70%)',
              transform: 'translate(30%, 30%)'
            }}
          ></div>
          
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

          <ScrollArea className={`whitespace-nowrap flex-grow mx-2 ${sidebarCollapsed && !isAiAssistantOpen ? 'max-w-none' : 'max-w-[50vw]'}`}>
            <div className="flex space-x-1 items-center h-8">
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
            <ScrollBar orientation="horizontal" className={theme === "dark" ? "[&>div]:bg-neutral-700/50 hover:[&>div]:bg-neutral-600/60" : "[&>div]:bg-gray-300/50 hover:[&>div]:bg-gray-400/60"} />
          </ScrollArea>

          {focusedNoteId && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleGenerateMcqs}
              disabled={isGeneratingMcqs}
              className={`flex-shrink-0 backdrop-blur-sm border rounded-xl px-3 py-1.5 transition-all duration-200 text-xs ${theme === "dark" ? "text-neutral-200 hover:text-white bg-white/5 hover:bg-white/10 border-white/10" : "text-gray-700 hover:text-gray-900 bg-gray-100/50 hover:bg-gray-200/60 border-gray-200/50"}`}
            >
              {isGeneratingMcqs ? (
                <>
                  <SparklesIcon className="h-3 w-3 mr-1.5" /> Generating...
                </>
              ) : (
                <>
                  <HelpCircleIcon className="h-3 w-3 mr-1.5" /> Quiz Me
                </>
              )}
            </Button>
          )}
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
    </div>
  );
}
