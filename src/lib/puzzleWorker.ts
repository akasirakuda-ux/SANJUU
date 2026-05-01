
export const WORKER_CODE = `
  const DIRECTIONS = [
    [1, 0], [0, 1], [1, 1], [-1, 1],
    [-1, 0], [0, -1], [-1, -1], [1, -1]
  ];
  const HIRAGANA = "あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん";
  const convertToHiragana = (text) => text ? text.replace(/[\\u30a1-\\u30f6]/g, (match) => String.fromCharCode(match.charCodeAt(0) - 0x60)) : text;
  const convertToKatakana = (text) => text ? text.replace(/[\\u3041-\\u3096]/g, (match) => String.fromCharCode(match.charCodeAt(0) + 0x60)) : text;

  class SeededRandom {
    constructor(seed) { this.seed = seed; }
    next() {
      this.seed = (this.seed * 9301 + 49297) % 233280;
      return this.seed / 233280;
    }
  }

  self.onmessage = (e) => {
    const { category, size, dictionary, detectDictionary, targetWord, prohibitedWords, isKanji, seed, isKatakana } = e.data;
    const rng = new SeededRandom(seed || Math.floor(Math.random() * 1000000));
    const prohibitedSet = new Set(prohibitedWords || []);
    const isTokaido = category === 'tokaido_53_kanji' || category === 'tokaido_53_hiragana';
    if (isTokaido) {
      const tkSize = size;
      const kanjiMode = category === 'tokaido_53_kanji';
      const shuffle = (array) => {
        for (let i = array.length - 1; i > 0; i--) {
          const j = Math.floor(rng.next() * (i + 1));
          [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
      };
      const normalizeWord = (w) => {
        if (!w) return '';
        if (kanjiMode) return w;
        const h = convertToHiragana(w).replace(/[^ぁ-んー]/g, '');
        return isKatakana ? convertToKatakana(h) : h;
      };
      const rawWords = (dictionary || []).map((w) => (typeof w === 'string' ? w : w.word)).filter(Boolean);
      let tkDict = Array.from(new Set(rawWords.map(normalizeWord))).filter((w) => w.length >= 1 && w.length <= tkSize);
      tkDict = tkDict.filter((w) => !prohibitedSet.has(convertToHiragana(w)));
      const charPool = [];
      const seenCh = new Set();
      for (let wi = 0; wi < tkDict.length; wi++) {
        const w = tkDict[wi];
        for (let ci = 0; ci < w.length; ci++) {
          const ch = w[ci];
          if (!seenCh.has(ch)) {
            seenCh.add(ch);
            charPool.push(ch);
          }
        }
      }
      if (charPool.length === 0) {
        self.postMessage({ grid: [], placedWords: [], density: 0 });
        return;
      }
      const pickFill = () => charPool[Math.floor(rng.next() * charPool.length)];
      let best = null;
      const maxAttempts = 100;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const grid = Array.from({ length: tkSize }, () => Array(tkSize).fill(''));
        const wordsTry = shuffle([...tkDict]);
        wordsTry.sort((a, b) => b.length - a.length);
        for (let wi = 0; wi < wordsTry.length; wi++) {
          const word = wordsTry[wi];
          for (let t = 0; t < 800; t++) {
            const dir = DIRECTIONS[Math.floor(rng.next() * DIRECTIONS.length)];
            const x = Math.floor(rng.next() * tkSize);
            const y = Math.floor(rng.next() * tkSize);
            let ok = true;
            for (let i = 0; i < word.length; i++) {
              const nx = x + dir[0] * i;
              const ny = y + dir[1] * i;
              if (nx < 0 || ny < 0 || nx >= tkSize || ny >= tkSize) {
                ok = false;
                break;
              }
              const g = grid[ny][nx];
              if (g !== '' && g !== word[i]) {
                ok = false;
                break;
              }
            }
            if (!ok) continue;
            for (let i = 0; i < word.length; i++) {
              const nx = x + dir[0] * i;
              const ny = y + dir[1] * i;
              grid[ny][nx] = word[i];
            }
            break;
          }
        }
        for (let yy = 0; yy < tkSize; yy++) {
          for (let xx = 0; xx < tkSize; xx++) {
            if (grid[yy][xx] === '') grid[yy][xx] = pickFill();
          }
        }
        let foundProhibited = true;
        let safetyTries = 0;
        while (foundProhibited && safetyTries < 10) {
          foundProhibited = false;
          safetyTries++;
          for (let yy = 0; yy < tkSize; yy++) {
            for (let xx = 0; xx < tkSize; xx++) {
              for (let di = 0; di < DIRECTIONS.length; di++) {
                const dir = DIRECTIONS[di];
                let s = '';
                for (let l = 0; l < tkSize; l++) {
                  const nx = xx + dir[0] * l;
                  const ny = yy + dir[1] * l;
                  if (nx < 0 || ny < 0 || nx >= tkSize || ny >= tkSize) break;
                  s += grid[ny][nx];
                  if (s.length >= 2 && prohibitedSet.has(convertToHiragana(s))) {
                    const changeIdx = Math.floor(rng.next() * s.length);
                    const cx = xx + dir[0] * changeIdx;
                    const cy = yy + dir[1] * changeIdx;
                    grid[cy][cx] = pickFill();
                    foundProhibited = true;
                    break;
                  }
                }
                if (foundProhibited) break;
              }
              if (foundProhibited) break;
            }
            if (foundProhibited) break;
          }
        }
        const dictSet = new Set(tkDict);
        const foundMap = new Map();
        for (let yy = 0; yy < tkSize; yy++) {
          for (let xx = 0; xx < tkSize; xx++) {
            for (let di = 0; di < DIRECTIONS.length; di++) {
              const dir = DIRECTIONS[di];
              let s = '';
              for (let l = 0; l < tkSize; l++) {
                const nx = xx + dir[0] * l;
                const ny = yy + dir[1] * l;
                if (nx < 0 || ny < 0 || nx >= tkSize || ny >= tkSize) break;
                s += grid[ny][nx];
                if (s.length >= 1 && dictSet.has(s)) {
                  if (!foundMap.has(s)) foundMap.set(s, { word: s, occurrences: [] });
                  foundMap.get(s).occurrences.push({ start: { x: xx, y: yy }, end: { x: nx, y: ny } });
                }
              }
            }
          }
        }
        const finalWords = Array.from(foundMap.values());
        const density = 1;
        if (finalWords.length === 0) continue;
        if (!best || finalWords.length > best.placedWords.length) {
          best = { grid, placedWords: finalWords, density };
        }
      }
      self.postMessage(best || { grid: [], placedWords: [], density: 0 });
      return;
    }
    const isSearchMode = category === 'search' || category === 'pickup';
    // 「ことば探し」の正解として直感的に認識できる最小長。
    // ただし辞書（カテゴリ）に 1文字の正解が含まれる場合は例外として許可する。
    // 例: せいざ「ほ/や/ろ」, からだ「め/は」など
    // 検索モードは targetWord が 1 文字の可能性もあるので常に 1。
    const detectSource = Array.isArray(detectDictionary) && detectDictionary.length > 0 ? detectDictionary : dictionary;
    const normalizeWord = (wordStr) => {
      if (!wordStr) return '';
      if (isKanji) return wordStr;
      const hira = convertToHiragana(wordStr).replace(/[^ぁ-んー]/g, '');
      return isKatakana ? convertToKatakana(hira) : hira;
    };
    const dictHasSingleChar = (() => {
      if (!Array.isArray(detectSource)) return false;
      for (let i = 0; i < detectSource.length; i++) {
        const raw = detectSource[i];
        const w0 = typeof raw === 'string' ? raw : raw && typeof raw.word === 'string' ? raw.word : '';
        const w = normalizeWord(w0);
        if (!w) continue;
        if (prohibitedSet.has(convertToHiragana(w))) continue;
        if (w.length === 1) return true;
      }
      return false;
    })();
    const MIN_WORD_LEN = isSearchMode ? 1 : (dictHasSingleChar ? 1 : 2);
    
    const lengthBuckets = {};
    for (let i = 1; i <= size; i++) lengthBuckets[i] = [];

    // Handle both string and WordData objects (detection dictionary)
    const cleanDict = Array.from(new Set((detectSource || []).map((w) => {
      const wordStr = typeof w === 'string' ? w : w.word;
      return normalizeWord(wordStr);
    })))
      .filter(w => !prohibitedSet.has(convertToHiragana(w)))
      .filter(w => (w || '').length >= MIN_WORD_LEN);

    const cleanTargetWord = (() => {
      const tw = typeof targetWord === 'string' ? targetWord : '';
      if (!tw) return '';
      if (isKanji) return tw;
      const hira = convertToHiragana(tw).replace(/[^ぁ-んー]/g, '');
      return isKatakana ? convertToKatakana(hira) : hira;
    })();
    
    cleanDict.forEach((w) => {
      if (w.length >= 1 && w.length <= size) {
        lengthBuckets[w.length].push(w);
      }
    });

    const dirGroups = {
      H: DIRECTIONS.filter(d => d[0] !== 0 && d[1] === 0),
      V: DIRECTIONS.filter(d => d[0] === 0 && d[1] !== 0),
      D: DIRECTIONS.filter(d => d[0] !== 0 && d[1] !== 0)
    };

    let bestAttempt = null;
    const maxGlobalAttempts = 50;
    
    for (let globalAttempt = 0; globalAttempt < maxGlobalAttempts; globalAttempt++) {
      const grid = Array.from({ length: size }, () => Array(size).fill(''));
      const dirCounts = { H: 0, V: 0, D: 0 };
      let filledCount = 0;
      const targetDensity = 0.95;

      // Special: pickup mode generation is deterministic by intent.
      // 1) Place ONLY the target word repeatedly until coverage >= 80%.
      // 2) Fill remaining empty cells with random chars.
      // 3) Re-scan the board to collect ONLY the target word occurrences.
      if (category === 'pickup') {
        const placeWord = cleanTargetWord || (cleanDict[0] || '');
        if (!placeWord || placeWord.length < 1 || placeWord.length > size) {
          self.postMessage({ grid: [], placedWords: [], density: 0 });
          return;
        }

        const fits = (x, y, dir, len) => {
          const ex = x + dir[0] * (len - 1);
          const ey = y + dir[1] * (len - 1);
          return ex >= 0 && ey >= 0 && ex < size && ey < size;
        };

        const covered = new Set();
        const coverageTarget = 0.7;
        const maxPlaceTries = size * size * 80;
        let tries = 0;
        while (covered.size / (size * size) < coverageTarget && tries < maxPlaceTries) {
          tries++;
          const dir = DIRECTIONS[Math.floor(rng.next() * DIRECTIONS.length)];
          const x = Math.floor(rng.next() * size);
          const y = Math.floor(rng.next() * size);
          if (!fits(x, y, dir, placeWord.length)) continue;
          for (let i = 0; i < placeWord.length; i++) {
            const nx = x + dir[0] * i, ny = y + dir[1] * i;
            if (grid[ny][nx] === '') filledCount++;
            grid[ny][nx] = placeWord[i];
            covered.add(nx + ',' + ny);
          }
          if (filledCount / (size * size) >= targetDensity) break;
        }

        // Fill remaining cells
        for (let y = 0; y < size; y++) {
          for (let x = 0; x < size; x++) {
            if (grid[y][x] === '') {
              const char = HIRAGANA[Math.floor(rng.next() * HIRAGANA.length)];
              grid[y][x] = isKatakana ? convertToKatakana(char) : char;
            }
          }
        }

        // Prohibited scrubbing (same as legacy)
        let foundProhibited = true;
        let safetyTries = 0;
        while (foundProhibited && safetyTries < 10) {
          foundProhibited = false;
          safetyTries++;
          for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
              for (const dir of DIRECTIONS) {
                let s = "";
                for (let l = 0; l < size; l++) {
                  const nx = x + dir[0] * l, ny = y + dir[1] * l;
                  if (nx < 0 || ny < 0 || nx >= size || ny >= size) break;
                  s += grid[ny][nx];
                  if (s.length >= 2 && prohibitedSet.has(convertToHiragana(s))) {
                    const changeIdx = Math.floor(rng.next() * s.length);
                    const cx = x + dir[0] * changeIdx, cy = y + dir[1] * changeIdx;
                    const char = HIRAGANA[Math.floor(rng.next() * HIRAGANA.length)];
                    grid[cy][cx] = isKatakana ? convertToKatakana(char) : char;
                    foundProhibited = true;
                    break;
                  }
                }
                if (foundProhibited) break;
              }
              if (foundProhibited) break;
            }
            if (foundProhibited) break;
          }
        }

        // Re-scan to collect ONLY the target word occurrences (accidental words are NOT answers).
        const scanOccurrences = (word) => {
          const occs = [];
          const len = word.length;
          const fits = (x, y, dir) => {
            const ex = x + dir[0] * (len - 1);
            const ey = y + dir[1] * (len - 1);
            return ex >= 0 && ey >= 0 && ex < size && ey < size;
          };
          for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
              for (const dir of DIRECTIONS) {
                if (!fits(x, y, dir)) continue;
                let ok = true;
                for (let i = 0; i < len; i++) {
                  const nx = x + dir[0] * i, ny = y + dir[1] * i;
                  if (grid[ny][nx] !== word[i]) { ok = false; break; }
                }
                if (ok) {
                  occs.push({ start: { x, y }, end: { x: x + dir[0] * (len - 1), y: y + dir[1] * (len - 1) } });
                }
              }
            }
          }
          return occs;
        };

        const occs = scanOccurrences(placeWord);
        const placedWords = occs.length > 0 ? [{ word: placeWord, occurrences: occs }] : [];
        self.postMessage({ grid, placedWords, density: covered.size / (size * size) });
        return;
      }
      
      const pool = [];
      const bucketIdx = {};
      const bucketOrder = {};
      const shuffle = (array) => {
        for (let i = array.length - 1; i > 0; i--) {
          const j = Math.floor(rng.next() * (i + 1));
          [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
      };
      const lengths = Object.keys(lengthBuckets).map(Number).filter(l => lengthBuckets[l].length > 0);
      lengths.forEach(l => {
        bucketIdx[l] = 0;
        bucketOrder[l] = shuffle([...lengthBuckets[l]]);
      });

      let tempLen = [...lengths];
      let poolChars = 0;
      const maxPoolChars = size * size * 1.5; // Adjusted density target
      
      while (poolChars < maxPoolChars && tempLen.length > 0) {
        let addedInRound = false;
        for (let i = 0; i < tempLen.length; i++) {
          const l = tempLen[i];
          if (isSearchMode) {
            // In search mode, we want multiple instances of the same target word
            const word = bucketOrder[l][0];
            pool.push(word);
            poolChars += word.length;
            addedInRound = true;
            // The user requested no limit on the number of instances.
            // The while loop condition (poolChars < maxPoolChars) will eventually stop this.
          } else if (bucketIdx[l] < bucketOrder[l].length) {
            const word = bucketOrder[l][bucketIdx[l]++];
            pool.push(word);
            poolChars += word.length;
            addedInRound = true;
          } else {
            tempLen.splice(i, 1);
            i--;
          }
        }
        if (!addedInRound) break;
      }

      const minWordsNeeded = isSearchMode ? 1 : Math.min(pool.length, 1);

      for (const word of pool) {
        let bestPos = null;

        // Search/Pickup mode: prioritize high coverage by allowing overwrites.
        // This dramatically increases the number of embedded occurrences.
        if (isSearchMode) {
          for (let tries = 0; tries < 300; tries++) {
            const dir = DIRECTIONS[Math.floor(rng.next() * DIRECTIONS.length)];
            const x = Math.floor(rng.next() * size);
            const y = Math.floor(rng.next() * size);
            let can = true;
            for (let i = 0; i < word.length; i++) {
              const nx = x + dir[0] * i, ny = y + dir[1] * i;
              if (nx < 0 || ny < 0 || nx >= size || ny >= size) { can = false; break; }
            }
            if (can) { bestPos = { x, y, dir, type: 'H', score: word.length }; break; }
          }
          if (bestPos) {
            for (let i = 0; i < word.length; i++) {
              const nx = bestPos.x + bestPos.dir[0] * i;
              const ny = bestPos.y + bestPos.dir[1] * i;
              if (grid[ny][nx] === '') filledCount++;
              grid[ny][nx] = word[i];
            }
          }
        } else {
          const sortedTypes = (['H', 'V', 'D']).sort((a, b) => dirCounts[a] - dirCounts[b]);

          for (const type of sortedTypes) {
            const groupDirs = dirGroups[type];
            for (let tries = 0; tries < 100; tries++) {
              const dir = groupDirs[Math.floor(rng.next() * groupDirs.length)];
              const x = Math.floor(rng.next() * size);
              const y = Math.floor(rng.next() * size);
              
              let can = true;
              let overlaps = 0;
              for (let i = 0; i < word.length; i++) {
                const nx = x + dir[0] * i, ny = y + dir[1] * i;
                if (nx < 0 || ny < 0 || nx >= size || ny >= size) { can = false; break; }
                if (grid[ny][nx] !== '' && grid[ny][nx] !== word[i]) { can = false; break; }
                if (grid[ny][nx] === word[i]) overlaps++;
              }
              if (can) {
                const score = overlaps * 150 + word.length;
                if (!bestPos || score > bestPos.score) bestPos = { x, y, dir, type, score };
              }
            }
            if (bestPos && bestPos.score > word.length) break;
          }

          if (bestPos) {
            for (let i = 0; i < word.length; i++) {
              const nx = bestPos.x + bestPos.dir[0] * i;
              const ny = bestPos.y + bestPos.dir[1] * i;
              if (grid[ny][nx] === '') filledCount++;
              grid[ny][nx] = word[i];
            }
            dirCounts[bestPos.type]++;
          }
        }
        if (filledCount / (size * size) >= targetDensity) break;
      }

      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          if (grid[y][x] === '') {
            if (isKanji) {
              // For Kanji puzzles, use a pool of Kanji from the dictionary as filler
              const randomWord = cleanDict[Math.floor(rng.next() * cleanDict.length)];
              grid[y][x] = randomWord[Math.floor(rng.next() * randomWord.length)];
            } else {
              const char = HIRAGANA[Math.floor(rng.next() * HIRAGANA.length)];
              grid[y][x] = isKatakana ? convertToKatakana(char) : char;
            }
          }
        }
      }

      let foundProhibited = true;
      let safetyTries = 0;
      while (foundProhibited && safetyTries < 10) {
        foundProhibited = false;
        safetyTries++;
        for (let y = 0; y < size; y++) {
          for (let x = 0; x < size; x++) {
            for (const dir of DIRECTIONS) {
              let s = "";
              for (let l = 0; l < size; l++) {
                const nx = x + dir[0] * l, ny = y + dir[1] * l;
                if (nx < 0 || ny < 0 || nx >= size || ny >= size) break;
                s += grid[ny][nx];
                if (s.length >= 2 && prohibitedSet.has(convertToHiragana(s))) {
                  const changeIdx = Math.floor(rng.next() * s.length);
                  const cx = x + dir[0] * changeIdx, cy = y + dir[1] * changeIdx;
                  const char = HIRAGANA[Math.floor(rng.next() * HIRAGANA.length)];
                  grid[cy][cx] = isKatakana ? convertToKatakana(char) : char;
                  foundProhibited = true;
                  break;
                }
              }
              if (foundProhibited) break;
            }
            if (foundProhibited) break;
          }
          if (foundProhibited) break;
        }
      }

      const foundMap = new Map();
      const dictSet = new Set(cleanDict);
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          for (const dir of DIRECTIONS) {
            let s = "";
            for (let l = 0; l < size; l++) {
              const nx = x + dir[0] * l, ny = y + dir[1] * l;
              if (nx < 0 || ny < 0 || nx >= size || ny >= size) break;
              s += grid[ny][nx];
              if (s.length >= MIN_WORD_LEN && dictSet.has(s)) {
                if (!foundMap.has(s)) {
                  foundMap.set(s, { word: s, occurrences: [] });
                }
                foundMap.get(s).occurrences.push({ start: { x, y }, end: { x: nx, y: ny } });
              }
            }
          }
        }
      }

      const finalWords = Array.from(foundMap.values());
      const density = filledCount / (size * size);
      const allDirsUsed = dirCounts.H > 0 && dirCounts.V > 0 && dirCounts.D > 0;
      const hasTargetWords = isSearchMode ? finalWords.some(w => w.word === cleanDict[0]) : finalWords.length > 0;

      if (hasTargetWords && (size < 6 || (density >= 0.70 && (allDirsUsed || pool.length < 3)))) {
        bestAttempt = { grid, placedWords: finalWords, density };
        break;
      }
      if (!bestAttempt || (hasTargetWords && finalWords.length > bestAttempt.placedWords.length)) {
        bestAttempt = { grid, placedWords: finalWords, density };
      }
    }
    self.postMessage(bestAttempt || { grid: [], placedWords: [], density: 0 });
  };
`;
