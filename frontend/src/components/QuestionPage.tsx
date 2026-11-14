import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Bookmark,
  Calculator,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Info,
  X,
  XCircle,
} from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader } from "./ui/card";
import { Badge } from "./ui/badge";
import { ThemeToggle } from "./ThemeToggle";
import { Timer } from "./Timer";
import { FormulaRenderer } from "./FormulaRenderer";
import { ScientificCalculator } from "./ScientificCalculator";
import { Paper, QuestionScore, UserAnswers } from "@/types";
import { scoreQuestion } from "@/lib/scorer";

const apiBase = import.meta.env.VITE_API_URL || "";

interface QuestionPageProps {
  paper: Paper;
  onBack?: () => void;
}

export function QuestionPage({ paper, onBack }: QuestionPageProps) {
  const questions = paper.questions || [];
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [answers, setAnswers] = useState<UserAnswers>({});
  const [isCalcOpen, setIsCalcOpen] = useState(false);

  const [timerSeconds, setTimerSeconds] = useState<number>(0);
  const [timerRunning, setTimerRunning] = useState<boolean>(true);

  const [scores, setScores] = useState<Record<number, QuestionScore>>({});
  const [revealedQuestions, setRevealedQuestions] = useState<Set<number>>(
    new Set(),
  );
  const [visitedQuestions, setVisitedQuestions] = useState<Set<number>>(() => {
    const init = new Set<number>();
    if (paper.questions && paper.questions[0]) {
      init.add(paper.questions[0].id);
    }
    return init;
  });
  const [markedQuestions, setMarkedQuestions] = useState<Set<number>>(
    new Set(),
  );

  const currentQ = questions[currentIndex];

  useEffect(() => {
    if (currentQ) {
      setVisitedQuestions((prev) => {
        if (prev.has(currentQ.id)) return prev;
        const next = new Set(prev);
        next.add(currentQ.id);
        return next;
      });
    }
  }, [currentQ]);

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
    setMarkedQuestions((prev) => {
      const copy = new Set(prev);
      copy.delete(qId);
      return copy;
    });
  };

  const handleMarkForReviewAndNext = () => {
    if (!currentQ) return;
    const qId = currentQ.id;
    setMarkedQuestions((prev) => {
      const next = new Set(prev);
      if (next.has(qId)) {
        next.delete(qId);
      } else {
        next.add(qId);
      }
      return next;
    });
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handleCheckAnswer = async () => {
    if (!currentQ) return;
    const ans = answers[currentQ.id];
    const sc = scoreQuestion(currentQ, ans);
    setScores((prev) => ({ ...prev, [currentQ.id]: sc }));
    setRevealedQuestions((prev) => new Set(prev).add(currentQ.id));
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

  const correctCount = questions.filter(
    (q) => revealedQuestions.has(q.id) && scores[q.id]?.status === "correct",
  ).length;

  const incorrectCount = questions.filter(
    (q) => revealedQuestions.has(q.id) && scores[q.id]?.status === "incorrect",
  ).length;

  const answeredUncheckedCount = questions.filter((q) => {
    const v = answers[q.id];
    const hasAns =
      v !== undefined && v !== "" && (!Array.isArray(v) || v.length > 0);
    return hasAns && !revealedQuestions.has(q.id);
  }).length;

  const markedCount = questions.filter((q) => markedQuestions.has(q.id)).length;

  const notAnsweredCount = questions.filter((q) => {
    const v = answers[q.id];
    const hasAns =
      v !== undefined && v !== "" && (!Array.isArray(v) || v.length > 0);
    return (
      visitedQuestions.has(q.id) &&
      !hasAns &&
      !markedQuestions.has(q.id) &&
      !revealedQuestions.has(q.id)
    );
  }).length;

  const notVisitedCount = questions.filter(
    (q) => !visitedQuestions.has(q.id),
  ).length;

  return (
    <div className="h-screen max-h-screen flex flex-col bg-background text-foreground transition-colors overflow-hidden no-scrollbar">
      <header className="shrink-0 sticky top-0 z-40 border-b border-border/80 bg-background/95 backdrop-blur-md px-3 sm:px-4 py-2">
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
                  <span
                    className="font-semibold text-xs sm:text-sm max-w-[150px] xs:max-w-[220px] sm:max-w-xs md:max-w-md truncate"
                    title={currentQ?.section_name || paper.title || "Assessment"}
                  >
                    {currentQ?.section_name || paper.title || "Assessment"}
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

            <div className="sm:hidden flex items-center gap-1.5">
              <ThemeToggle />
            </div>
          </div>

          <div className="hidden sm:flex items-center justify-center justify-self-center w-full sm:w-auto">
            <Timer
              seconds={timerSeconds}
              isRunning={timerRunning}
              onToggle={toggleTimer}
              onReset={resetTimer}
            />
          </div>

          <div className="hidden sm:flex items-center gap-2 justify-self-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCalcOpen((prev) => !prev)}
              className="h-8 px-2.5 text-xs gap-1.5 cursor-pointer"
              title="Open Scientific Calculator"
            >
              <Calculator className="h-4 w-4" />
              <span>Calculator</span>
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-4 flex flex-col lg:grid lg:grid-cols-12 gap-3 sm:gap-4 overflow-y-auto lg:overflow-hidden min-h-0">
        <div className="lg:col-span-8 w-full lg:h-full flex flex-col justify-between min-h-0 gap-3 shrink-0 lg:shrink">
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
                        "Multiple Select (MSQ) · Select all that apply"}
                      {currentQ.type === "numeric" &&
                        "Numerical / Short Answer"}
                    </Badge>
                    {currentQ.group_id && (
                      <Badge
                        variant="secondary"
                        className="text-xs bg-primary/10 text-primary border-primary/20"
                      >
                        Comprehension Set
                      </Badge>
                    )}
                    {markedQuestions.has(currentQ.id) && (
                      <Badge
                        variant="secondary"
                        className="text-xs bg-primary/15 text-primary border-primary/30 flex items-center gap-1"
                      >
                        <Bookmark className="h-3 w-3 fill-primary" />
                        <span>Marked for Review</span>
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
                          <FormulaRenderer
                            text={currentQ.comprehension_passage}
                          />
                        </div>
                      </div>
                    )}
                    <div className="text-sm sm:text-base leading-relaxed font-sans text-foreground">
                      <FormulaRenderer text={currentQ.text} />
                    </div>
                    {(() => {
                      const untagged = (currentQ.images || []).filter((img) => {
                        const fn = img.split("/").pop();
                        if (!fn) return false;
                        const inText = (currentQ.text || "").includes(fn);
                        const inComp = (currentQ.comprehension_passage || "").includes(fn);
                        const inOpts = (currentQ.options || []).some((o) => (o || "").includes(fn));
                        return !inText && !inComp && !inOpts;
                      });
                      if (untagged.length === 0) return null;
                      return (
                        <div className="flex flex-col gap-3 my-2">
                          {untagged.map((img, i) => (
                            <FormulaRenderer
                              key={i}
                              text={`[IMAGE: ${img}|block]`}
                            />
                          ))}
                        </div>
                      );
                    })()}
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
                            onKeyDown={(e) => {
                              if (
                                e.key === "Enter" &&
                                !isCurrentRevealed &&
                                hasCurrentAnswer
                              ) {
                                handleCheckAnswer();
                              }
                            }}
                            placeholder="Type numerical answer, range (e.g. 10 to 12), or text..."
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
                          {isCurrentRevealed && currentScoreDetail && (
                            <span
                              className={`shrink-0 px-2.5 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 shadow-2xs ${
                                currentScoreDetail.status === "correct"
                                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                                  : "bg-destructive/15 text-destructive border-destructive/30"
                              }`}
                            >
                              {currentScoreDetail.status === "correct" ? (
                                <>
                                  <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                                  <span>Right Answer</span>
                                </>
                              ) : (
                                <>
                                  <X className="h-3.5 w-3.5 stroke-[2.5]" />
                                  <span>Wrong Answer</span>
                                </>
                              )}
                            </span>
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
                    ) : (!currentQ.options || currentQ.options.length === 0) ? (
                      <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-3 shrink-0">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                          Enter Short Answer:
                        </label>
                        <div className="flex items-center gap-3 w-full">
                          <input
                            type="text"
                            value={(answers[currentQ.id] as string) || ""}
                            onChange={(e) =>
                              handleNumericChange(e.target.value)
                            }
                            placeholder="Type answer..."
                            disabled={isCurrentRevealed}
                            className="h-12 flex-1 w-full rounded-xl border px-4 py-3 text-base font-mono bg-card"
                          />
                          {isCurrentRevealed && currentScoreDetail && (
                            <span
                              className={`shrink-0 px-2.5 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 shadow-2xs ${
                                currentScoreDetail.status === "correct"
                                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                                  : "bg-destructive/15 text-destructive border-destructive/30"
                              }`}
                            >
                              {currentScoreDetail.status === "correct" ? (
                                <>
                                  <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                                  <span>Right Answer</span>
                                </>
                              ) : (
                                <>
                                  <X className="h-3.5 w-3.5 stroke-[2.5]" />
                                  <span>Wrong Answer</span>
                                </>
                              )}
                            </span>
                          )}
                        </div>
                        {isCurrentRevealed && (
                          <div className="flex items-center justify-between pt-2 border-t border-border/60 text-xs sm:text-sm">
                            <span className="text-muted-foreground font-medium">
                              Accepted Answer:
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
                          let badgeBg = "bg-muted text-muted-foreground";
                          let badgeContent: React.ReactNode = optLetter;
                          let statusTag: React.ReactNode = null;

                          if (isSelected) {
                            optionBorder =
                              "border-primary bg-primary/10 shadow-xs ring-1 ring-primary cursor-pointer";
                            badgeBg = "bg-primary text-primary-foreground shadow-xs";
                            badgeContent = <Check className="h-3.5 w-3.5 stroke-[3]" />;
                          }

                          if (isCurrentRevealed && currentScoreDetail) {
                            const corr = currentScoreDetail.correct_answer;
                            const isCorrectOpt = Array.isArray(corr)
                              ? corr.includes(optText)
                              : corr === optText;

                            if (isCorrectOpt) {
                              optionBorder =
                                "border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500 cursor-default";
                              badgeBg = "bg-emerald-600 text-white shadow-xs";
                              badgeContent = <Check className="h-3.5 w-3.5 stroke-[3]" />;
                              statusTag = (
                                <span className="shrink-0 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                                  <Check className="h-3 w-3 stroke-[2.5]" />
                                  <span>Right Answer</span>
                                </span>
                              );
                            } else if (isSelected && !isCorrectOpt) {
                              optionBorder =
                                "border-destructive bg-destructive/10 ring-1 ring-destructive cursor-default";
                              badgeBg = "bg-destructive text-white shadow-xs";
                              badgeContent = <X className="h-3.5 w-3.5 stroke-[3]" />;
                              statusTag = (
                                <span className="shrink-0 px-2 py-0.5 rounded-md text-[11px] font-bold bg-destructive/15 text-destructive border border-destructive/30 flex items-center gap-1">
                                  <X className="h-3 w-3 stroke-[2.5]" />
                                  <span>Wrong Answer</span>
                                </span>
                              );
                            } else {
                              optionBorder =
                                "border-border/60 bg-card/60 opacity-60 cursor-default";
                              badgeBg = "bg-muted/60 text-muted-foreground/80";
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
                                className={`h-6 w-6 rounded-md flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 transition-colors ${badgeBg}`}
                              >
                                {badgeContent}
                              </div>

                              <div className="flex-1 text-xs sm:text-sm leading-relaxed pt-0.5 break-words">
                                <FormulaRenderer text={optText} />
                              </div>

                              {statusTag}
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
                disabled={
                  !hasCurrentAnswer &&
                  !isCurrentRevealed &&
                  (!currentQ || !markedQuestions.has(currentQ.id))
                }
                className="text-xs text-muted-foreground hover:text-foreground h-8 px-2 sm:px-3 disabled:opacity-40"
              >
                Clear
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleMarkForReviewAndNext}
                className="hidden sm:inline-flex items-center gap-1.5 text-xs h-8 px-2.5 sm:px-3 font-semibold border-primary/40 text-primary hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer"
                title="Mark this question for review and proceed to next"
              >
                <Bookmark
                  className={`h-3.5 w-3.5 ${
                    currentQ && markedQuestions.has(currentQ.id)
                      ? "fill-primary"
                      : ""
                  }`}
                />
                <span>
                  {currentQ && markedQuestions.has(currentQ.id)
                    ? "Marked for Review & Next"
                    : "Mark for Review & Next"}
                </span>
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

        <div className="lg:col-span-4 w-full flex-1 lg:h-full flex flex-col min-h-0">
          <Card className="w-full flex-1 lg:h-full flex flex-col border-border shadow-md min-h-0">
            <CardHeader className="shrink-0 pb-2.5 pt-3 px-3.5 sm:px-4 border-b border-border/60">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm">Questions Palette</span>
                <span className="text-xs text-muted-foreground font-mono">
                  {questions.length} Questions
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 pt-2 text-[10px]">
                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-md bg-emerald-600 flex items-center justify-center text-white shrink-0 shadow-2xs font-bold text-[8px]">
                    ✓
                  </span>
                  <span className="text-muted-foreground truncate">
                    Right ({correctCount})
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-md bg-destructive flex items-center justify-center text-white shrink-0 shadow-2xs font-bold text-[8px]">
                    ✕
                  </span>
                  <span className="text-muted-foreground truncate">
                    Wrong ({incorrectCount})
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-md bg-primary shrink-0 shadow-2xs" />
                  <span className="text-muted-foreground truncate">
                    Marked ({markedCount})
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-md bg-emerald-600/80 border border-emerald-500/50 shrink-0 shadow-2xs" />
                  <span className="text-muted-foreground truncate">
                    Answered ({answeredUncheckedCount})
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-md bg-destructive/70 border border-destructive/50 shrink-0 shadow-2xs" />
                  <span className="text-muted-foreground truncate">
                    Not Answered ({notAnsweredCount})
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-md bg-muted/70 border border-border/80 shrink-0" />
                  <span className="text-muted-foreground truncate">
                    Not Visited ({notVisitedCount})
                  </span>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-3 sm:p-3.5 flex-1 flex flex-col no-scrollbar overflow-y-auto min-h-0">
              <div className="grid grid-cols-5 gap-2 sm:gap-2.5 w-full">
                {questions.map((q, idx) => {
                  const isChecked = revealedQuestions.has(q.id);
                  const sc = scores[q.id];
                  const isCurrent = idx === currentIndex;
                  const userVal = answers[q.id];
                  const isAnswered =
                    userVal !== undefined &&
                    userVal !== "" &&
                    (!Array.isArray(userVal) || userVal.length > 0);
                  const isVisited = visitedQuestions.has(q.id);
                  const isMarked = markedQuestions.has(q.id);

                  let btnStyle = "";
                  if (isChecked && sc) {
                    if (sc.status === "correct") {
                      btnStyle =
                        "bg-emerald-600 text-white border-emerald-600 shadow-xs dark:bg-emerald-600 dark:border-emerald-500";
                    } else if (sc.status === "partial") {
                      btnStyle =
                        "bg-amber-500 text-white border-amber-600 shadow-xs dark:bg-amber-500 dark:border-amber-600";
                    } else if (sc.status === "incorrect") {
                      btnStyle =
                        "bg-destructive text-white border-destructive shadow-xs dark:bg-destructive dark:border-destructive";
                    }
                  } else if (isMarked && isAnswered) {
                    btnStyle =
                      "bg-primary text-primary-foreground border-emerald-500 shadow-xs";
                  } else if (isMarked) {
                    btnStyle =
                      "bg-primary text-primary-foreground border-primary shadow-xs";
                  } else if (isAnswered) {
                    btnStyle =
                      "bg-emerald-600 text-white border-emerald-600 shadow-xs hover:bg-emerald-700 dark:bg-emerald-600 dark:border-emerald-500";
                  } else if (isVisited) {
                    btnStyle =
                      "bg-destructive text-destructive-foreground border-destructive shadow-xs hover:bg-destructive/90 dark:bg-destructive dark:border-destructive";
                  } else {
                    btnStyle =
                      "bg-muted/60 text-muted-foreground border-border/80 hover:bg-muted hover:text-foreground dark:bg-muted/30 dark:text-muted-foreground/80 dark:border-border/50";
                  }

                  if (isCurrent) {
                    btnStyle +=
                      " ring-2 ring-primary ring-offset-2 ring-offset-background font-black shadow-md scale-[1.03]";
                  }

                  return (
                    <button
                      key={q.id}
                      onClick={() => setCurrentIndex(idx)}
                      className={`h-11 sm:h-12 w-full min-w-0 rounded-xl font-mono text-sm font-bold border transition-all duration-150 cursor-pointer flex flex-col items-center justify-center relative py-1 ${btnStyle}`}
                    >
                      <span className="leading-tight">{idx + 1}</span>
                      {isChecked && sc && (
                        <span
                          className={`absolute top-[5px] right-[5px] h-3.5 w-3.5 rounded-full flex items-center justify-center shadow-xs ${
                            sc.status === "correct"
                              ? "bg-white text-emerald-700 dark:bg-white dark:text-emerald-700"
                              : sc.status === "partial"
                              ? "bg-white text-amber-700 dark:bg-white dark:text-amber-700"
                              : "bg-white text-destructive dark:bg-white dark:text-destructive"
                          }`}
                        >
                          {sc.status === "correct" ? (
                            <Check className="h-2 w-2 stroke-[3.5]" />
                          ) : sc.status === "partial" ? (
                            <span className="text-[8px] font-black leading-none">~</span>
                          ) : (
                            <X className="h-2 w-2 stroke-[3.5]" />
                          )}
                        </span>
                      )}
                      {isMarked && !isChecked && (
                        <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-white shadow-xs" />
                      )}
                      {isAnswered && isMarked && !isChecked && (
                        <span className="absolute bottom-1 h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-xs" />
                      )}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <ScientificCalculator
        isOpen={isCalcOpen}
        onClose={() => setIsCalcOpen(false)}
      />
    </div>
  );
}
