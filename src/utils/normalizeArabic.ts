/**
 * Arabic Text Normalization utilities for fuzzy matching guesses in "ارسمها لو تقدر"
 */

export function normalizeArabic(text: string): string {
  if (!text) return '';

  let normalized = text.trim();

  // 1. Remove Arabic Tashkeel (diacritics: Fatha, Damma, Kasra, Sukun, Tanween, Shadda, etc.)
  normalized = normalized.replace(/[\u064B-\u0652\u0653-\u065F\u0670]/g, '');

  // 2. Remove Tatweel / Kashida (ـ)
  normalized = normalized.replace(/\u0640/g, '');

  // 3. Normalize Alef variants (أ, إ, آ, ٱ -> ا)
  normalized = normalized.replace(/[إأآٱ]/g, 'ا');

  // 4. Normalize Ya variants (ى -> ي)
  normalized = normalized.replace(/ى/g, 'ي');

  // 5. Normalize Ta Marbuta (ة -> ه) to allow both (e.g. قطة / قطه)
  normalized = normalized.replace(/ة/g, 'ه');

  // 6. Normalize Arabic punctuation and symbols
  normalized = normalized.replace(/[،؛؟«»""''!?:.\-_/\\()\[\]]/g, ' ');

  // 7. Collapse multiple spaces and trim
  normalized = normalized.replace(/\s+/g, ' ').trim().toLowerCase();

  return normalized;
}

export interface ArabicWord {
  id: string;
  displayWord: string;
  normalizedAnswer: string;
  acceptedAliases: string[];
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

/**
 * Checks if a user's guess matches the target word or any of its aliases
 */
export function isArabicGuessCorrect(guess: string, word: ArabicWord): boolean {
  if (!guess || !word) return false;

  const normalizedGuess = normalizeArabic(guess);
  if (!normalizedGuess) return false;

  const normalizedTarget = normalizeArabic(word.displayWord);
  if (normalizedGuess === normalizedTarget) return true;

  if (word.normalizedAnswer && normalizedGuess === normalizeArabic(word.normalizedAnswer)) {
    return true;
  }

  if (word.acceptedAliases && word.acceptedAliases.length > 0) {
    for (const alias of word.acceptedAliases) {
      if (normalizedGuess === normalizeArabic(alias)) {
        return true;
      }
    }
  }

  // Also check without "ال" definition prefix if both are single words (e.g. "السيارة" vs "سيارة")
  const stripAl = (w: string) => (w.startsWith('ال') && w.length > 3 ? w.slice(2) : w);
  const guessNoAl = stripAl(normalizedGuess);
  const targetNoAl = stripAl(normalizedTarget);

  if (guessNoAl === targetNoAl && guessNoAl.length > 1) {
    return true;
  }

  for (const alias of word.acceptedAliases || []) {
    const aliasNorm = normalizeArabic(alias);
    if (guessNoAl === stripAl(aliasNorm) && guessNoAl.length > 1) {
      return true;
    }
  }

  return false;
}

export interface WordHintResult {
  initialMask: string;
  revealedMask: string;
  revealedChar: string;
  revealedIndex: number;
  wordCount: number;
  letterCount: number;
  hintSummary: string;
}

/**
 * Masks a secret word for the guesser, showing blanks/letters count
 * e.g., "قطة نائمة" -> "ـــ ــــ" with word count indication
 */
export function getWordMask(word: string): string {
  if (!word) return '';
  return word
    .trim()
    .split(/\s+/)
    .map((part) => 'ـ'.repeat(Math.max(part.length, 1)))
    .join(' ');
}

/**
 * Generates initial mask and half-time revealed mask with a random letter revealed
 */
export function generateWordHint(displayWord: string, seed?: number): WordHintResult {
  if (!displayWord) {
    return {
      initialMask: '',
      revealedMask: '',
      revealedChar: '',
      revealedIndex: -1,
      wordCount: 0,
      letterCount: 0,
      hintSummary: '',
    };
  }

  const trimmed = displayWord.trim();
  const words = trimmed.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const letterCount = trimmed.replace(/\s+/g, '').length;

  const initialMask = words.map((w) => 'ـ'.repeat(Math.max(w.length, 1))).join(' ');

  // Identify non-space letter indices in displayWord
  const letterIndices: number[] = [];
  for (let i = 0; i < trimmed.length; i++) {
    if (trimmed[i] !== ' ') {
      letterIndices.push(i);
    }
  }

  if (letterIndices.length === 0) {
    return {
      initialMask,
      revealedMask: initialMask,
      revealedChar: '',
      revealedIndex: -1,
      wordCount,
      letterCount,
      hintSummary: `${wordCount} كلمات • ${letterCount} أحرف`,
    };
  }

  const pickOffset =
    seed !== undefined
      ? Math.abs(Math.floor(seed)) % letterIndices.length
      : Math.floor(Math.random() * letterIndices.length);
  const revealedIndex = letterIndices[pickOffset];
  const revealedChar = trimmed[revealedIndex];

  let revealedMask = '';
  for (let i = 0; i < trimmed.length; i++) {
    if (trimmed[i] === ' ') {
      revealedMask += ' ';
    } else if (i === revealedIndex) {
      revealedMask += revealedChar;
    } else {
      revealedMask += 'ـ';
    }
  }

  const wordLabel = wordCount === 1 ? 'كلمة واحدة' : wordCount === 2 ? 'كلمتان' : `${wordCount} كلمات`;
  const hintSummary = `${wordLabel} • ${letterCount} أحرف • تم كشف الحرف «${revealedChar}»`;

  return {
    initialMask,
    revealedMask,
    revealedChar,
    revealedIndex,
    wordCount,
    letterCount,
    hintSummary,
  };
}

