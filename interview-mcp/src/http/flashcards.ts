import type {
  Flashcard,
  FlashcardHistoryResponse,
  FlashcardListResponse,
  FlashcardListStatus,
} from "@mock-interview/shared";

export const DEFAULT_FLASHCARD_PAGE_SIZE = 20;
export const MAX_FLASHCARD_PAGE_SIZE = 100;

type ActiveCursor = { mode: "active"; dueDate: string; id: string };
type ArchivedCursor = { mode: "archived"; archivedAt: string; id: string };
type AllCursor = { mode: "all"; createdAt: string; id: string };
type FlashcardCursor = ActiveCursor | ArchivedCursor | AllCursor;

export interface PaginateFlashcardsOptions {
  status: FlashcardListStatus;
  topic?: string;
  limit: number;
  cursor?: string;
}

function compareActive(a: Flashcard, b: Flashcard): number {
  const dueCmp = a.dueDate.localeCompare(b.dueDate);
  return dueCmp !== 0 ? dueCmp : a.id.localeCompare(b.id);
}

function compareArchived(a: Flashcard, b: Flashcard): number {
  const archivedCmp = (b.archivedAt ?? "").localeCompare(a.archivedAt ?? "");
  return archivedCmp !== 0 ? archivedCmp : b.id.localeCompare(a.id);
}

function compareAll(a: Flashcard, b: Flashcard): number {
  const createdCmp = b.createdAt.localeCompare(a.createdAt);
  return createdCmp !== 0 ? createdCmp : b.id.localeCompare(a.id);
}

function encodeCursor(cursor: FlashcardCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

function decodeCursor(cursor: string): FlashcardCursor | null {
  try {
    const decoded = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as Partial<FlashcardCursor>;
    if (decoded.mode === "active" && typeof decoded.dueDate === "string" && typeof decoded.id === "string") {
      return decoded as ActiveCursor;
    }
    if (decoded.mode === "archived" && typeof decoded.archivedAt === "string" && typeof decoded.id === "string") {
      return decoded as ArchivedCursor;
    }
    if (decoded.mode === "all" && typeof decoded.createdAt === "string" && typeof decoded.id === "string") {
      return decoded as AllCursor;
    }
    return null;
  } catch {
    return null;
  }
}

function filterByStatus(cards: Flashcard[], status: FlashcardListStatus): Flashcard[] {
  if (status === "active") return cards.filter((card) => !card.archivedAt);
  if (status === "archived") return cards.filter((card) => Boolean(card.archivedAt));
  return cards;
}

function applyCursor(cards: Flashcard[], cursor: FlashcardCursor | null, status: FlashcardListStatus): Flashcard[] {
  if (!cursor) return cards;

  if (status === "active" && cursor.mode === "active") {
    return cards.filter((card) => card.dueDate > cursor.dueDate || (card.dueDate === cursor.dueDate && card.id > cursor.id));
  }

  if (status === "archived" && cursor.mode === "archived") {
    return cards.filter((card) => {
      const archivedAt = card.archivedAt ?? "";
      return archivedAt < cursor.archivedAt || (archivedAt === cursor.archivedAt && card.id < cursor.id);
    });
  }

  if (status === "all" && cursor.mode === "all") {
    return cards.filter((card) => card.createdAt < cursor.createdAt || (card.createdAt === cursor.createdAt && card.id < cursor.id));
  }

  return cards;
}

function sortCards(cards: Flashcard[], status: FlashcardListStatus): Flashcard[] {
  if (status === "active") return [...cards].sort(compareActive);
  if (status === "archived") return [...cards].sort(compareArchived);
  return [...cards].sort(compareAll);
}

function makeNextCursor(card: Flashcard, status: FlashcardListStatus): string {
  if (status === "active") {
    return encodeCursor({ mode: "active", dueDate: card.dueDate, id: card.id });
  }
  if (status === "archived") {
    return encodeCursor({ mode: "archived", archivedAt: card.archivedAt ?? "", id: card.id });
  }
  return encodeCursor({ mode: "all", createdAt: card.createdAt, id: card.id });
}

export function paginateFlashcards(cards: Flashcard[], options: PaginateFlashcardsOptions): FlashcardListResponse {
  const filteredByTopic = options.topic
    ? cards.filter((card) => card.topic === options.topic)
    : cards;
  const filteredByStatus = filterByStatus(filteredByTopic, options.status);
  const sorted = sortCards(filteredByStatus, options.status);
  const decodedCursor = options.cursor ? decodeCursor(options.cursor) : null;
  const sliced = applyCursor(sorted, decodedCursor, options.status);
  const window = sliced.slice(0, options.limit + 1);
  const items = window.slice(0, options.limit);
  const hasMore = window.length > options.limit;
  const nextCursor = hasMore && items.length > 0
    ? makeNextCursor(items[items.length - 1]!, options.status)
    : null;

  return { items, total: sorted.length, hasMore, nextCursor };
}

export function buildFlashcardHistory(cards: Flashcard[], selectedId: string): FlashcardHistoryResponse | null {
  const byId = new Map(cards.map((card) => [card.id, card]));
  const selected = byId.get(selectedId);
  if (!selected) return null;

  let root = selected;
  const seenParents = new Set<string>([root.id]);
  while (root.parentFlashcardId) {
    const parent = byId.get(root.parentFlashcardId);
    if (!parent || seenParents.has(parent.id)) break;
    root = parent;
    seenParents.add(parent.id);
  }

  const items: Flashcard[] = [];
  const seenItems = new Set<string>();
  let current: Flashcard | undefined = root;
  while (current && !seenItems.has(current.id)) {
    items.push(current);
    seenItems.add(current.id);
    current = current.replacedByFlashcardId ? byId.get(current.replacedByFlashcardId) : undefined;
  }

  return {
    selectedId,
    items,
    hasHistory: Boolean(selected.parentFlashcardId || selected.replacedByFlashcardId),
  };
}
