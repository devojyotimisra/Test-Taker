import React, { useState } from "react"
import {
  FileText,
  Sparkles,
  Upload,
  Zap,
} from "lucide-react"
import { Card, CardContent } from "./ui/card"
import { ThemeToggle } from "./ThemeToggle"

interface LandingPageProps {
  onUpload: (file: File) => Promise<void>
}

export function LandingPage({ onUpload }: LandingPageProps) {
  const [uploading, setUploading] = useState<boolean>(false)
  const [dragOver, setDragOver] = useState<boolean>(false)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      await onUpload(file)
    } finally {
      setUploading(false)
    }
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (!file || !file.name.toLowerCase().endsWith(".pdf")) return
    setUploading(true)
    try {
      await onUpload(file)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-between bg-background text-foreground transition-colors overflow-y-auto no-scrollbar">
      <header className="shrink-0 border-b border-border/80 bg-background/80 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-md shadow-primary/25">
              <Zap className="h-4 w-4" />
            </div>
            <div>
              <span className="font-serif font-bold text-base tracking-tight text-foreground">
                Test Taker
              </span>
            </div>
          </div>

          <ThemeToggle />
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-6 md:py-10 flex flex-col gap-6 justify-center items-center">
        <div className="text-center max-w-xl mx-auto space-y-2.5">

          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight font-serif text-foreground leading-tight">
            Question Paper Assessment
          </h1>

          <p className="text-xs sm:text-sm text-muted-foreground font-sans">
            Upload your question paper PDF to start your session with immediate question-by-question scoring and live timer tracking.
          </p>
        </div>

        <div className="w-full flex flex-col gap-4">
          <Card
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed transition-all shadow-md ${
              dragOver ? "border-primary bg-primary/5 scale-[1.01]" : "border-border bg-card"
            }`}
          >
            <CardContent className="p-6 sm:p-10 md:p-12 text-center space-y-4">
              <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto shadow-xs">
                <Upload className="h-7 w-7" />
              </div>

              <div className="space-y-1">
                <h3 className="font-bold text-base sm:text-lg">
                  {uploading ? "Analyzing & Parsing PDF..." : "Upload Assessment PDF"}
                </h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Drag and drop any question paper PDF here, or select from your computer to load questions and diagrams.
                </p>
              </div>

              <div className="pt-2">
                <label className="cursor-pointer inline-block">
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handleFileChange}
                    className="hidden"
                    disabled={uploading}
                  />
                  <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm shadow hover:opacity-90 transition-opacity">
                    <FileText className="h-4 w-4" />
                    <span>{uploading ? "Uploading..." : "Select PDF File"}</span>
                  </span>
                </label>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
