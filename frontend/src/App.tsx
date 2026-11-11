import { useEffect, useState } from "react";
import { LandingPage } from "./components/LandingPage";
import { QuestionPage } from "./components/QuestionPage";
import { NotFoundPage } from "./components/NotFoundPage";
import { Paper, Question } from "./types";

const apiBase = import.meta.env.VITE_API_URL || "";

export function App() {
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
    const res = await fetch(`${apiBase}/api/upload-pdf`, {
      method: "POST",
      body: formData,
    });
    if (res.ok) {
      const data = await res.json();
      if (data.paper) {
        const qRes = await fetch(`${apiBase}/api/questions`);
        if (qRes.ok) {
          const qList: Question[] = await qRes.json();
          data.paper.questions = qList;
        }
        setPaper(data.paper);
        setCurrentPage("test");
      }
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
