import type { FlashcardRepository } from "./flashcardRepository.js";
import type { FlashcardAnswerRepository } from "./flashcardAnswerRepository.js";
import type { GraphRepository } from "./graphRepository.js";
import type { MistakeRepository } from "./mistakeRepository.js";
import type { SessionRepository } from "./sessionRepository.js";
import type { SkillRepository } from "./skillRepository.js";
import type { ExerciseRepository } from "./exerciseRepository.js";
import type { TopicPlanRepository } from "./topicPlanRepository.js";

export type { SessionRepository } from "./sessionRepository.js";
export type { FlashcardRepository } from "./flashcardRepository.js";
export type { FlashcardAnswerRepository } from "./flashcardAnswerRepository.js";
export type { GraphRepository } from "./graphRepository.js";
export type { MistakeRepository } from "./mistakeRepository.js";
export type { SkillRepository } from "./skillRepository.js";
export type { ExerciseRepository } from "./exerciseRepository.js";
export type { TopicPlanRepository } from "./topicPlanRepository.js";

export interface AppRepositories {
  sessions: SessionRepository;
  flashcards: FlashcardRepository;
  flashcardAnswers: FlashcardAnswerRepository;
  graph: GraphRepository;
  mistakes: MistakeRepository;
  skills: SkillRepository;
  exercises: ExerciseRepository;
  topicPlans: TopicPlanRepository;
}
