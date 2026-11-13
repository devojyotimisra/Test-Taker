import { useEffect, useState } from "react";
import { LandingPage } from "./components/LandingPage";
import { QuestionPage } from "./components/QuestionPage";
import { NotFoundPage } from "./components/NotFoundPage";
import { useToast } from "./components/ui/toast";
import { Paper, CatalogItem } from "./types";
import {
  fetchJsonWithFallback,
  preloadPaperAssets,
} from "./lib/assetService";

const apiBase = import.meta.env.VITE_API_URL || "";

export function App() {
  const { toast } = useToast();
  const [paper, setPaper] = useState<Paper | null>(null);
  const [currentPage, setCurrentPage] = useState<"landing" | "test">("landing");
  const [isNotFound, setIsNotFound] = useState<boolean>(false);

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

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const res = await fetch(`${apiBase}/api/upload-pdf`, {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });
      clearTimeout(timeout);

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
        return;
      }

      await preloadPaperAssets(data.paper);

      setPaper(data.paper);
      setCurrentPage("test");

      toast({
        type: "success",
        title: "Paper Loaded Successfully",
        description: `Loaded "${data.paper.title || file.name}" with ${data.paper.questions.length} questions.`,
        duration: 4000,
      });
    } catch (err: any) {
      clearTimeout(timeout);
      toast({
        type: "error",
        title: "Upload Error",
        description:
          err.name === "AbortError"
            ? "Upload timed out. Please check if the backend server is running."
            : err.message && err.message.includes("fetch")
            ? "Could not connect to the backend server. Please make sure the Python server is running."
            : err.message || "An unexpected error occurred while uploading.",
        duration: 6000,
      });
    }
  };

  const handleSelectCatalogPaper = async (item: CatalogItem) => {
    try {
      const paperData = await fetchJsonWithFallback<Paper>(item.json_url);
      if (!paperData || !paperData.questions || paperData.questions.length === 0) {
        toast({
          type: "warning",
          title: "No Interactive Questions",
          description: "This document contains no readable digital questions.",
          duration: 5000,
        });
        return;
      }

      await preloadPaperAssets(paperData);

      setPaper(paperData);
      setCurrentPage("test");

      toast({
        type: "success",
        title: "Paper Loaded Successfully",
        description: `Loaded "${item.title}" with ${paperData.total_questions || paperData.questions?.length || 0} questions.`,
        duration: 4000,
      });
    } catch (err: any) {
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
    </>
  );
}
