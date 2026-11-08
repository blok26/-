import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeArabic, isArabicGuessCorrect, getWordMask, generateWordHint } from './normalizeArabic';
import { ARABIC_WORDS, getRandomWord } from '../data/arabicWords';

test('normalizeArabic removes diacritics and tatweel', () => {
  assert.equal(normalizeArabic('قِطَّةٌ'), 'قطه');
  assert.equal(normalizeArabic('بَـطْـرِيقٌ'), 'بطريق');
});

test('normalizeArabic normalizes alef variants and ya variants', () => {
  assert.equal(normalizeArabic('أرنب إبريق آيس كريم'), 'ارنب ابريق ايس كريم');
  assert.equal(normalizeArabic('شاي بالنعناع على قهوة'), 'شاي بالنعناع علي قهوه');
});

test('isArabicGuessCorrect matches Egyptian slang, aliases, and prefix Al', () => {
  const koshariWord = ARABIC_WORDS.find((w) => w.id === 'eg_food_1')!;
  assert.ok(koshariWord);
  assert.equal(isArabicGuessCorrect('كشري', koshariWord), true);
  assert.equal(isArabicGuessCorrect('كشرى', koshariWord), true);
  assert.equal(isArabicGuessCorrect('الكشري', koshariWord), true);
  assert.equal(isArabicGuessCorrect('طبق كشري', koshariWord), true);
  assert.equal(isArabicGuessCorrect('كشري بالدقة', koshariWord), true);
  assert.equal(isArabicGuessCorrect('فول', koshariWord), false);

  const falafelWord = ARABIC_WORDS.find((w) => w.id === 'eg_food_2')!;
  assert.ok(falafelWord);
  assert.equal(isArabicGuessCorrect('طعمية', falafelWord), true);
  assert.equal(isArabicGuessCorrect('طعميه', falafelWord), true);
  assert.equal(isArabicGuessCorrect('فلافل', falafelWord), true);
  assert.equal(isArabicGuessCorrect('قرص طعمية', falafelWord), true);

  const toktokWord = ARABIC_WORDS.find((w) => w.id === 'eg_street_1')!;
  assert.ok(toktokWord);
  assert.equal(isArabicGuessCorrect('توكتوك', toktokWord), true);
  assert.equal(isArabicGuessCorrect('توك توك', toktokWord), true);
  assert.equal(isArabicGuessCorrect('تكتك', toktokWord), true);
  assert.equal(isArabicGuessCorrect('التوكتوك', toktokWord), true);
});

test('getWordMask masks letters with dashes preserving spaces', () => {
  const mask = getWordMask('كشري مصري');
  assert.equal(mask, 'ــــ ــــ');
});

test('generateWordHint computes word counts and reveals character correctly', () => {
  // Test single word: "طعمية"
  const hint1 = generateWordHint('طعمية', 0);
  assert.equal(hint1.wordCount, 1);
  assert.equal(hint1.letterCount, 5);
  assert.equal(hint1.initialMask, 'ـــــ');
  assert.equal(hint1.revealedChar, 'ط');
  assert.equal(hint1.revealedMask, 'طــــ');
  assert.ok(hint1.hintSummary.includes('كلمة واحدة'));
  assert.ok(hint1.hintSummary.includes('5 أحرف'));
  assert.ok(hint1.hintSummary.includes('«ط»'));

  // Test two words: "كشري مصري" with seed picking second letter "ش"
  const hint2 = generateWordHint('كشري مصري', 1);
  assert.equal(hint2.wordCount, 2);
  assert.equal(hint2.letterCount, 8);
  assert.equal(hint2.initialMask, 'ــــ ــــ');
  assert.equal(hint2.revealedChar, 'ش');
  assert.equal(hint2.revealedMask, 'ـشــ ــــ');
  assert.ok(hint2.hintSummary.includes('كلمتان'));
});

test('ARABIC_WORDS dataset contains at least 100 draw-friendly Egyptian slang items', () => {
  assert.ok(ARABIC_WORDS.length >= 100, `Found ${ARABIC_WORDS.length} words`);
  const word = getRandomWord('easy');
  assert.ok(word && word.displayWord.length > 0);
  assert.ok(word.category.length > 0);
});
