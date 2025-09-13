"use client"

import React from "react"

// Lightweight WYSIWYG editor that round-trips between simplified HTML and Markdown.
// Notes:
// - This intentionally supports a practical subset: headings, paragraphs, bold/italic/inline code,
//   links, images, blockquotes, unordered/ordered lists, and code blocks.
// - It avoids heavy libraries to keep the bundle small and performance high in Next.js.
// - It renders a contentEditable surface; on each input it converts HTML -> Markdown and calls onChange.
// - Advanced custom directives (e.g., gap/mcq/youtube/model/mermaid) are preserved as raw blocks in
//   Markdown mode and shown read-only as <pre> blocks here.

export interface WysiwygEditorProps {
  value: string
  onChange: (markdown: string) => void
  placeholder?: string
  className?: string
}

const sanitize = (html: string) => {
  // Very light sanitize: remove script/style tags
  return html.replace(/<\/(?:script|style)>/gi, "").replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, "")
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

// Minimal Markdown -> HTML for display inside the editor
function mdToHtml(md: string): string {
  // Preserve code blocks first
  const fences: string[] = []
  const FENCE_TOKEN = "@@__FENCE__@@"
  let i = 0
  md = md.replace(/```([\s\S]*?)```/g, (_, code) => {
    fences.push(code)
    return `${FENCE_TOKEN}${i++}${FENCE_TOKEN}`
  })

  // Split into lines for block-level processing
  const lines = md.split(/\r?\n/)
  const out: string[] = []
  let inUl = false
  let inOl = false
  let inBlockquote = false
  // Info box state
  let inIBox: null | { type: string; title: string | null; body: string[] } = null

  const closeLists = () => {
    if (inUl) { out.push("</ul>"); inUl = false }
    if (inOl) { out.push("</ol>"); inOl = false }
  }
  const closeBlockquote = () => { if (inBlockquote) { out.push("</blockquote>"); inBlockquote = false } }

  for (const raw of lines) {
    const line = raw.replace(/\t/g, "  ")
    // Info box fenced start: :::info|warning|tip|note [optional title]
    const iboxOpen = line.match(/^:::(info|warning|tip|note)(?:\s+(.+))?\s*$/i)
    if (iboxOpen) {
      // Close any open blocks
      closeLists(); closeBlockquote()
      const type = iboxOpen[1].toLowerCase()
      const title = (iboxOpen[2] || '').trim() || null
      inIBox = { type, title, body: [] }
      continue
    }
    if (inIBox) {
      const iboxClose = /^:::\s*$/.test(line)
      if (iboxClose) {
        const { type, title, body } = inIBox
        const inner = body
          .map(l => l.trim() ? `<p>${inlineMdToHtml(l)}</p>` : '<p><br/></p>')
          .join('\n')
        out.push(`<div data-ibox="${type}" class="ibox ibox-${type}">` +
          (title ? `<div class="ibox-title">${escapeHtml(title)}</div>` : '') +
          `<div class="ibox-body">${inner}</div></div>`)
        inIBox = null
        continue
      } else {
        inIBox.body.push(line)
        continue
      }
    }
    if (!line.trim()) { // blank line
      closeLists(); closeBlockquote();
      out.push("<p data-empty=\"true\"><br/></p>")
      continue
    }
    // Headings
    const h = line.match(/^(#{1,3})\s+(.*)$/)
    if (h) {
      closeLists(); closeBlockquote();
      const level = h[1].length
      out.push(`<h${level}>${inlineMdToHtml(h[2])}</h${level}>`)
      continue
    }
    // Blockquote
    const bq = line.match(/^>\s?(.*)$/)
    if (bq) {
      closeLists()
      if (!inBlockquote) { out.push("<blockquote>"); inBlockquote = true }
      out.push(`<p>${inlineMdToHtml(bq[1])}</p>`)
      continue
    }
    // Unordered list
    const ul = line.match(/^[-*]\s+(.*)$/)
    if (ul) {
      closeBlockquote()
      if (!inUl) { out.push("<ul>"); inUl = true }
      out.push(`<li>${inlineMdToHtml(ul[1])}</li>`)
      continue
    }
    // Ordered list
    const ol = line.match(/^\d+\.\s+(.*)$/)
    if (ol) {
      closeBlockquote()
      if (!inOl) { out.push("<ol>"); inOl = true }
      out.push(`<li>${inlineMdToHtml(ol[1])}</li>`)
      continue
    }
    // Fenced directive-like raw blocks (non-ibox): leave as <pre>
    if (/^:::\w+/.test(line) || /^```/.test(line)) {
      closeLists(); closeBlockquote();
      out.push(`<pre>${escapeHtml(line)}</pre>`)
      continue
    }
    // Paragraph
    closeBlockquote()
    out.push(`<p>${inlineMdToHtml(line)}</p>`)
  }
  closeLists(); closeBlockquote()

  let html = out.join("\n")
  // Restore fenced code blocks
  html = html.replace(new RegExp(`${FENCE_TOKEN}(\
\d+)${FENCE_TOKEN}`, "g"), (_, idx) => {
    const code = fences[Number(idx)] ?? ""
    return `<pre><code>${escapeHtml(code)}</code></pre>`
  })
  return html
}

function inlineMdToHtml(text: string): string {
  // Images ![alt](url)
  text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2" />')
  // Links [text](url)
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
  // Bold **text**
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  // Italic *text*
  text = text.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>')
  // Inline code `code`
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>')
  // Color directive :rose[Text] -> <span class="c-rose">Text</span>
  text = text.replace(/:([a-z]+)\[([^\]]+)\]/g, '<span class="c-$1">$2</span>')
  return text
}

// Minimal HTML -> Markdown for the subset we render
function htmlToMd(root: HTMLElement): string {
  const blocks: string[] = []

  const walk = (el: Element) => {
    const tag = el.tagName.toLowerCase()
    // Info box back to markdown :::type Title ... :::
    const iboxType = el.getAttribute && el.getAttribute('data-ibox')
    if (iboxType) {
      const titleEl = el.querySelector('.ibox-title')
      const title = titleEl ? (titleEl.textContent || '').trim() : ''
      const bodyEl = el.querySelector('.ibox-body') as HTMLElement | null
      let bodyMd = ''
      if (bodyEl) {
        // Convert child paragraphs back
        const tmp = document.createElement('div')
        tmp.innerHTML = bodyEl.innerHTML
        bodyMd = Array.from(tmp.children).map(c => inlineHtmlToMd(c as Element) || '').join('\n')
      }
      const header = `:::${iboxType}${title ? ' ' + title : ''}`
      blocks.push(header)
      if (bodyMd) blocks.push(bodyMd)
      blocks.push(':::')
      return
    }
    if (tag === "h1" || tag === "h2" || tag === "h3") {
      const level = Number(tag[1])
      blocks.push("#".repeat(level) + " " + inlineHtmlToMd(el))
      return
    }
    if (tag === "ul") {
      const lis = Array.from(el.children).filter(c => c.tagName.toLowerCase() === "li")
      for (const li of lis) blocks.push("- " + inlineHtmlToMd(li))
      return
    }
    if (tag === "ol") {
      const lis = Array.from(el.children).filter(c => c.tagName.toLowerCase() === "li")
      let n = 1
      for (const li of lis) blocks.push(`${n++}. ` + inlineHtmlToMd(li))
      return
    }
    if (tag === "blockquote") {
      const ps = Array.from(el.children)
      for (const p of ps) blocks.push("> " + inlineHtmlToMd(p))
      return
    }
    if (tag === "pre") {
      // For our simplified editor, treat pre contents as-is
      const code = (el.textContent || "").replace(/^\n+|\n+$/g, "")
      blocks.push("```\n" + code + "\n```")
      return
    }
    if (tag === "p") {
      const text = inlineHtmlToMd(el)
      blocks.push(text.trim() ? text : "")
      return
    }
    // Fallback: traverse children and produce paragraphs
    const text = inlineHtmlToMd(el)
    if (text.trim()) blocks.push(text)
  }

  // We consider top-level flow content
  const children = Array.from(root.children)
  for (const child of children) walk(child)

  // Collapse multiple blank lines
  return blocks.join("\n").replace(/\n{3,}/g, "\n\n")
}

function inlineHtmlToMd(el: Element): string {
  let out = ""
  const iter = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      out += (node.textContent || "")
      return
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return
    const e = node as Element
    const tag = e.tagName.toLowerCase()
    if (tag === "strong" || tag === "b") { out += "**" + collectText(e) + "**"; return }
    if (tag === "em" || tag === "i") { out += "*" + collectText(e) + "*"; return }
    if (tag === "code") { out += "`" + collectText(e) + "`"; return }
    if (tag === "a") { const href = e.getAttribute("href") || ""; out += `[${collectText(e)}](${href})`; return }
    if (tag === "img") { const alt = e.getAttribute("alt") || ""; const src = e.getAttribute("src") || ""; out += `![${alt}](${src})`; return }
    if (tag === "span") {
      const cls = e.getAttribute("class") || ""
      const m = cls.match(/c-([a-z]+)/)
      if (m) { out += `:${m[1]}[${collectText(e)}]`; return }
    }
    // For list items and others, descend children
    for (const child of Array.from(e.childNodes)) iter(child)
  }
  for (const child of Array.from(el.childNodes)) iter(child)
  return out
}

function collectText(el: Element): string {
  let s = ""
  el.childNodes.forEach(n => { s += (n.nodeType === Node.TEXT_NODE) ? (n.textContent || "") : collectText(n as Element) })
  return s
}

export const WysiwygEditor: React.FC<WysiwygEditorProps> = ({ value, onChange, placeholder, className }) => {
  const ref = React.useRef<HTMLDivElement | null>(null)
  const [html, setHtml] = React.useState<string>("")
  const internalChange = React.useRef(false)
  // Simple history for undo
  const history = React.useRef<string[]>([])
  const histIndex = React.useRef<number>(-1)
  const FENCE_TOKEN = "@@__FENCE__@@" // ensure not saved

  // Render Markdown -> HTML when value changes externally
  React.useEffect(() => {
    if (internalChange.current) { internalChange.current = false; return }
    const next = mdToHtml(value || "")
    const el = ref.current
    if (el && el.innerHTML !== next) {
      setHtml(next)
      el.innerHTML = next
    }
    // push to history when coming from external value change
    if (history.current.length === 0 || history.current[history.current.length - 1] !== (value || "")) {
      history.current.push(value || "")
      histIndex.current = history.current.length - 1
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const emitChange = React.useCallback(() => {
    const el = ref.current
    if (!el) return
    const clean = sanitize(el.innerHTML)
    setHtml(clean)
    try {
      const wrapper = document.createElement("div")
      // strip any accidental fence tokens before converting/saving
      wrapper.innerHTML = clean.replaceAll(FENCE_TOKEN, "")
      const md = htmlToMd(wrapper)
      if (history.current[histIndex.current] !== md) {
        history.current = history.current.slice(0, histIndex.current + 1)
        history.current.push(md)
        histIndex.current = history.current.length - 1
      }
      internalChange.current = true
      onChange(md)
    } catch {}
  }, [onChange])

  const onInput = React.useCallback(() => {
    emitChange()
  }, [emitChange])

  const onPaste = React.useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    // Allow plain text paste to keep things predictable
    e.preventDefault()
    const text = e.clipboardData.getData("text/plain")
    document.execCommand("insertText", false, text)
  }, [])

  const undo = React.useCallback(() => {
    if (histIndex.current <= 0) return
    histIndex.current -= 1
    const md = history.current[histIndex.current] || ""
    const el = ref.current
    if (!el) return
    const nextHtml = mdToHtml(md)
    internalChange.current = true
    el.innerHTML = nextHtml
    setHtml(nextHtml)
    // Move caret to end to avoid jump-to-start surprises
    try {
      const range = document.createRange()
      range.selectNodeContents(el)
      range.collapse(false)
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(range)
    } catch {}
    onChange(md)
  }, [onChange])

  const onKeyDown = React.useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
      e.preventDefault()
      undo()
    }
  }, [undo])

  return (
    <div
      className={"relative border rounded-lg p-2 min-h-[55vh] focus-within:ring-2 focus-within:ring-neutral-300 dark:focus-within:ring-neutral-700 bg-white/70 dark:bg-neutral-950/40 " + (className || "")}
    >
      {/* Toolbar */}
      <div className="absolute top-1 right-1 flex gap-1">
        <button
          type="button"
          onClick={undo}
          className="text-xs px-2 py-1 rounded-md border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          title="Undo (Ctrl+Z)"
        >Undo</button>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        className="wysi prose prose-neutral dark:prose-invert max-w-none outline-none"
        onInput={onInput}
        onBlur={onInput}
        onPaste={onPaste}
        onKeyDown={onKeyDown}
        data-placeholder={placeholder || "Start typing..."}
        style={{ whiteSpace: "pre-wrap" }}
      />
      <style jsx global>{`
        .wysi p { margin: 0.25rem 0; line-height: 1.4; }
        .wysi h1, .wysi h2, .wysi h3 { margin: 0.5rem 0 0.25rem; line-height: 1.25; }
        .wysi ul, .wysi ol { margin: 0.25rem 0 0.25rem 1.25rem; }
        .wysi blockquote { margin: 0.5rem 0; padding-left: 0.75rem; border-left: 3px solid rgba(0,0,0,0.15); }
        .wysi pre { margin: 0.5rem 0; padding: 0.5rem; }
        .wysi [data-empty="true"] { min-height: 1rem; }
        .wysi .ibox { border: 1px solid var(--ibox-border, #e5e7eb); border-radius: 0.5rem; padding: 0.5rem 0.75rem; margin: 0.5rem 0; background: var(--ibox-bg, #fafafa); }
        .wysi .ibox-title { font-weight: 600; margin-bottom: 0.25rem; }
        .wysi .ibox-info { --ibox-bg: #eef6ff; --ibox-border: #bfdbfe; }
        .wysi .ibox-warning { --ibox-bg: #fff7ed; --ibox-border: #fcd9bd; }
        .wysi .ibox-tip { --ibox-bg: #ecfdf5; --ibox-border: #bbf7d0; }
        .wysi .ibox-note { --ibox-bg: #f5f3ff; --ibox-border: #ddd6fe; }
      `}</style>
    </div>
  )
}
