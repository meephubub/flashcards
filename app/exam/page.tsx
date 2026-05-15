'use client'

import { AppSidebar } from "@/components/notes/app-sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import React, { useState, useRef, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Upload, Loader2, Trash2, PenTool, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"

// Client-only libraries will be dynamically imported to avoid SSR evaluation errors
let ort: any = null
let pdfjs: any = null

// Polyfill for DOMMatrix if not available (only runs in browser)
if (typeof window !== 'undefined' && !(window as any).DOMMatrix) {
  // @ts-ignore
  ;(window as any).DOMMatrix = class DOMMatrix {
    a: number = 1
    b: number = 0
    c: number = 0
    d: number = 1
    e: number = 0
    f: number = 0
    constructor(init?: string | number[]) {
      if (Array.isArray(init)) {
        ;[this.a, this.b, this.c, this.d, this.e, this.f] = init
      }
    }
  }
}

interface Detection {
  class: string
  confidence: number
  x1: number
  y1: number
  x2: number
  y2: number
}

export default function ExamPage() {
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [pdfDoc, setPdfDoc] = useState<any | null>(null) // pdfjs types are loaded dynamically
  const [numPages, setNumPages] = useState<number>(0)
  const [currentImage, setCurrentImage] = useState<string | null>(null)
  const [currentIndex, setCurrentIndex] = useState<number>(0)
  const [loading, setLoading] = useState(false)
  const [detecting, setDetecting] = useState(false)
  const [detections, setDetections] = useState<Detection[]>([])
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({})
  const [writtenAnswers, setWrittenAnswers] = useState<Record<string, string>>({})
  const [canvasRefs, setCanvasRefs] = useState<Record<string, HTMLCanvasElement | null>>({})
  const [modelLoaded, setModelLoaded] = useState(false)
  const [session, setSession] = useState<any | null>(null) // ort session
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const renderTaskRef = useRef<any | null>(null)
  
  // Drawing state
  const [activeDrawingQuestion, setActiveDrawingQuestion] = useState<string | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const drawingCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawingCtxRef = useRef<CanvasRenderingContext2D | null>(null)
  const [penColor, setPenColor] = useState('#000000')
  const [penSize, setPenSize] = useState(2)

  // Load client-only libs and model on mount
  useEffect(() => {
    const loadResources = async () => {
      try {
        // Dynamically import pdfjs and set worker (client only)
        if (typeof window !== 'undefined') {
          if (!pdfjs) {
            pdfjs = await import('pdfjs-dist')
            pdfjs.GlobalWorkerOptions.workerSrc = new URL(
              'pdfjs-dist/build/pdf.worker.min.mjs',
              import.meta.url
            ).toString()
          }
        }

        // Dynamically import ONNX runtime and load model
        if (typeof window !== 'undefined') {
          if (!ort) {
            const ortModule = await import('onnxruntime-web')
            ort = ortModule
          }

          try {
            ort.env.wasm.numThreads = 1
            ort.env.wasm.simd = true

            const modelPath = '/models/label/best.onnx'
            const sess = await ort.InferenceSession.create(modelPath)
            setSession(sess)
            setModelLoaded(true)
            console.log('ONNX model loaded successfully')
          } catch (error) {
            console.error('Failed to load ONNX model:', error)
            toast.error('Failed to load detection model. Please convert the model to ONNX format.')
          }
        }
      } catch (error) {
        console.error('Failed to load client resources:', error)
      }
    }

    loadResources()
  }, [])

  // Render a specific PDF page to an image
  const renderPageToImage = useCallback(async (pdf: any, pageNum: number): Promise<string> => {
    const page = await pdf.getPage(pageNum)
    
    // Cancel any previous render task
    if (renderTaskRef.current) {
      renderTaskRef.current.cancel()
    }
    
    // Set scale for good quality (300 DPI equivalent)
    const scale = 2
    const viewport = page.getViewport({ scale })
    
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Failed to get canvas context')
    
    canvas.width = viewport.width
    canvas.height = viewport.height
    
    const renderContext = {
      canvasContext: context,
      viewport: viewport,
      canvas: canvas
    }
    
    renderTaskRef.current = page.render(renderContext)
    await renderTaskRef.current.promise
    
    // Convert to data URL
    const dataUrl = canvas.toDataURL('image/png')
    renderTaskRef.current = null
    
    return dataUrl
  }, [])

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.type !== 'application/pdf') {
      toast.error('Please upload a PDF file')
      return
    }

    setPdfFile(file)
    setLoading(true)
    setDetections([])
    setSelectedAnswers({})
    setWrittenAnswers({})

    try {
      // Ensure pdfjs is loaded
      if (!pdfjs && typeof window !== 'undefined') {
        pdfjs = await import('pdfjs-dist')
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.min.mjs',
          import.meta.url
        ).toString()
      }

      // Load PDF using pdf.js
      const arrayBuffer = await file.arrayBuffer()
      const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise
      
      setPdfDoc(pdf)
      setNumPages(pdf.numPages)
      
      // Render first page
      const firstPageImage = await renderPageToImage(pdf, 1)
      setCurrentImage(firstPageImage)
      setCurrentIndex(0)
      
      toast.success(`PDF loaded: ${pdf.numPages} pages`)
    } catch (error) {
      console.error('Error loading PDF:', error)
      toast.error('Failed to load PDF. Make sure it\'s a valid PDF file.')
    } finally {
      setLoading(false)
    }
  }, [renderPageToImage])

  // Store padding info for coordinate transformation
  const paddingRef = useRef<{ padX: number; padY: number; scale: number }>({ padX: 0, padY: 0, scale: 1 })

  // Preprocess image for YOLO model with letterboxing to maintain aspect ratio
  const preprocessImage = useCallback(async (imageSrc: string): Promise<any> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Failed to get canvas context'))
          return
        }

        const targetSize = 640
        canvas.width = targetSize
        canvas.height = targetSize

        // Calculate letterbox dimensions to maintain aspect ratio
        const imgWidth = img.width
        const imgHeight = img.height
        const scale = Math.min(targetSize / imgWidth, targetSize / imgHeight)
        const newWidth = imgWidth * scale
        const newHeight = imgHeight * scale

        // Calculate padding
        const padX = (targetSize - newWidth) / 2
        const padY = (targetSize - newHeight) / 2

        // Store padding info for later coordinate transformation
        paddingRef.current = { padX, padY, scale }

        // Fill with gray background (114, 114, 114) - standard for YOLO
        ctx.fillStyle = 'rgb(114, 114, 114)'
        ctx.fillRect(0, 0, targetSize, targetSize)

        // Draw image with letterboxing
        ctx.drawImage(img, padX, padY, newWidth, newHeight)

        // Get image data and convert to tensor
        const imageData = ctx.getImageData(0, 0, targetSize, targetSize)
        const { data, width, height } = imageData
        const input = new Float32Array(3 * width * height)

        // Convert RGB to normalized format (0-1) in CHW format
        for (let i = 0; i < data.length; i += 4) {
          input[i / 4] = data[i] / 255.0 // R
          input[i / 4 + width * height] = data[i + 1] / 255.0 // G
          input[i / 4 + 2 * width * height] = data[i + 2] / 255.0 // B
        }

        // Create tensor using ort if available
        if (!ort) {
          reject(new Error('ONNX runtime not loaded'))
          return
        }

        const tensor = new ort.Tensor('float32', input, [1, 3, 640, 640])
        resolve(tensor)
      }
      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = imageSrc
    })
  }, [])

  // Calculate IoU for NMS (works with percentage-based coordinates)
  const calculateIoU = useCallback((box1: Detection, box2: Detection): number => {
    const x1 = Math.max(box1.x1, box2.x1)
    const y1 = Math.max(box1.y1, box2.y1)
    const x2 = Math.min(box1.x2, box2.x2)
    const y2 = Math.min(box1.y2, box2.y2)
    
    const intersectionWidth = Math.max(0, x2 - x1)
    const intersectionHeight = Math.max(0, y2 - y1)
    const intersectionArea = intersectionWidth * intersectionHeight
    
    const box1Area = (box1.x2 - box1.x1) * (box1.y2 - box1.y1)
    const box2Area = (box2.x2 - box2.x1) * (box2.y2 - box2.y1)
    
    const unionArea = box1Area + box2Area - intersectionArea
    return unionArea > 0 ? intersectionArea / unionArea : 0
  }, [])

  // Postprocess YOLOv8 output to get detections
  const postprocessOutput = useCallback((output: any[], originalWidth: number, originalHeight: number): Detection[] => {
    const detections: Detection[] = []
    const [output0] = output
    const data = output0.data as Float32Array
    const dims = output0.dims
    
    console.log('ONNX Output dims:', dims)
    console.log('ONNX Output sample:', data.slice(0, 10))
    
    if (dims.length !== 3) {
      console.error('Unexpected output format:', dims)
      return []
    }
    
    const batch = dims[0]
    const features = dims[1]
    const numAnchors = dims[2]
    const numClasses = features - 4
    
    console.log(`Batch: ${batch}, Features: ${features}, Anchors: ${numAnchors}, Classes: ${numClasses}`)
    
    const confidenceThreshold = 0.25
    const iouThreshold = 0.45
    const maxDetections = 50 // Cap at 50 detections
    
    // Transpose data: [features, anchors] -> [anchors, features]
    for (let i = 0; i < numAnchors; i++) {
      const x = data[i + 0 * numAnchors] // x center
      const y = data[i + 1 * numAnchors] // y center
      const w = data[i + 2 * numAnchors] // width
      const h = data[i + 3 * numAnchors] // height
      
      let maxClassScore = 0
      let maxClassIdx = 0
      for (let c = 0; c < numClasses; c++) {
        const classScore = data[i + (4 + c) * numAnchors]
        if (classScore > maxClassScore) {
          maxClassScore = classScore
          maxClassIdx = c
        }
      }
      
      const confidence = maxClassScore
      
      if (confidence > confidenceThreshold) {
        const { padX, padY, scale } = paddingRef.current
        
        const imgCenterX = (x - padX) / scale
        const imgCenterY = (y - padY) / scale
        const imgW = w / scale
        const imgH = h / scale
        
        const x1 = imgCenterX - imgW / 2
        const y1 = imgCenterY - imgH / 2
        const x2 = imgCenterX + imgW / 2
        const y2 = imgCenterY + imgH / 2
        
        const clampedX1 = Math.max(0, Math.min(originalWidth, x1))
        const clampedY1 = Math.max(0, Math.min(originalHeight, y1))
        const clampedX2 = Math.max(0, Math.min(originalWidth, x2))
        const clampedY2 = Math.max(0, Math.min(originalHeight, y2))
        
        if (clampedX2 > clampedX1 && clampedY2 > clampedY1) {
          const x1_pct = (clampedX1 / originalWidth) * 100
          const y1_pct = (clampedY1 / originalHeight) * 100
          const x2_pct = (clampedX2 / originalWidth) * 100
          const y2_pct = (clampedY2 / originalHeight) * 100
          
          const classNames = ['multiple_choice', 'written_question']
          const className = classNames[maxClassIdx] || `class_${maxClassIdx}`
          
          detections.push({
            class: className,
            confidence: confidence,
            x1: x1_pct,
            y1: y1_pct,
            x2: x2_pct,
            y2: y2_pct
          })
        }
      }
    }
    
    console.log(`Raw detections before NMS: ${detections.length}`)
    
    detections.sort((a, b) => b.confidence - a.confidence)
    
    const nmsDetections: Detection[] = []
    for (const det of detections) {
      if (nmsDetections.length >= maxDetections) break
      
      let keep = true
      for (const kept of nmsDetections) {
        const iou = calculateIoU(det, kept)
        if (iou > iouThreshold) {
          keep = false
          break
        }
      }
      if (keep) {
        nmsDetections.push(det)
      }
    }
    
    console.log(`Detections after NMS: ${nmsDetections.length}`)
    return nmsDetections
  }, [calculateIoU])

  const handleDetect = useCallback(async () => {
    if (!currentImage || !session) {
      if (!modelLoaded) {
        toast.error('Model not loaded. Please wait or convert the model to ONNX format.')
      }
      return
    }

    setDetecting(true)
    try {
      // Get original image dimensions
      const img = new Image()
      img.crossOrigin = 'anonymous'
      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = reject
        img.src = currentImage
      })
      const originalWidth = img.width
      const originalHeight = img.height

      // Preprocess image
      const inputTensor = await preprocessImage(currentImage)
      
      // Run inference
      const feeds = { images: inputTensor }
      const output = await session.run(feeds)
      
      // Postprocess output
      const detections = postprocessOutput(Object.values(output), originalWidth, originalHeight)
      
      setDetections(detections)
      toast.success(`Detected ${detections.length} questions`)
    } catch (error) {
      console.error('Error detecting questions:', error)
      toast.error('Failed to detect questions')
    } finally {
      setDetecting(false)
    }
  }, [currentImage, session, modelLoaded, preprocessImage, postprocessOutput])

  const handlePageChange = useCallback(async (index: number) => {
    if (!pdfDoc || index < 0 || index >= numPages) return
    
    setLoading(true)
    setDetections([])
    setSelectedAnswers({})
    setWrittenAnswers({})
    
    try {
      const pageImage = await renderPageToImage(pdfDoc, index + 1)
      setCurrentImage(pageImage)
      setCurrentIndex(index)
    } catch (error) {
      console.error('Error rendering page:', error)
      toast.error('Failed to render page')
    } finally {
      setLoading(false)
    }
  }, [pdfDoc, numPages, renderPageToImage])

  const handleAnswerSelect = useCallback((questionId: string, answer: string) => {
    setSelectedAnswers(prev => ({ ...prev, [questionId]: answer }))
  }, [])

  const handleWrittenAnswer = useCallback((questionId: string, answer: string) => {
    setWrittenAnswers(prev => ({ ...prev, [questionId]: answer }))
  }, [])

  

  const handleReset = useCallback(() => {
    setPdfFile(null)
    setPdfDoc(null)
    setNumPages(0)
    setCurrentImage(null)
    setCurrentIndex(0)
    setDetections([])
    setSelectedAnswers({})
    setWrittenAnswers({})
    if (renderTaskRef.current) {
      renderTaskRef.current.cancel()
      renderTaskRef.current = null
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  // Drawing functions
  const initDrawingCanvas = useCallback((detection: Detection, questionId: string) => {
    if (!imageRef.current) return
    
    const img = imageRef.current
    const rect = img.getBoundingClientRect()
    
    // Create canvas for this detection
    const canvas = document.createElement('canvas')
    canvas.width = ((detection.x2 - detection.x1) / 100) * rect.width
    canvas.height = ((detection.y2 - detection.y1) / 100) * rect.height
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    // Set up drawing style
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = penColor
    ctx.lineWidth = penSize
    
    drawingCanvasRef.current = canvas
    drawingCtxRef.current = ctx
    setActiveDrawingQuestion(questionId)
    
    // Store in canvas refs
    setCanvasRefs(prev => ({ ...prev, [questionId]: canvas }))
  }, [penColor, penSize])

  const startDrawing = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawingCtxRef.current) return
    
    const canvas = e.currentTarget
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    drawingCtxRef.current.beginPath()
    drawingCtxRef.current.moveTo(x, y)
    setIsDrawing(true)
  }, [])

  const draw = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !drawingCtxRef.current) return
    
    const canvas = e.currentTarget
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    drawingCtxRef.current.lineTo(x, y)
    drawingCtxRef.current.stroke()
  }, [isDrawing])

  const stopDrawing = useCallback(() => {
    if (!drawingCtxRef.current) return
    drawingCtxRef.current.closePath()
    setIsDrawing(false)
  }, [])

  const clearDrawing = useCallback((questionId: string) => {
    const canvas = canvasRefs[questionId]
    if (!canvas) return
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }, [canvasRefs])

  const enableDrawingOnQuestion = useCallback((detection: Detection, idx: number) => {
    const questionId = `question-${idx}`
    
    if (activeDrawingQuestion === questionId) {
      // Toggle off
      setActiveDrawingQuestion(null)
      drawingCanvasRef.current = null
      drawingCtxRef.current = null
    } else {
      // Enable drawing for this question
      initDrawingCanvas(detection, questionId)
    }
  }, [activeDrawingQuestion, initDrawingCanvas])

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4 bg-background">
          <SidebarTrigger className="-ml-1" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/home">Home</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Exam</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>

        <div className="flex flex-1 flex-col gap-4 p-4 bg-background">
          {!pdfFile ? (
            <div className="flex flex-1 items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/50">
              <div className="flex flex-col items-center gap-4 text-center">
                <Upload className="h-16 w-16 text-muted-foreground" />
                <div>
                  <h3 className="text-lg font-semibold">Upload Exam PDF</h3>
                  <p className="text-sm text-muted-foreground">
                    Upload a PDF exam paper to detect questions and practice
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="pdf-upload"
                />
                <Button 
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-primary hover:bg-primary/90"
                >
                  Choose PDF
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-1 gap-4">
              {/* Main content area */}
              <div className="flex flex-1 flex-col gap-4">
                {/* Toolbar */}
                <div className="flex items-center justify-between rounded-lg border bg-card p-4 shadow-sm">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentIndex - 1)}
                      disabled={currentIndex === 0}
                    >
                      Previous
                    </Button>
                    <span className="text-sm font-medium">
                      Page {currentIndex + 1} of {numPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentIndex + 1)}
                      disabled={currentIndex === numPages - 1}
                    >
                      Next
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 mr-4">
                      <div className={`h-2 w-2 rounded-full ${modelLoaded ? 'bg-green-500' : 'bg-yellow-500'}`} />
                      <span className="text-xs text-muted-foreground">
                        {modelLoaded ? 'Model Ready' : 'Loading Model...'}
                      </span>
                    </div>
                    <Button
                      onClick={handleDetect}
                      disabled={detecting || !currentImage || !modelLoaded}
                      className="bg-primary hover:bg-primary/90"
                    >
                      {detecting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Detecting...
                        </>
                      ) : (
                        'Detect Questions'
                      )}
                    </Button>
                    <Button variant="outline" onClick={handleReset}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Reset
                    </Button>
                  </div>
                </div>

                {/* PDF viewer */}
                <div className="relative flex-1 rounded-lg border bg-muted/50 overflow-hidden">
                  {loading ? (
                    <div className="flex h-full items-center justify-center">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : currentImage ? (
                    <div className="relative h-full overflow-auto flex items-center justify-center p-4">
                      <img
                        ref={imageRef}
                        src={currentImage}
                        alt={`Page ${currentIndex + 1}`}
                        className="max-w-full shadow-lg"
                        onLoad={() => {
                          // Drawing canvases are initialized on demand
                        }}
                      />
                      {/* Bounding boxes overlay with drawing canvas */}
                      {detections.map((detection, idx) => {
                        const questionId = `question-${idx}`
                        const isActiveDrawing = activeDrawingQuestion === questionId
                        
                        return (
                          <div
                            key={idx}
                            className={`absolute border-2 cursor-pointer transition-all ${
                              detection.class === 'written_question' 
                                ? 'border-blue-500 bg-blue-500/5 hover:bg-blue-500/10' 
                                : 'border-green-500 bg-green-500/5 hover:bg-green-500/10'
                            } ${isActiveDrawing ? 'z-50 border-red-500 bg-red-500/10' : ''}`}
                            style={{
                              left: `${detection.x1}%`,
                              top: `${detection.y1}%`,
                              width: `${detection.x2 - detection.x1}%`,
                              height: `${detection.y2 - detection.y1}%`,
                            }}
                            title={`${detection.class}: ${(detection.confidence * 100).toFixed(0)}%`}
                            onClick={() => {
                              if (detection.class === 'written_question') {
                                enableDrawingOnQuestion(detection, idx)
                              } else if (detection.class === 'multiple_choice') {
                                // Toggle selection when clicking on MCQ area
                                const currentAnswer = selectedAnswers[questionId]
                                if (currentAnswer) {
                                  // Clear selection
                                  setSelectedAnswers(prev => {
                                    const newAnswers = { ...prev }
                                    delete newAnswers[questionId]
                                    return newAnswers
                                  })
                                }
                              }
                            }}
                          >
                            {/* Drawing canvas overlay for written questions */}
                            {detection.class === 'written_question' && isActiveDrawing && (
                              <canvas
                                ref={(el) => {
                                  if (el && !drawingCanvasRef.current) {
                                    // Initialize canvas on mount
                                    const rect = el.getBoundingClientRect()
                                    el.width = rect.width
                                    el.height = rect.height
                                    const ctx = el.getContext('2d')
                                    if (ctx) {
                                      ctx.lineCap = 'round'
                                      ctx.lineJoin = 'round'
                                      ctx.strokeStyle = penColor
                                      ctx.lineWidth = penSize
                                      drawingCtxRef.current = ctx
                                    }
                                    drawingCanvasRef.current = el
                                  }
                                }}
                                className="absolute inset-0 w-full h-full cursor-crosshair"
                                onMouseDown={startDrawing}
                                onMouseMove={draw}
                                onMouseUp={stopDrawing}
                                onMouseLeave={stopDrawing}
                              />
                            )}
                            {/* Show saved drawing when not actively drawing */}
                            {detection.class === 'written_question' && !isActiveDrawing && canvasRefs[questionId] && (
                              <img 
                                src={canvasRefs[questionId]!.toDataURL()} 
                                className="absolute inset-0 w-full h-full pointer-events-none"
                                alt="Drawing"
                              />
                            )}
                            {/* Text overlay for written questions */}
                            {detection.class === 'written_question' && writtenAnswers[questionId] && (
                              <div
                                className="absolute inset-0 p-2 pointer-events-none"
                                style={{
                                  left: `${detection.x1}%`,
                                  top: `${detection.y1}%`,
                                  width: `${detection.x2 - detection.x1}%`,
                                  height: `${detection.y2 - detection.y1}%`,
                                  fontSize: `${Math.min(20, (detection.y2 - detection.y1) / 100 * 100)}px`,
                                  color: penColor,
                                  fontFamily: 'Arial, sans-serif'
                                }}
                              >
                                {writtenAnswers[questionId]}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Questions panel */}
              <div className="w-96 rounded-lg border bg-card shadow-sm overflow-hidden flex flex-col max-h-[calc(100vh-8rem)]">
                <div className="p-4 border-b bg-muted/50">
                  <h3 className="text-lg font-semibold">Questions</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {detections.length} detected
                  </p>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  {detections.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <CheckCircle2 className="h-12 w-12 text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Click "Detect Questions" to analyze the current page
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {detections.map((detection, idx) => {
                        const questionId = `question-${idx}`
                        return (
                          <div key={idx} className="rounded-lg border bg-muted/30 p-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium capitalize">
                                {detection.class.replace('_', ' ')}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {(detection.confidence * 100).toFixed(0)}%
                              </span>
                            </div>
                            {detection.class === 'multiple_choice' ? (
                              <div className="space-y-2">
                                {['A', 'B', 'C', 'D'].map(option => (
                                  <label
                                    key={option}
                                    className={`flex items-center gap-2 text-sm cursor-pointer p-2 rounded-md transition-colors ${
                                      selectedAnswers[questionId] === option
                                        ? 'bg-primary/10 border border-primary/20'
                                        : 'hover:bg-muted/50'
                                    }`}
                                  >
                                    <input
                                      type="radio"
                                      name={questionId}
                                      value={option}
                                      checked={selectedAnswers[questionId] === option}
                                      onChange={() => handleAnswerSelect(questionId, option)}
                                      className="h-4 w-4"
                                    />
                                    <span>Option {option}</span>
                                  </label>
                                ))}
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {activeDrawingQuestion === questionId ? (
                                  <>
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="color"
                                        value={penColor}
                                        onChange={(e) => {
                                          setPenColor(e.target.value)
                                          if (drawingCtxRef.current) {
                                            drawingCtxRef.current.strokeStyle = e.target.value
                                          }
                                        }}
                                        className="h-8 w-8 rounded cursor-pointer"
                                      />
                                      <input
                                        type="range"
                                        min="1"
                                        max="10"
                                        value={penSize}
                                        onChange={(e) => {
                                          const size = parseInt(e.target.value)
                                          setPenSize(size)
                                          if (drawingCtxRef.current) {
                                            drawingCtxRef.current.lineWidth = size
                                          }
                                        }}
                                        className="flex-1"
                                      />
                                      <span className="text-xs text-muted-foreground w-4">{penSize}</span>
                                    </div>
                                    <div className="flex gap-2">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => clearDrawing(questionId)}
                                        className="flex-1"
                                      >
                                        Clear
                                      </Button>
                                      <Button
                                        variant="default"
                                        size="sm"
                                        onClick={() => setActiveDrawingQuestion(null)}
                                        className="flex-1"
                                      >
                                        Done
                                      </Button>
                                    </div>
                                    <p className="text-xs text-muted-foreground text-center">
                                      Click on the question area to draw
                                    </p>
                                  </>
                                ) : (
                                  <Button
                                    variant={activeDrawingQuestion === questionId ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => enableDrawingOnQuestion(detection, idx)}
                                    className="w-full"
                                  >
                                    <PenTool className="mr-2 h-4 w-4" />
                                    {activeDrawingQuestion === questionId ? 'Drawing...' : 'Write Answer'}
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
