import React, { useState, useEffect, useMemo } from "react";
import {
  FileText,
  Upload,
  Zap,
  Search,
  BookOpen,
  Calendar,
  ChevronLeft,
  ChevronRight,
  X,
  Layers,
  Sparkles,
} from "lucide-react";
import { Card, CardContent } from "./ui/card";
import { ThemeToggle } from "./ThemeToggle";
import { useToast } from "./ui/toast";
import { CatalogItem, CourseInfo } from "../types";
import { fetchJsonWithFallback } from "../lib/assetService";

interface LandingPageProps {
  onUpload: (file: File) => Promise<void>;
  onSelectPaper?: (item: CatalogItem) => Promise<void>;
}

export function LandingPage({ onUpload, onSelectPaper }: LandingPageProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"library" | "upload">("library");

  const [uploading, setUploading] = useState<boolean>(false);
  const [dragOver, setDragOver] = useState<boolean>(false);

  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [courses, setCourses] = useState<CourseInfo[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState<boolean>(true);

  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedLevel, setSelectedLevel] = useState<string>("All");
  const [selectedCourse, setSelectedCourse] = useState<string>("All");
  const [selectedYear, setSelectedYear] = useState<string>("All");
  const [selectedExam, setSelectedExam] = useState<string>("All");

  const [currentPageNum, setCurrentPageNum] = useState<number>(1);
  const pageSize = 24;

  const [loadingPaperId, setLoadingPaperId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      try {
        const [catData, courseData] = await Promise.all([
          fetchJsonWithFallback<CatalogItem[]>("catalog.json"),
          fetchJsonWithFallback<CourseInfo[]>("courses.json"),
        ]);
        if (isMounted) {
          setCatalog(catData);
          setCourses(courseData);
        }
      } catch {
      } finally {
        if (isMounted) setLoadingCatalog(false);
      }
    };
    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      toast({
        type: "warning",
        title: "Unsupported File",
        description: "Please select a valid PDF file (.pdf).",
      });
      e.target.value = "";
      return;
    }
    setUploading(true);
    try {
      await onUpload(file);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      toast({
        type: "warning",
        title: "Unsupported File",
        description: "Please drop a valid PDF file (.pdf).",
      });
      return;
    }
    setUploading(true);
    try {
      await onUpload(file);
    } finally {
      setUploading(false);
    }
  };

  const handleSelectPaperClick = async (item: CatalogItem) => {
    if (!onSelectPaper || loadingPaperId) return;
    setLoadingPaperId(item.id);
    try {
      await onSelectPaper(item);
    } finally {
      setLoadingPaperId(null);
    }
  };

  const levels = [
    { id: "All", label: "All Levels" },
    { id: "Foundation", label: "Foundation" },
    { id: "Diploma in Programming", label: "Diploma Programming" },
    { id: "Diploma in Data Science", label: "Diploma Data Science" },
    { id: "Degree", label: "Degree" },
  ];

  const filteredCatalog = useMemo(() => {
    return catalog.filter((item) => {
      if (selectedLevel !== "All" && item.level !== selectedLevel) {
        return false;
      }
      if (selectedCourse !== "All" && item.course_code !== selectedCourse) {
        return false;
      }
      if (selectedYear !== "All" && String(item.year) !== selectedYear) {
        return false;
      }
      if (selectedExam !== "All" && item.exam_type !== selectedExam) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const haystack = `${item.course_code} ${item.course_name} ${item.title} ${item.year} ${item.exam_type} ${item.term}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [catalog, selectedLevel, selectedCourse, selectedYear, selectedExam, searchQuery]);

  useEffect(() => {
    setCurrentPageNum(1);
  }, [selectedLevel, selectedCourse, selectedYear, selectedExam, searchQuery]);

  const totalPages = Math.ceil(filteredCatalog.length / pageSize) || 1;
  const paginatedPapers = useMemo(() => {
    const start = (currentPageNum - 1) * pageSize;
    return filteredCatalog.slice(start, start + pageSize);
  }, [filteredCatalog, currentPageNum, pageSize]);

  const availableCourses = useMemo(() => {
    if (selectedLevel === "All") return courses;
    return courses.filter((c) => c.level === selectedLevel);
  }, [courses, selectedLevel]);

  return (
    <div className="min-h-screen flex flex-col justify-between bg-background text-foreground transition-colors overflow-y-auto no-scrollbar">
      <header className="shrink-0 border-b border-border/80 bg-background/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
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

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex items-center bg-muted/60 p-1 rounded-xl border border-border/60">
              <button
                type="button"
                onClick={() => setActiveTab("library")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === "library"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <BookOpen className="h-3.5 w-3.5" />
                <span>Question Papers</span>
                <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-primary/10 text-primary font-bold">
                  {catalog.length || 1417}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("upload")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === "upload"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Upload className="h-3.5 w-3.5" />
                <span>Upload PDF</span>
              </button>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6 flex flex-col gap-6">
        {activeTab === "library" ? (
          <div className="flex flex-col gap-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-border/60 pb-4">
              <div>
                <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight font-serif text-foreground flex items-center gap-2">
                  <span>IITM BS Exam Question Papers</span>
                  <span className="text-xs font-sans font-bold px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/25">
                    {filteredCatalog.length} Available
                  </span>
                </h1>
                <p className="text-xs text-muted-foreground mt-0.5 font-sans">
                  Select any past term paper to launch with automatic scoring, TCS iON calculator, and live timer.
                </p>
              </div>

              <div className="relative w-full md:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search subject, code, year..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 bg-card border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3 bg-card border border-border rounded-2xl p-3 sm:p-4 shadow-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mr-1.5 flex items-center gap-1">
                  <Layers className="h-3 w-3" /> Level:
                </span>
                {levels.map((lvl) => (
                  <button
                    key={lvl.id}
                    type="button"
                    onClick={() => {
                      setSelectedLevel(lvl.id);
                      setSelectedCourse("All");
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                      selectedLevel === lvl.id
                        ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                        : "bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {lvl.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-border/40">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Course / Subject
                  </label>
                  <select
                    value={selectedCourse}
                    onChange={(e) => setSelectedCourse(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                  >
                    <option value="All">All Courses ({availableCourses.length})</option>
                    {availableCourses.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code} - {c.name} ({c.total_papers})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Year
                  </label>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                  >
                    <option value="All">All Years</option>
                    <option value="2026">2026</option>
                    <option value="2025">2025</option>
                    <option value="2024">2024</option>
                    <option value="2023">2023</option>
                    <option value="2022">2022</option>
                    <option value="2021">2021</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Exam Type
                  </label>
                  <select
                    value={selectedExam}
                    onChange={(e) => setSelectedExam(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                  >
                    <option value="All">All Exams</option>
                    <option value="Quiz 1">Quiz 1</option>
                    <option value="Quiz 2">Quiz 2</option>
                    <option value="End Term">End Term</option>
                  </select>
                </div>
              </div>
            </div>

            {loadingCatalog ? (
              <div className="py-20 text-center flex flex-col items-center justify-center gap-3">
                <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                <span className="text-xs text-muted-foreground">Loading Question Paper Catalog...</span>
              </div>
            ) : filteredCatalog.length === 0 ? (
              <div className="py-16 text-center border border-dashed border-border rounded-2xl bg-card p-6">
                <BookOpen className="h-10 w-10 text-muted-foreground mx-auto mb-2 opacity-50" />
                <h3 className="font-bold text-sm text-foreground">No Question Papers Match Your Filters</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                  Try adjusting the level, course, year, or search terms to find matching exam papers.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedLevel("All");
                    setSelectedCourse("All");
                    setSelectedYear("All");
                    setSelectedExam("All");
                    setSearchQuery("");
                  }}
                  className="mt-3 px-3.5 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg text-xs font-semibold"
                >
                  Clear All Filters
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {paginatedPapers.map((item) => {
                    const isLoadingThis = loadingPaperId === item.id;
                    return (
                      <Card
                        key={item.id}
                        className="border border-border/80 hover:border-primary/60 bg-card hover:shadow-md transition-all flex flex-col justify-between group"
                      >
                        <CardContent className="p-4 flex flex-col gap-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider bg-primary/10 text-primary border border-primary/20">
                                {item.course_code}
                              </span>
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-muted text-muted-foreground">
                                {item.level}
                              </span>
                            </div>
                            <span className="text-[11px] font-bold text-foreground font-mono bg-muted/60 px-2 py-0.5 rounded-md">
                              {item.year || "PYQ"}
                            </span>
                          </div>

                          <div>
                            <h3 className="font-bold text-xs sm:text-sm text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                              {item.course_name}
                            </h3>
                            <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {item.term || "Term"}
                              </span>
                              <span>•</span>
                              <span className="font-medium text-foreground">{item.exam_type}</span>
                              {item.session && item.session !== "Standard" && (
                                <>
                                  <span>•</span>
                                  <span>{item.session}</span>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="pt-2 border-t border-border/40 flex items-center justify-between">
                            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                              <span>
                                <strong className="text-foreground">{item.total_questions || "?"}</strong> Qs
                              </span>
                              {item.total_marks ? (
                                <span>
                                  <strong className="text-foreground">{item.total_marks}</strong> Marks
                                </span>
                              ) : null}
                            </div>

                            <button
                              type="button"
                              onClick={() => handleSelectPaperClick(item)}
                              disabled={isLoadingThis}
                              className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold shadow-xs hover:opacity-90 transition-opacity flex items-center gap-1.5"
                            >
                              {isLoadingThis ? (
                                <div className="h-3 w-3 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                              ) : (
                                <Sparkles className="h-3 w-3" />
                              )}
                              <span>{isLoadingThis ? "Loading..." : "Start Test"}</span>
                            </button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-between pt-3 border-t border-border/60">
                    <span className="text-xs text-muted-foreground">
                      Showing {(currentPageNum - 1) * pageSize + 1} to{" "}
                      {Math.min(currentPageNum * pageSize, filteredCatalog.length)} of {filteredCatalog.length} papers
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setCurrentPageNum((p) => Math.max(1, p - 1))}
                        disabled={currentPageNum === 1}
                        className="px-2.5 py-1.5 rounded-lg border border-border text-xs text-foreground disabled:opacity-40 hover:bg-muted transition-colors flex items-center gap-1"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                        <span>Prev</span>
                      </button>

                      <span className="px-3 py-1 text-xs font-bold text-foreground">
                        {currentPageNum} / {totalPages}
                      </span>

                      <button
                        type="button"
                        onClick={() => setCurrentPageNum((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPageNum === totalPages}
                        className="px-2.5 py-1.5 rounded-lg border border-border text-xs text-foreground disabled:opacity-40 hover:bg-muted transition-colors flex items-center gap-1"
                      >
                        <span>Next</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="max-w-2xl w-full mx-auto flex flex-col gap-6 justify-center items-center py-6">
            <div className="text-center max-w-xl mx-auto space-y-2.5">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight font-serif text-foreground leading-tight">
                Upload Custom Question Paper PDF
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground font-sans">
                Upload your own question paper PDF to start your assessment session with instant scoring and live timer tracking.
              </p>
            </div>

            <div className="w-full flex flex-col gap-4">
              <Card
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                className={`border-2 border-dashed transition-all shadow-md ${
                  dragOver ? "border-primary bg-primary/5 scale-[1.01]" : "border-border bg-card"
                }`}
              >
                <CardContent className="p-8 sm:p-12 text-center space-y-4">
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
                      <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm shadow-xs hover:opacity-90 transition-opacity">
                        <FileText className="h-4 w-4" />
                        <span>{uploading ? "Uploading..." : "Select PDF File"}</span>
                      </span>
                    </label>
                  </div>
                </CardContent>
              </Card>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setActiveTab("library")}
                  className="text-xs text-primary hover:underline font-semibold"
                >
                  &larr; Or browse all 1,417 pre-loaded exam papers
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
