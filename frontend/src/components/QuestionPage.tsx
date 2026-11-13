import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Info,
  XCircle,
} from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader } from "./ui/card";
import { Badge } from "./ui/badge";
import { ThemeToggle } from "./ThemeToggle";
import { Timer } from "./Timer";
import { FormulaRenderer } from "./FormulaRenderer";
import { Paper, QuestionScore, UserAnswers } from "@/types";

const apiBase = import.meta.env.VITE_API_URL || "";

interface QuestionPageProps {
  paper: Paper;
  onBack?: () => void;
}

export function QuestionPage({ paper, onBack }: QuestionPageProps) {
  const questions = paper.questions || [];
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [answers, setAnswers] = useState<UserAnswers>({});

  const [timerSeconds, setTimerSeconds] = useState<number>(0);
  const [timerRunning, setTimerRunning] = useState<boolean>(true);

  const [scores, setScores] = useState<Record<number, QuestionScore>>({});
  const [revealedQuestions, setRevealedQuestions] = useState<Set<number>>(
    new Set(),
  );

  const currentQ = questions[currentIndex];

  useEffect(() => {
    let interval: any = null;
    if (timerRunning) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timerRunning]);

  const toggleTimer = () => {
    setTimerRunning((prev) => !prev);
  };

  const resetTimer = () => {
    setTimerSeconds(0);
  };

  const handleSelectOption = (opt: string) => {
    if (!currentQ || revealedQuestions.has(currentQ.id)) return;
    const qId = currentQ.id;

    if (currentQ.type === "MCQ") {
      setAnswers((prev) => ({ ...prev, [qId]: opt }));
    } else if (currentQ.type === "multichoice") {
      const existing = (answers[qId] as string[]) || [];
      const updated = existing.includes(opt)
        ? existing.filter((item) => item !== opt)
        : [...existing, opt];
      setAnswers((prev) => ({ ...prev, [qId]: updated }));
    }
  };

  const handleNumericChange = (val: string) => {
    if (!currentQ || revealedQuestions.has(currentQ.id)) return;
    setAnswers((prev) => ({ ...prev, [currentQ.id]: val }));
  };

  const handleClearResponse = () => {
    if (!currentQ) return;
    const qId = currentQ.id;
    setAnswers((prev) => {
      const copy = { ...prev };
      delete copy[qId];
      return copy;
    });
    setScores((prev) => {
      const copy = { ...prev };
      delete copy[qId];
      return copy;
    });
    setRevealedQuestions((prev) => {
      const copy = new Set(prev);
      copy.delete(qId);
      return copy;
    });
  };

  const handleCheckAnswer = async () => {
    if (!currentQ) return;
    const ans = answers[currentQ.id];
    try {
      const response = await fetch(`${apiBase}/api/check-question`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question_id: currentQ.id, answer: ans }),
      });
      if (response.ok) {
        const sc: QuestionScore = await response.json();
        setScores((prev) => ({ ...prev, [currentQ.id]: sc }));
        setRevealedQuestions((prev) => new Set(prev).add(currentQ.id));
      }
    } catch {}
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const isCurrentRevealed = Boolean(
    currentQ && revealedQuestions.has(currentQ.id),
  );
  const currentScoreDetail = currentQ ? scores[currentQ.id] : null;
  const hasCurrentAnswer = Boolean(currentQ && answers[currentQ.id]);

  return (
    <div className="h-screen max-h-screen flex flex-col bg-background text-foreground transition-colors overflow-hidden no-scrollbar">
      <header className="shrink-0 border-b border-border/80 bg-background/85 backdrop-blur-md px-3 sm:px-4 py-2">
        <div className="max-w-7xl mx-auto flex flex-col sm:grid sm:grid-cols-3 items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center justify-between w-full sm:w-auto sm:justify-self-start gap-2 sm:gap-3">
            <div className="flex items-center gap-1.5 sm:gap-2">
              {onBack && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onBack}
                  className="h-8 px-2 text-muted-foreground hover:text-foreground gap-1.5 text-xs font-medium cursor-pointer"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>Back</span>
                </Button>
              )}

              <div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span className="font-semibold text-xs sm:text-sm">
                    Assessment
                  </span>
                  <span className="text-[10px] sm:text-xs font-mono font-semibold px-1.5 sm:px-2 py-0.5 rounded-md border border-primary/30 bg-primary/10 text-primary">
                    Full Marks: {paper.total_marks.toFixed(2)}
                  </span>
                </div>
                <div className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5">
                  Question {currentIndex + 1} of {questions.length}
                </div>
              </div>
            </div>

            <div className="sm:hidden flex items-center">
              <ThemeToggle />
            </div>
          </div>

          <div className="flex items-center justify-center justify-self-center w-full sm:w-auto">
            <Timer
              seconds={timerSeconds}
              isRunning={timerRunning}
              onToggle={toggleTimer}
              onReset={resetTimer}
            />
          </div>

          <div className="hidden sm:flex items-center gap-3 justify-self-end">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-4 grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 overflow-y-auto lg:overflow-hidden min-h-0">
        <div className="lg:col-span-8 lg:h-full flex flex-col justify-between min-h-0 gap-3">
          {currentQ && (
            <Card className="flex-1 flex flex-col border-border shadow-md overflow-hidden min-h-0">
              <CardHeader className="shrink-0 pb-2.5 pt-3 px-3.5 sm:px-6 border-b border-border/60">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="default" className="text-xs px-2.5 py-0.5">
                      Question {currentIndex + 1}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {currentQ.type === "MCQ" && "Multiple Choice"}
                      {currentQ.type === "multichoice" &&
                        "Multiple Select (MSQ)"}
                      {currentQ.type === "numeric" && "Numerical Answer"}
                    </Badge>
                    {currentQ.section_name && (
                      <Badge variant="secondary" className="text-xs hidden sm:inline-flex">
                        {currentQ.section_name}
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-primary/10 border border-primary/20 text-primary text-xs font-semibold">
                      <span>Awarded:</span>
                      <span className="font-mono text-sm">
                        +{currentQ.marks.toFixed(2)}
                      </span>
                      <span>Marks</span>
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="flex-1 overflow-y-auto no-scrollbar p-5 sm:p-6 min-h-0">
                <div className="min-h-full flex flex-col justify-between gap-6 pb-2">
                  <div className="flex flex-col gap-4 shrink-0">
                    {currentQ.comprehension_passage && (
                      <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 text-foreground space-y-2">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-primary uppercase tracking-wider">
                          <Info className="h-4 w-4" />
                          <span>Comprehension / Common Data Context</span>
                        </div>
                        <div className="text-xs sm:text-sm leading-relaxed text-foreground/90 border-t border-primary/20 pt-2.5">
                          <FormulaRenderer text={currentQ.comprehension_passage} />
                        </div>
                      </div>
                    )}
                    <div className="text-sm sm:text-base leading-relaxed font-sans text-foreground">
                      <FormulaRenderer text={currentQ.text} />
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 my-auto">
                    {currentQ.type === "numeric" ? (
                      <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-3 shrink-0">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                          Enter Numeric Value:
                        </label>

                        <div className="flex items-center gap-3 w-full">
                          <input
                            type="text"
                            value={(answers[currentQ.id] as string) || ""}
                            onChange={(e) =>
                              handleNumericChange(e.target.value)
                            }
                            placeholder="Type numerical answer..."
                            disabled={isCurrentRevealed}
                            className={`h-12 flex-1 w-full rounded-xl border px-4 py-3 text-base font-mono shadow-xs focus-visible:outline-none focus-visible:ring-2 ${
                              isCurrentRevealed && currentScoreDetail
                                ? currentScoreDetail.status === "correct"
                                  ? "border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500 text-foreground"
                                  : "border-destructive bg-destructive/10 ring-1 ring-destructive text-foreground"
                                : "border-input bg-card focus-visible:ring-ring"
                            }`}
                          />
                          {(answers[currentQ.id] as string) &&
                            !isCurrentRevealed && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleNumericChange("")}
                                className="h-10 px-3 text-xs text-muted-foreground hover:text-foreground shrink-0"
                              >
                                Clear
                              </Button>
                            )}
                        </div>

                        {isCurrentRevealed && (
                          <div className="flex items-center justify-between pt-2 border-t border-border/60 text-xs sm:text-sm">
                            <span className="text-muted-foreground font-medium">
                              Accepted Answer / Range:
                            </span>
                            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-md border border-emerald-500/20">
                              {String(
                                currentScoreDetail?.correct_answer ??
                                  currentQ.correct_answer ??
                                  "",
                              )}
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3">
                        {(currentQ.options || []).map((optText, optIdx) => {
                          const optLetter = String.fromCharCode(65 + optIdx);
                          const userVal = answers[currentQ.id];
                          const isSelected =
                            currentQ.type === "MCQ"
                              ? userVal === optText
                              : Array.isArray(userVal) &&
                                userVal.includes(optText);

                          let optionBorder =
                            "border-border bg-card hover:bg-muted/40 cursor-pointer";
                          if (isSelected) {
                            optionBorder =
                              "border-primary bg-primary/10 shadow-xs ring-1 ring-primary cursor-pointer";
                          }

                          if (isCurrentRevealed && currentScoreDetail) {
                            const corr = currentScoreDetail.correct_answer;
                            const isCorrectOpt = Array.isArray(corr)
                              ? corr.includes(optText)
                              : corr === optText;

                            if (isCorrectOpt) {
                              optionBorder =
                                "border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500 cursor-default";
                            } else if (isSelected && !isCorrectOpt) {
                              optionBorder =
                                "border-destructive bg-destructive/10 ring-1 ring-destructive cursor-default";
                            } else {
                              optionBorder =
                                "border-border/60 bg-card/60 opacity-60 cursor-default";
                            }
                          }

                          return (
                            <div
                              key={optIdx}
                              onClick={() =>
                                !isCurrentRevealed &&
                                handleSelectOption(optText)
                              }
                              className={`w-full flex items-start gap-2.5 sm:gap-3 p-3 sm:p-3.5 rounded-xl border-2 transition-all select-none shrink-0 ${optionBorder}`}
                            >
                              <div
                                className={`h-6 w-6 rounded-md flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 transition-colors ${
                                  isSelected
                                    ? "bg-primary text-primary-foreground shadow-xs"
                                    : "bg-muted text-muted-foreground"
                                }`}
                              >
                                {isSelected ? (
                                  <Check className="h-3.5 w-3.5 stroke-[3]" />
                                ) : (
                                  optLetter
                                )}
                              </div>

                              <div className="flex-1 text-xs sm:text-sm leading-relaxed pt-0.5 break-words">
                                <FormulaRenderer text={optText} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {isCurrentRevealed && currentScoreDetail && (
                    <div
                      className={`shrink-0 p-3 rounded-xl border flex items-center justify-between ${
                        currentScoreDetail.status === "correct"
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200"
                          : currentScoreDetail.status === "partial"
                            ? "bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200"
                            : "bg-destructive/10 border-destructive/30 text-destructive-foreground dark:text-rose-200"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {currentScoreDetail.status === "correct" && (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        )}
                        {currentScoreDetail.status === "partial" && (
                          <Info className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        )}
                        {currentScoreDetail.status === "incorrect" && (
                          <XCircle className="h-4 w-4 text-destructive" />
                        )}
                        <span className="font-bold text-xs sm:text-sm">
                          Score:{" "}
                          {currentScoreDetail.marks_awarded >= 0 ? "+" : ""}
                          {currentScoreDetail.marks_awarded.toFixed(2)} /{" "}
                          {currentScoreDetail.max_marks.toFixed(2)} Marks
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="shrink-0 flex items-center justify-between gap-2 pt-1 pb-1 sm:pb-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrev}
                disabled={currentIndex === 0}
                className="gap-1 text-xs h-8 px-2.5 sm:px-3"
              >
                <ChevronLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span>Previous</span>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearResponse}
                disabled={!hasCurrentAnswer && !isCurrentRevealed}
                className="text-xs text-muted-foreground hover:text-foreground h-8 px-2 sm:px-3 disabled:opacity-40"
              >
                Clear
              </Button>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2">
              <Button
                size="sm"
                onClick={handleCheckAnswer}
                disabled={isCurrentRevealed || !hasCurrentAnswer}
                className="gap-1 sm:gap-1.5 text-xs font-semibold bg-primary text-primary-foreground shadow h-8 px-2.5 sm:px-3.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Eye className="h-3.5 w-3.5" />
                <span>
                  {isCurrentRevealed ? "Answer Checked" : "Check Answer"}
                </span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleNext}
                disabled={currentIndex === questions.length - 1}
                className="gap-1 text-xs font-semibold h-8 px-2.5 sm:px-3"
              >
                <span>Next</span>
                <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 lg:h-full flex flex-col shrink-0 lg:shrink lg:overflow-hidden lg:min-h-0">
          <Card className="lg:h-full flex flex-col border-border shadow-md shrink-0 lg:shrink lg:overflow-hidden lg:min-h-0">
            <CardHeader className="shrink-0 pb-2.5 pt-3 px-3.5 sm:px-6 border-b border-border/60">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm">Questions Palette</span>
                <span className="text-xs text-muted-foreground">
                  {questions.length} Questions
                </span>
              </div>
            </CardHeader>

            <CardContent className="p-3 sm:p-3.5 flex flex-col no-scrollbar lg:flex-1 lg:overflow-y-auto lg:min-h-0">
              <div className="flex flex-col gap-2 sm:gap-2.5 lg:h-full lg:flex-1 lg:min-h-0">
                {Array.from(
                  { length: Math.ceil(questions.length / 5) },
                  (_, rIdx) => {
                    const rowQuestions = questions.slice(
                      rIdx * 5,
                      rIdx * 5 + 5,
                    );
                    return (
                      <div
                        key={rIdx}
                        className="flex gap-2 sm:gap-2.5 w-full h-11 lg:h-auto lg:flex-1 lg:min-h-0"
                      >
                        {rowQuestions.map((q, cIdx) => {
                          const idx = rIdx * 5 + cIdx;
                          const isChecked = revealedQuestions.has(q.id);
                          const sc = scores[q.id];
                          const isCurrent = idx === currentIndex;
                          const userVal = answers[q.id];
                          const isAnswered =
                            userVal !== undefined &&
                            userVal !== "" &&
                            (!Array.isArray(userVal) || userVal.length > 0);

                          let btnStyle = "";
                          if (isChecked && sc) {
                            if (sc.status === "correct") {
                              btnStyle =
                                "bg-emerald-600 text-white border-emerald-600 shadow-xs";
                            } else if (sc.status === "partial") {
                              btnStyle =
                                "bg-amber-500 text-white border-amber-600 shadow-xs";
                            } else if (sc.status === "incorrect") {
                              btnStyle =
                                "bg-destructive text-white border-destructive shadow-xs";
                            }
                            if (isCurrent) {
                              btnStyle +=
                                " ring-2 ring-primary ring-offset-2 ring-offset-card shadow-sm";
                            }
                          } else if (isCurrent) {
                            btnStyle =
                              "bg-primary text-primary-foreground border-primary shadow-sm ring-2 ring-primary/30";
                          } else if (isAnswered) {
                            btnStyle =
                              "bg-primary/15 text-primary border-primary/30 hover:bg-primary/25";
                          } else {
                            btnStyle =
                              "bg-muted/70 text-muted-foreground border-border/60 hover:bg-muted hover:text-foreground";
                          }

                          return (
                            <button
                              key={q.id}
                              onClick={() => setCurrentIndex(idx)}
                              className={`flex-1 h-11 lg:h-full min-w-0 rounded-xl font-mono text-sm font-bold border transition-colors duration-150 cursor-pointer flex items-center justify-center relative shrink-0 lg:shrink ${btnStyle}`}
                            >
                              <span>{idx + 1}</span>
                              {isAnswered && !isChecked && (
                                <span
                                  className={`absolute bottom-2 h-1.5 w-1.5 rounded-full ${
                                    isCurrent ? "bg-white" : "bg-primary"
                                  }`}
                                />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    );
                  },
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
