"use client"

import { Button } from "@/components/ui/button"
import { FileDown } from "lucide-react"

export function MarkdownTemplate() {
  const templateContent = `# JavaScript Basics
A deck about core JavaScript concepts

## What is a closure?
A closure is the combination of a function bundled together with references to its surrounding state (the lexical environment).

## What is hoisting?
Hoisting is JavaScript's default behavior of moving declarations to the top of the current scope.

## What is the difference between let and var?
var is function scoped while let is block scoped. Also, let doesn't allow redeclaration and isn't hoisted to the top.

## What is the event loop?
The event loop is a programming construct that waits for and dispatches events in a program.
`

  const downloadTemplate = () => {
    const blob = new Blob([templateContent], { type: "text/markdown" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "flashcards-template.md"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <Button variant="outline" size="sm" onClick={downloadTemplate}>
      <FileDown className="mr-2 h-4 w-4" />
      Download Template
    </Button>
  )
}
