import { useEffect, useState } from "react";
import { LandingPage } from "./components/LandingPage";
import { QuestionPage } from "./components/QuestionPage";
import { NotFoundPage } from "./components/NotFoundPage";
import { useToast } from "./components/ui/toast";
import { Paper, Question, CatalogItem } from "./types";
import {
  fetchJsonWithFallback,
  preloadPaperAssets,
} from "./lib/assetService";
import { Loader2, Sparkles, Image as ImageIcon } from "lucide-react";

const apiBase = import.meta.env.VITE_API_URL || "";

interface LoadingPaperState {
  title: string;
  stage: "fetching" | "caching";
  loadedImages: number;
  totalImages: number;
}

export function App() {
  const { toast } = useToast();
  const [paper, setPaper] = useState<Paper | null>(null);
  const [currentPage, setCurrentPage] = useState<"landing" | "test">("landing");
  const [isNotFound, setIsNotFound] = useState<boolean>(false);
  const [loadingPaper, setLoadingPaper] = useState<LoadingPaperState | null>(null);

  useEffect(() => {
    const handleRoute = () => {
      const pathname = window.location.pathname;
      if (pathname !== "/" && pathname !== "") {
        setIsNotFound(true);
      } else {
        setIsNotFound(false);
      }
    };

    handleRoute();
    window.addEventListener("popstate", handleRoute);
    return () => window.removeEventListener("popstate", handleRoute);
  }, []);

  const handleUploadPdf = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    setLoadingPaper({
      title: file.name,
      stage: "fetching",
      loadedImages: 0,
      totalImages: 0,
    });

    try {
      const res = await fetch(`${apiBase}/api/upload-pdf`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        let errorMsg = "Failed to parse the question paper PDF.";
        try {
          const errData = await res.json();
          if (errData && errData.detail) {
            errorMsg = errData.detail;
          }
        } catch {
          errorMsg = `Server returned an error (${res.status}: ${res.statusText || "Upload failed"})`;
        }

        toast({
          type: "error",
          title: "PDF Parsing Failed",
          description: errorMsg,
          duration: 6000,
        });
        setLoadingPaper(null);
        return;
      }

      const data = await res.json();
      if (!data.paper || !data.paper.questions || data.paper.questions.length === 0) {
        toast({
          type: "error",
          title: "No Questions Extracted",
          description: "No readable questions could be identified in this PDF.",
          duration: 6000,
        });
        setLoadingPaper(null);
        return;
      }

      setLoadingPaper({
        title: data.paper.title || file.name,
        stage: "caching",
        loadedImages: 0,
        totalImages: 0,
      });

      await preloadPaperAssets(data.paper, (loaded, total) => {
        setLoadingPaper({
          title: data.paper.title || file.name,
          stage: "caching",
          loadedImages: loaded,
          totalImages: total,
        });
      });

      setPaper(data.paper);
      setCurrentPage("test");
      setLoadingPaper(null);

      toast({
        type: "success",
        title: "Paper Loaded Successfully",
        description: `Loaded "${data.paper.title || file.name}" with ${data.paper.questions.length} questions.`,
        duration: 4000,
      });
    } catch (err: any) {
      setLoadingPaper(null);
      toast({
        type: "error",
        title: "Upload Error",
        description:
          err.message && err.message.includes("fetch")
            ? "Could not connect to the server. Please verify your connection."
            : err.message || "An unexpected error occurred while uploading.",
        duration: 6000,
      });
    }
  };

  const handleSelectCatalogPaper = async (item: CatalogItem) => {
    setLoadingPaper({
      title: item.title,
      stage: "fetching",
      loadedImages: 0,
      totalImages: 0,
    });

    try {
      const paperData = await fetchJsonWithFallback<Paper>(item.json_url);
      if (!paperData || !paperData.questions || paperData.questions.length === 0) {
        toast({
          type: "warning",
          title: "No Interactive Questions",
          description: "This document contains no readable digital questions.",
          duration: 5000,
        });
        setLoadingPaper(null);
        return;
      }

      setLoadingPaper({
        title: item.title,
        stage: "caching",
        loadedImages: 0,
        totalImages: 0,
      });

      await preloadPaperAssets(paperData, (loaded, total) => {
        setLoadingPaper({
          title: item.title,
          stage: "caching",
          loadedImages: loaded,
          totalImages: total,
        });
      });

      setPaper(paperData);
      setCurrentPage("test");
      setLoadingPaper(null);

      toast({
        type: "success",
        title: "Paper Loaded Successfully",
        description: `Loaded "${item.title}" with ${paperData.total_questions || paperData.questions?.length || 0} questions.`,
        duration: 4000,
      });
    } catch (err: any) {
      setLoadingPaper(null);
      toast({
        type: "error",
        title: "Load Error",
        description: err.message || "Could not load the selected question paper.",
        duration: 6000,
      });
    }
  };

  const handleBack = () => {
    setPaper(null);
    setCurrentPage("landing");
  };

  const handleGoHome = () => {
    window.history.pushState({}, "", "/");
    setIsNotFound(false);
    setPaper(null);
    setCurrentPage("landing");
  };

  if (isNotFound) {
    return <NotFoundPage onHome={handleGoHome} />;
  }

  return (
    <>
      {currentPage === "test" &&
      paper &&
      paper.questions &&
      paper.questions.length > 0 ? (
        <QuestionPage paper={paper} onBack={handleBack} />
      ) : (
        <LandingPage
          onUpload={handleUploadPdf}
          onSelectPaper={handleSelectCatalogPaper}
        />
      )}

      {loadingPaper && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-card border border-border p-6 rounded-2xl shadow-2xl flex flex-col items-center text-center space-y-4">
            <div className="h-14 w-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary relative">
              <Loader2 className="h-7 w-7 animate-spin" />
              {loadingPaper.stage === "caching" && (
                <ImageIcon className="h-3.5 w-3.5 absolute bottom-2 right-2 text-primary" />
              )}
            </div>

            <div className="space-y-1.5 w-full">
              <h3 className="font-bold text-base text-foreground line-clamp-2">
                {loadingPaper.title}
              </h3>
              <p className="text-xs text-muted-foreground flex items-center justify-center gap-1.5">
                {loadingPaper.stage === "fetching" ? (
                  <>
                    <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span>Loading exam structure from repository...</span>
                  </>
                ) : loadingPaper.totalImages > 0 ? (
                  <>
                    <ImageIcon className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span>
                      Caching {loadingPaper.loadedImages} of {loadingPaper.totalImages} diagrams into memory...
                    </span>
                  </>
                ) : (
                  <span>Finalizing paper setup...</span>
                )}
              </p>
            </div>

            {loadingPaper.stage === "caching" && loadingPaper.totalImages > 0 && (
              <div className="w-full space-y-1.5 pt-1">
                <div className="w-full bg-muted rounded-full h-2 overflow-hidden border border-border/40">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-200 ease-out"
                    style={{
                      width: `${Math.min(100, Math.round((loadingPaper.loadedImages / loadingPaper.totalImages) * 100))}%`,
                    }}
                  />
                </div>
                <div className="flex justify-between items-center text-[10px] text-muted-foreground font-mono">
                  <span>Fast in-memory cache</span>
                  <span>
                    {Math.min(100, Math.round((loadingPaper.loadedImages / loadingPaper.totalImages) * 100))}%
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
