'use strict';

/**
 * Random document generator.
 * Produces a title plus paragraphs, always within the 500 word ceiling.
 */
(() => {
  const MAX_WORDS = 500;

  const adjectives = [
    'Quiet', 'Restless', 'Fractured', 'Luminous', 'Unreasonable', 'Deliberate',
    'Half-Finished', 'Copper', 'Nocturnal', 'Patient', 'Wandering', 'Tidal',
    'Improvised', 'Narrow', 'Careful', 'Borrowed', 'Distant', 'Unfinished'
  ];

  const nouns = [
    'Architecture', 'Gardens', 'Weather', 'Machines', 'Silence', 'Maps',
    'Rivers', 'Libraries', 'Signals', 'Thresholds', 'Harbors', 'Almanacs',
    'Corridors', 'Lighthouses', 'Workshops', 'Ledgers', 'Orchards', 'Tides'
  ];

  const titleTemplates = [
    (a, b) => `A Field Guide to ${a} ${b}`,
    (a, b) => `Notes on ${a} ${b}`,
    (a, b) => `The ${a} ${b}`,
    (a, b) => `On ${a} ${b}, and the Art of Waiting`,
    (a, b) => `${a} ${b}: A Short Inventory`,
    (a, b) => `Lessons from the ${a} ${b}`,
    (a, b) => `Ten ${a} Observations`,
    (a, b) => `Where the ${a} ${b} Ends`,
    (a, b) => `A Modest Theory of ${a} ${b}`,
    (a, b) => `Concerning ${a} ${b}`
  ];

  const openings = [
    'It began, as most useful things do, with a small mistake.',
    'Nobody remembers exactly when the habit started.',
    'There is a version of this story that fits on a single page, and this is not it.',
    'The first rule was simple: pay attention before you explain.',
    'Everyone agreed the plan was reasonable, which was the first warning sign.',
    'We arrived late, carrying more luggage than confidence.',
    'The instructions were clear, brief, and entirely wrong.',
    'Some places teach you their rhythm only after you stop rushing them.'
  ];

  const middles = [
    'By the second week, the routine had settled into something almost ceremonial: coffee at seven, notes at eight, silence until noon.',
    'What looked like disorder turned out to be a system with rules nobody had written down.',
    'The weather changed every hour, and with it the mood of the whole enterprise.',
    'There were, of course, objections, most of them reasonable and none of them fatal.',
    'Small decisions accumulated faster than anyone expected, the way gravel gathers at the bend of a stream.',
    'The map was accurate in every detail except the distances.',
    'We measured twice, argued once, and built the thing anyway.',
    'Morning brought clarity; afternoon brought doubt; evening brought a list of things to try tomorrow.',
    'The evidence was thin, but the story was good, and stories travel faster than evidence.',
    'A single unanswered question kept the project alive long after it should have ended.',
    'The work was slower than promised and better than planned.',
    'Someone suggested a shortcut, and someone else wrote down why it would not work.',
    'The room smelled of paper, rain, and the faint electrical hum of old equipment.',
    'Every tool had a place, and every place had a story about the last time it was used.',
    'Progress was measured in pages rather than miles, which suited everyone involved.',
    'The neighbors grew curious, then helpful, then indispensable.',
    'What began as an experiment became a habit, and the habit became a way of keeping time.',
    'Details that seemed trivial on Monday decided the whole outcome by Friday.',
    'A list of names was kept in the drawer, though no one could say who had started it.',
    'The plan survived contact with reality by becoming slightly smaller each day.',
    'In practice, the rules bent just enough to be useful.',
    'We learned to read the silence between the sentences.',
    'Every morning the list was rewritten, and every evening it looked almost the same.',
    'The arguments were long, the conclusions short, and the coffee endless.',
    'A neighbor offered advice, then tools, then a spare room for the overflow.',
    'Some of the measurements were guesses wearing the costume of precision.',
    'Rain became a schedule of its own, and we planned around it without saying so.',
    'The best ideas arrived while carrying something heavy up a narrow stair.',
    'Nothing was thrown away, which is why the shelves eventually needed a map.',
    'By the end, the method was clear to everyone and impossible to explain.'
  ];

  const closings = [
    'In the end, the result mattered less than the record of how it was reached.',
    'The lesson, if there was one, arrived quietly and refused to be summarized.',
    'We kept the notes, filed the receipts, and agreed to try again in the spring.',
    'Looking back, the delays were the most useful part of the whole affair.',
    'It remains unfinished, which is probably the honest way to leave it.',
    'No one claimed credit, and no one needed to.',
    'The file was closed, the lights were turned off, and the question stayed open.',
    'By morning the situation had resolved itself without consulting anyone.'
  ];

  function randomInt(min, max) {
    const range = max - min + 1;
    const limit = Math.floor(0x100000000 / range) * range;
    const buffer = new Uint32Array(1);
    let value;
    do {
      crypto.getRandomValues(buffer);
      value = buffer[0];
    } while (value >= limit);
    return min + (value % range);
  }

  const pick = (list) => list[randomInt(0, list.length - 1)];

  function pickSentence(pool, used, avoid) {
    const fresh = pool.filter((sentence) => sentence !== avoid && !used.has(sentence));
    if (fresh.length > 0) return pick(fresh);

    const alternate = pool.filter((sentence) => sentence !== avoid);
    if (alternate.length > 0) return pick(alternate);

    return pool[0];
  }

  function countWords(text) {
    return text.split(/\s+/).filter(Boolean).length;
  }

  function buildTitle() {
    return pick(titleTemplates)(pick(adjectives), pick(nouns));
  }

  function generateDocument() {
    const title = buildTitle();
    const used = new Set();
    let lastSentence = null;

    const paragraphCount = randomInt(3, 5);
    const paragraphs = [];

    for (let p = 0; p < paragraphCount; p += 1) {
      const sentences = [];

      if (p === 0) {
        const opening = pickSentence(openings, new Set(), null);
        sentences.push(opening);
      }

      const target = randomInt(3, 5);
      while (sentences.length < target) {
        const isFinalSentence =
          p === paragraphCount - 1 && sentences.length === target - 1;
        const pool = isFinalSentence ? closings : middles;
        const sentence = pickSentence(pool, used, lastSentence);
        used.add(sentence);
        sentences.push(sentence);
        lastSentence = sentence;
      }

      paragraphs.push(sentences.join(' '));
    }

    const total = () =>
      countWords(title) + paragraphs.reduce((sum, p) => sum + countWords(p), 0);

    // Hard guarantee: drop trailing sentences until the ceiling is respected.
    while (total() > MAX_WORDS && paragraphs.length > 0) {
      const lastIndex = paragraphs.length - 1;
      const sentences = paragraphs[lastIndex].match(/[^.]+\./g) || [];
      if (sentences.length > 1) {
        sentences.pop();
        paragraphs[lastIndex] = sentences.join(' ').trim();
      } else {
        paragraphs.pop();
      }
    }

    return { title, paragraphs, wordCount: total() };
  }

  window.PdfContent = { generateDocument, countWords, MAX_WORDS };
})();