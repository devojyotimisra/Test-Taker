import { useEffect, useState } from "react";
import { LandingPage } from "./components/LandingPage";
import { QuestionPage } from "./components/QuestionPage";
import { NotFoundPage } from "./components/NotFoundPage";
import { useToast } from "./components/ui/toast";
import { Paper, Question } from "./types";

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
        return;
      }

      const data = await res.json();
      if (!data.paper) {
        toast({
          type: "error",
          title: "PDF Parsing Failed",
          description: "Server could not generate question paper details.",
          duration: 6000,
        });
        return;
      }

      const qRes = await fetch(`${apiBase}/api/questions`);
      if (!qRes.ok) {
        toast({
          type: "error",
          title: "Questions Not Found",
          description:
            "Failed to retrieve the parsed questions from the server.",
          duration: 6000,
        });
        return;
      }

      const qList: Question[] = await qRes.json();
      if (!qList || qList.length === 0) {
        toast({
          type: "error",
          title: "No Questions Extracted",
          description: "No readable questions could be identified in this PDF.",
          duration: 6000,
        });
        return;
      }

      data.paper.questions = qList;
      setPaper(data.paper);
      setCurrentPage("test");
      toast({
        type: "success",
        title: "Paper Loaded Successfully",
        description: `Loaded "${data.paper.title || file.name}" with ${qList.length} questions.`,
        duration: 4000,
      });
    } catch (err: any) {
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

  const handleBack = async () => {
    try {
      await fetch(`${apiBase}/api/reset`, { method: "POST" });
    } catch {}
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

  if (
    currentPage === "test" &&
    paper &&
    paper.questions &&
    paper.questions.length > 0
  ) {
    return <QuestionPage paper={paper} onBack={handleBack} />;
  }

  return <LandingPage onUpload={handleUploadPdf} />;
}
