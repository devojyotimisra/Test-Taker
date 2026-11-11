from typing import List, Optional, Union
from pydantic import BaseModel

class Question(BaseModel):
    id: int
    number: int
    text: str
    type: str
    options: Optional[List[str]] = None
    correct_answer: Optional[Union[str, List[str], float]] = None
    marks: float = 1.0
    negative_marks: float = 0.0
    images: List[str] = []
    image_locations: List[int] = []

class Paper(BaseModel):
    title: str
    filename: str
    total_questions: int
    total_marks: float
    questions: List[Question]

class AnswerSubmission(BaseModel):
    question_id: int
    answer: Optional[Union[str, List[str], float]] = None

class QuestionScore(BaseModel):
    question_id: int
    marks_awarded: float
    max_marks: float
    status: str
    detail: str
    user_answer: Optional[Union[str, List[str], float]] = None
    correct_answer: Optional[Union[str, List[str], float]] = None
