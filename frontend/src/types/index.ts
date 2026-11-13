export type AnswerType = "MCQ" | "multichoice" | "numeric";

export interface Question {
  id: number;
  number: number;
  original_number?: number | null;
  text: string;
  type: AnswerType;
  options: string[] | null;
  correct_answer?: string | string[] | number | null;
  marks: number;
  negative_marks: number;
  images: string[];
  image_locations: number[];
  comprehension_passage?: string | null;
  group_id?: string | null;
  section_name?: string | null;
}

export interface Paper {
  title: string;
  filename: string;
  total_questions: number;
  total_marks: number;
  questions?: Question[];
}

export interface QuestionScore {
  question_id: number;
  marks_awarded: number;
  max_marks: number;
  status: "correct" | "partial" | "incorrect" | "unattempted";
  detail: string;
  user_answer?: string | string[] | number | null;
  correct_answer?: string | string[] | number | null;
}

export type UserAnswers = Record<number, string | string[] | number | null>;
export type QuestionStatus =
  | "not_visited"
  | "not_answered"
  | "answered"
  | "marked"
  | "marked_answered";

export interface CatalogItem {
  id: string;
  filename: string;
  json_file: string;
  title: string;
  course_code: string;
  course_name: string;
  level: string;
  year: number;
  term: string;
  term_code: string;
  exam_type: string;
  session: string;
  total_questions: number;
  total_marks: number;
  json_url: string;
}

export interface CourseInfo {
  code: string;
  name: string;
  level: string;
  total_papers: number;
  years: number[];
  terms: string[];
  exam_types: string[];
}
