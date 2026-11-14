import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  FileText,
  Upload,
  Zap,
  Search,
  BookOpen,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Check,
  X,
  Sparkles,
  Download,
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

interface FilterOption {
  id: string;
  label: string;
  badge?: string;
  count?: number;
}

interface FilterComboboxProps {
  items: FilterOption[];
  selectedValue: string;
  onSelect: (id: string) => void;
  allLabel: string;
  totalCount?: number;
  searchPlaceholder?: string;
  align?: "left" | "right";
}

function FilterCombobox({
  items,
  selectedValue,
  onSelect,
  allLabel,
  totalCount,
  searchPlaceholder = "Search...",
  align = "left",
}: FilterComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
      document.addEventListener("keydown", handleKeyDown);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const filteredItems = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase().trim();
    return items.filter(
      (item) =>
        item.id.toLowerCase().includes(q) ||
        item.label.toLowerCase().includes(q) ||
        (item.badge && item.badge.toLowerCase().includes(q)),
    );
  }, [items, search]);

  const selectedItem = useMemo(() => {
    return items.find((item) => item.id === selectedValue);
  }, [items, selectedValue]);

  const displayedTotal = totalCount !== undefined ? totalCount : items.length;

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full h-9 px-2.5 py-1.5 bg-background border border-border rounded-lg text-xs text-foreground flex items-center justify-between gap-1.5 hover:border-primary/50 focus:outline-hidden focus:ring-1 focus:ring-primary transition-all text-left cursor-pointer"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1 truncate">
          {selectedValue === "All" ? (
            <span className="text-foreground font-medium truncate">
              {allLabel} ({displayedTotal})
            </span>
          ) : (
            <>
              {selectedItem?.badge &&
                selectedItem.badge !== selectedItem.label && (
                  <span className="px-1.5 py-0.2 rounded bg-primary/10 text-primary font-mono font-bold text-[10px] shrink-0">
                    {selectedItem.badge}
                  </span>
                )}
              <span className="truncate text-foreground font-medium">
                {selectedItem?.label || selectedValue}
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 text-muted-foreground">
          {selectedValue !== "All" && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onSelect("All");
              }}
              className="p-0.5 rounded hover:text-foreground hover:bg-muted/60 transition-colors"
              title="Clear selection"
            >
              <X className="h-3 w-3" />
            </span>
          )}
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform duration-200 ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </div>
      </button>

      {isOpen && (
        <div
          className={`absolute top-full ${
            align === "right" ? "right-0" : "left-0"
          } mt-1.5 w-full min-w-[240px] max-w-full sm:max-w-md bg-card border border-border rounded-xl shadow-2xl z-50 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150`}
        >
          <div className="p-2 border-b border-border/60 bg-muted/20">
            <div className="relative w-full">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-8 pr-7 py-1.5 bg-background border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                onClick={(e) => e.stopPropagation()}
              />
              {search && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSearch("");
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>

          <div className="max-h-56 overflow-y-auto no-scrollbar p-1 space-y-0.5">
            <button
              type="button"
              onClick={() => {
                onSelect("All");
                setIsOpen(false);
              }}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                selectedValue === "All"
                  ? "bg-primary/10 text-primary font-semibold"
                  : "hover:bg-muted text-foreground"
              }`}
            >
              <div className="flex items-center gap-1.5">
                {selectedValue === "All" && (
                  <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                )}
                <span>{allLabel}</span>
              </div>
              <span className="text-[10px] text-muted-foreground font-mono">
                {displayedTotal}
              </span>
            </button>

            {filteredItems.map((item) => {
              const isSelected = selectedValue === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onSelect(item.id);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs text-left transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-primary/10 text-primary font-semibold"
                      : "hover:bg-muted text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-1.5 min-w-0 flex-1 truncate">
                    {isSelected && (
                      <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                    )}
                    {item.badge && item.badge !== item.label && (
                      <span className="px-1.5 py-0.2 rounded bg-muted font-mono font-bold text-[10px] text-foreground/80 shrink-0">
                        {item.badge}
                      </span>
                    )}
                    <span className="truncate text-xs font-medium">
                      {item.label}
                    </span>
                  </div>
                  {item.count !== undefined && (
                    <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}

            {filteredItems.length === 0 && (
              <div className="py-6 text-center text-xs text-muted-foreground">
                No results match "{search}"
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function LandingPage({ onUpload, onSelectPaper }: LandingPageProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"library" | "upload">(() => {
    return (
      (sessionStorage.getItem("tt_active_tab") as "library" | "upload") ||
      "library"
    );
  });

  const [uploading, setUploading] = useState<boolean>(false);
  const [dragOver, setDragOver] = useState<boolean>(false);

  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [courses, setCourses] = useState<CourseInfo[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState<boolean>(true);

  const [selectedCourse, setSelectedCourse] = useState<string>(() => {
    return sessionStorage.getItem("tt_selected_course") || "All";
  });
  const [selectedYear, setSelectedYear] = useState<string>(() => {
    return sessionStorage.getItem("tt_selected_year") || "All";
  });
  const [selectedExam, setSelectedExam] = useState<string>(() => {
    return sessionStorage.getItem("tt_selected_exam") || "All";
  });

  const [currentPageNum, setCurrentPageNum] = useState<number>(() => {
    const saved = sessionStorage.getItem("tt_page_num");
    return saved ? parseInt(saved, 10) || 1 : 1;
  });
  const pageSize = 24;

  const [loadingPaperId, setLoadingPaperId] = useState<string | null>(null);
  const [downloadingPaperId, setDownloadingPaperId] = useState<string | null>(
    null,
  );
  const isBusy = Boolean(uploading || loadingPaperId || downloadingPaperId);
  const isFirstRender = useRef(true);

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
    if (isBusy) return;
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
    if (isBusy) return;
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
    if (!onSelectPaper || isBusy) return;
    setLoadingPaperId(item.id);
    try {
      await onSelectPaper(item);
    } finally {
      setLoadingPaperId(null);
    }
  };

  const handleDownloadPaperPdf = async (item: CatalogItem) => {
    if (isBusy) return;
    setDownloadingPaperId(item.id);
    toast({
      type: "info",
      title: "Downloading Paper PDF",
      description: `Preparing question paper for "${item.course_code} - ${item.exam_type}"...`,
      duration: 3500,
    });

    try {
      const { downloadPaperPdf } = await import("../lib/latexPdfGenerator");
      await downloadPaperPdf(item);
      toast({
        type: "success",
        title: "Download Complete",
        description: `Saved "${item.course_code}_${item.year}_${item.exam_type}_Solutions.pdf" to your downloads.`,
        duration: 5000,
      });
    } catch (err: any) {
      toast({
        type: "error",
        title: "PDF Download Failed",
        description:
          err.message || "An error occurred while compiling the PDF.",
        duration: 6000,
      });
    } finally {
      setDownloadingPaperId(null);
    }
  };

  const filteredCatalog = useMemo(() => {
    return catalog.filter((item) => {
      if (selectedCourse !== "All" && item.course_code !== selectedCourse) {
        return false;
      }
      if (selectedYear !== "All" && String(item.year) !== selectedYear) {
        return false;
      }
      if (selectedExam !== "All" && item.exam_type !== selectedExam) {
        return false;
      }
      return true;
    });
  }, [catalog, selectedCourse, selectedYear, selectedExam]);

  useEffect(() => {
    sessionStorage.setItem("tt_active_tab", activeTab);
  }, [activeTab]);

  useEffect(() => {
    sessionStorage.setItem("tt_selected_course", selectedCourse);
  }, [selectedCourse]);

  useEffect(() => {
    sessionStorage.setItem("tt_selected_year", selectedYear);
  }, [selectedYear]);

  useEffect(() => {
    sessionStorage.setItem("tt_selected_exam", selectedExam);
  }, [selectedExam]);

  useEffect(() => {
    sessionStorage.setItem("tt_page_num", String(currentPageNum));
  }, [currentPageNum]);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setCurrentPageNum(1);
  }, [selectedCourse, selectedYear, selectedExam]);

  const totalPages = Math.ceil(filteredCatalog.length / pageSize) || 1;
  const paginatedPapers = useMemo(() => {
    const start = (currentPageNum - 1) * pageSize;
    return filteredCatalog.slice(start, start + pageSize);
  }, [filteredCatalog, currentPageNum, pageSize]);

  const courseOptions = useMemo(() => {
    return courses.map((c) => ({
      id: c.code,
      label: c.name,
      badge: c.code,
      count: c.total_papers,
    }));
  }, [courses]);

  const yearOptions = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of catalog) {
      if (item.year) {
        const y = String(item.year);
        counts[y] = (counts[y] || 0) + 1;
      }
    }
    const years = ["2026", "2025", "2024", "2023", "2022", "2021"];
    const allYearsInCat = Object.keys(counts).sort((a, b) =>
      b.localeCompare(a),
    );
    const finalYears = years.filter((y) => allYearsInCat.includes(y));
    for (const y of allYearsInCat) {
      if (!finalYears.includes(y)) finalYears.push(y);
    }
    return finalYears.map((yr) => ({
      id: yr,
      label: yr,
      badge: yr,
      count: counts[yr] || 0,
    }));
  }, [catalog]);

  const examOptions = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of catalog) {
      if (item.exam_type) {
        counts[item.exam_type] = (counts[item.exam_type] || 0) + 1;
      }
    }
    const defaultExams = ["Quiz 1", "Quiz 2", "End Term"];
    const badges: Record<string, string> = {
      "Quiz 1": "Q1",
      "Quiz 2": "Q2",
      "End Term": "ET",
    };
    const examKeys = Object.keys(counts);
    const sortedExams = defaultExams.filter((e) => examKeys.includes(e));
    for (const e of examKeys) {
      if (!sortedExams.includes(e)) sortedExams.push(e);
    }
    return sortedExams.map((exam) => ({
      id: exam,
      label: exam,
      badge: badges[exam] || exam.substring(0, 2).toUpperCase(),
      count: counts[exam] || 0,
    }));
  }, [catalog]);

  return (
    <div className="min-h-screen flex flex-col justify-between bg-background text-foreground transition-colors no-scrollbar">
      <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-background/95 backdrop-blur-md">
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
                disabled={isBusy}
                onClick={() => !isBusy && setActiveTab("library")}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === "library"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                } ${isBusy ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
              >
                <BookOpen className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Question Papers</span>
                <span className="sm:hidden">Papers</span>
              </button>
              <button
                type="button"
                disabled={isBusy}
                onClick={() => !isBusy && setActiveTab("upload")}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === "upload"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                } ${isBusy ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
              >
                <Upload className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Upload PDF</span>
                <span className="sm:hidden">PDF</span>
              </button>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main
        className={`flex-1 max-w-6xl w-full mx-auto px-4 py-6 flex flex-col ${
          activeTab === "upload" ? "justify-center" : "gap-6"
        }`}
      >
        {activeTab === "library" ? (
          <div className="flex flex-col gap-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-border/60 pb-4">
              <div>
                <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight font-serif text-foreground">
                  <span>IITM BS Exam Question Papers</span>
                </h1>
                <p className="text-xs text-muted-foreground mt-0.5 font-sans">
                  Select any past term paper.
                </p>
              </div>
            </div>

            <div className="bg-card border border-border rounded-2xl p-3 sm:p-4 shadow-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Course / Subject
                  </label>
                  <FilterCombobox
                    items={courseOptions}
                    selectedValue={selectedCourse}
                    onSelect={setSelectedCourse}
                    allLabel="All Courses"
                    totalCount={courses.length}
                    searchPlaceholder="Search courses or codes..."
                    align="left"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Year
                  </label>
                  <FilterCombobox
                    items={yearOptions}
                    selectedValue={selectedYear}
                    onSelect={setSelectedYear}
                    allLabel="All Years"
                    totalCount={yearOptions.length}
                    searchPlaceholder="Search years..."
                    align="left"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Exam Type
                  </label>
                  <FilterCombobox
                    items={examOptions}
                    selectedValue={selectedExam}
                    onSelect={setSelectedExam}
                    allLabel="All Exams"
                    totalCount={examOptions.length}
                    searchPlaceholder="Search exam types..."
                    align="right"
                  />
                </div>
              </div>
            </div>

            {loadingCatalog ? (
              <div className="py-20 text-center flex flex-col items-center justify-center gap-3">
                <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                <span className="text-xs text-muted-foreground">
                  Loading Question Paper Catalog...
                </span>
              </div>
            ) : filteredCatalog.length === 0 ? (
              <div className="py-16 text-center border border-dashed border-border rounded-2xl bg-card p-6">
                <BookOpen className="h-10 w-10 text-muted-foreground mx-auto mb-2 opacity-50" />
                <h3 className="font-bold text-sm text-foreground">
                  No Question Papers Match Your Filters
                </h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                  Try adjusting the course, year, or search terms to find
                  matching exam papers.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCourse("All");
                    setSelectedYear("All");
                    setSelectedExam("All");
                    setCurrentPageNum(1);
                    sessionStorage.removeItem("tt_selected_course");
                    sessionStorage.removeItem("tt_selected_year");
                    sessionStorage.removeItem("tt_selected_exam");
                    sessionStorage.removeItem("tt_page_num");
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
                    const isDownloadingThis = downloadingPaperId === item.id;
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
                              <span className="font-medium text-foreground">
                                {item.exam_type}
                              </span>
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
                                <strong className="text-foreground">
                                  {item.total_questions || "?"}
                                </strong>{" "}
                                Qs
                              </span>
                              {item.total_marks ? (
                                <span>
                                  <strong className="text-foreground">
                                    {item.total_marks}
                                  </strong>{" "}
                                  Marks
                                </span>
                              ) : null}
                            </div>

                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleDownloadPaperPdf(item)}
                                disabled={isBusy}
                                className="h-8 px-2.5 rounded-lg border border-border bg-background hover:bg-muted text-foreground text-xs font-medium shadow-2xs hover:border-primary/50 transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Download Question Paper PDF"
                              >
                                {isDownloadingThis ? (
                                  <div className="h-3 w-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                                ) : (
                                  <Download className="h-3.5 w-3.5 text-muted-foreground" />
                                )}
                                <span className="hidden sm:inline">
                                  {isDownloadingThis ? "PDF..." : "PDF"}
                                </span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleSelectPaperClick(item)}
                                disabled={isBusy}
                                className="h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-semibold shadow-xs hover:opacity-90 transition-opacity flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {isLoadingThis ? (
                                  <div className="h-3 w-3 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                                ) : (
                                  <Sparkles className="h-3 w-3" />
                                )}
                                <span>
                                  {isLoadingThis ? "Loading..." : "Start Test"}
                                </span>
                              </button>
                            </div>
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
                      {Math.min(
                        currentPageNum * pageSize,
                        filteredCatalog.length,
                      )}{" "}
                      of {filteredCatalog.length} papers
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          setCurrentPageNum((p) => Math.max(1, p - 1))
                        }
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
                        onClick={() =>
                          setCurrentPageNum((p) => Math.min(totalPages, p + 1))
                        }
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
          <div className="max-w-2xl w-full mx-auto flex flex-col gap-6 justify-center items-center my-auto">
            <div className="text-center max-w-xl mx-auto space-y-2.5">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight font-serif text-foreground leading-tight">
                Upload Custom Question Paper PDF
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground font-sans">
                Upload your own question paper PDF to start your assessment
                session with instant scoring and live timer tracking.
              </p>
            </div>

            <div className="w-full flex flex-col gap-4">
              <Card
                onDragOver={(e) => {
                  e.preventDefault();
                  if (!isBusy) setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  if (!isBusy) handleDrop(e);
                }}
                className={`border-2 border-dashed transition-all shadow-md ${
                  dragOver && !isBusy
                    ? "border-primary bg-primary/5 scale-[1.01]"
                    : "border-border bg-card"
                }`}
              >
                <CardContent className="p-8 sm:p-12 text-center space-y-4">
                  <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto shadow-xs">
                    {uploading ? (
                      <div className="h-7 w-7 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                    ) : (
                      <Upload className="h-7 w-7" />
                    )}
                  </div>

                  <div className="space-y-1">
                    <h3 className="font-bold text-base sm:text-lg">
                      {uploading
                        ? "Analyzing & Parsing PDF..."
                        : "Upload Assessment PDF"}
                    </h3>
                    <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                      {uploading
                        ? "Please wait while questions and diagrams are being extracted..."
                        : "Drag and drop any question paper PDF here, or select from your computer to load questions and diagrams."}
                    </p>
                  </div>

                  <div className="pt-2">
                    <label
                      className={`inline-block ${isBusy ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
                    >
                      <input
                        type="file"
                        accept=".pdf"
                        onChange={handleFileChange}
                        className="hidden"
                        disabled={isBusy}
                      />
                      <span
                        className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm shadow-xs transition-opacity ${isBusy ? "pointer-events-none opacity-60" : "hover:opacity-90"}`}
                      >
                        {uploading ? (
                          <div className="h-4 w-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                        ) : (
                          <FileText className="h-4 w-4" />
                        )}
                        <span>
                          {uploading
                            ? "Analyzing & Parsing PDF..."
                            : "Select PDF File"}
                        </span>
                      </span>
                    </label>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
