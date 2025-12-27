"use client"

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import rehypeHighlight from 'rehype-highlight'
import 'katex/dist/katex.min.css'

interface MarkdownCardContentProps {
    content: string
    className?: string
}

export function MarkdownCardContent({ content, className = '' }: MarkdownCardContentProps) {
    return (
        <div className={`markdown-content prose dark:prose-invert max-w-none break-words ${className}`}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex, rehypeHighlight]}
                components={{
                    // Override headings to fit card sizes better if needed, or rely on prose
                    h1: ({ node, ...props }) => <h1 className="text-2xl font-bold mt-2 mb-2" {...props} />,
                    h2: ({ node, ...props }) => <h2 className="text-xl font-semibold mt-2 mb-2" {...props} />,
                    h3: ({ node, ...props }) => <h3 className="text-lg font-medium mt-1 mb-1" {...props} />,
                    p: ({ node, ...props }) => <p className="leading-snug mb-2 last:mb-0" {...props} />,
                    // Adjust code block styling
                    code: ({ node, inline, className, children, ...props }: any) => {
                        const match = /language-(\w+)/.exec(className || '')
                        return !inline ? (
                            <code className={`${className} block bg-neutral-100 dark:bg-neutral-800 rounded p-2 my-2 overflow-x-auto text-sm`} {...props}>
                                {children}
                            </code>
                        ) : (
                            <code className={`${className} bg-neutral-100 dark:bg-neutral-800 rounded px-1 py-0.5 text-sm`} {...props}>
                                {children}
                            </code>
                        )
                    }
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    )
}
