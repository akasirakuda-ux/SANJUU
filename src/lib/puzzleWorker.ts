
export const WORKER_CODE = `
  const DIRECTIONS = [
    [1, 0], [0, 1], [1, 1], [-1, 1],
    [-1, 0], [0, -1], [-1, -1], [1, -1]
  ];
  const HIRAGANA = "あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん";
  const convertToHiragana = (text) => text ? text.replace(/[\\u30a1-\\u30f6]/g, (match) => String.fromCharCode(match.charCodeAt(0) - 0x60)) : text;
  const convertToKatakana = (text) => text ? text.replace(/[\\u3041-\\u3096]/g, (match) => String.fromCharCode(match.charCodeAt(0) + 0x60)) : text;
  const canonicalOccKey = (start, end) => {
    const k1 = start.x + ',' + start.y + '-' + end.x + ',' + end.y;
    const k2 = end.x + ',' + end.y + '-' + start.x + ',' + start.y;
    return k1 < k2 ? k1 : k2;
  };
  const dedupeOccurrences = (list) => {
    const seen = new Set();
    const out = [];
    for (const occ of list || []) {
      if (!occ || !occ.start || !occ.end) continue;
      const k = canonicalOccKey(occ.start, occ.end);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(occ);
    }
    return out;
  };

  class SeededRandom {
    constructor(seed) { this.seed = seed; }
    next() {
      this.seed = (this.seed * 9301 + 49297) % 233280;
      return this.seed / 233280;
    }
  }

  const LATIN_FILL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const EMOJI_SYMBOLS = ${JSON.stringify([
    '🐫', '☕', '🌸', '⭐', '🌙', '☀️', '🌈', '🍙', '🍵', '🍎',
    '🐱', '🐶', '🐟', '🦁', '🦙', '🐸', '🐧', '🐻', '🎮', '🧩',
    '🎵', '✨', '💮', '🌊', '🍀', '🎨', '📖', '🎁', '🏠', '🌳',
    '🔍', '💫', '🎈',
  ])};
  const splitPickupUnits = (wordStr, cs) => {
    const s = String(wordStr || '');
    if (!s) return [];
    if (cs !== 'emoji') return Array.from(s);
    const out = [];
    let i = 0;
    while (i < s.length) {
      let matched = '';
      for (let ei = 0; ei < EMOJI_SYMBOLS.length; ei++) {
        const sym = EMOJI_SYMBOLS[ei];
        if (s.startsWith(sym, i)) { matched = sym; break; }
      }
      if (!matched) {
        if (typeof Intl !== 'undefined' && Intl.Segmenter) {
          const seg = [...new Intl.Segmenter('ja', { granularity: 'grapheme' }).segment(s.slice(i))][0];
          matched = seg ? seg.segment : s[i];
        } else {
          matched = s[i];
        }
      }
      out.push(matched);
      i += matched.length;
    }
    return out;
  };
  self.onmessage = (e) => {
    const { category, size, cols, rows, dictionary, detectDictionary, targetWord, prohibitedWords, isKanji, seed, isKatakana, pickupCharset } = e.data;
    const gridCols = (typeof cols === 'number' && cols > 0) ? cols : size;
    const gridRows = (typeof rows === 'number' && rows > 0) ? rows : size;
    const rng = new SeededRandom(seed || Math.floor(Math.random() * 1000000));
    const prohibitedSet = new Set(prohibitedWords || []);
    const charset = pickupCharset === 'digit' || pickupCharset === 'latin' || pickupCharset === 'emoji' ? pickupCharset : 'hiragana';
    const pickPickupFill = () => {
      if (charset === 'digit') return String(Math.floor(rng.next() * 10));
      if (charset === 'latin') return LATIN_FILL[Math.floor(rng.next() * LATIN_FILL.length)];
      if (charset === 'emoji') return EMOJI_SYMBOLS[Math.floor(rng.next() * EMOJI_SYMBOLS.length)];
      const char = HIRAGANA[Math.floor(rng.next() * HIRAGANA.length)];
      return isKatakana ? convertToKatakana(char) : char;
    };
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
      if (charset === 'digit') return String(wordStr).replace(/[^0-9]/g, '');
      if (charset === 'latin') return String(wordStr).toUpperCase().replace(/[^A-Z]/g, '');
      if (charset === 'emoji') return String(wordStr);
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
      .filter(w => charset === 'hiragana' ? !prohibitedSet.has(convertToHiragana(w)) : true)
      .filter(w => (w || '').length >= MIN_WORD_LEN);

    const cleanTargetWord = (() => {
      const tw = typeof targetWord === 'string' ? targetWord : '';
      if (!tw) return '';
      if (charset === 'digit') return String(tw).replace(/[^0-9]/g, '');
      if (charset === 'latin') return String(tw).toUpperCase().replace(/[^A-Z]/g, '');
      if (charset === 'emoji') return String(tw);
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
        const placeWordRaw = cleanTargetWord || (cleanDict[0] || '');
        const placeUnits = splitPickupUnits(placeWordRaw, charset);
        const placeWord = placeUnits.join('');
        const maxWordLen = Math.max(gridCols, gridRows);
        if (!placeWord || placeUnits.length < 1 || placeUnits.length > maxWordLen) {
          self.postMessage({ grid: [], placedWords: [], density: 0 });
          return;
        }

        const fits = (x, y, dir, len) => {
          const ex = x + dir[0] * (len - 1);
          const ey = y + dir[1] * (len - 1);
          return ex >= 0 && ey >= 0 && ex < gridCols && ey < gridRows;
        };

        const scanOccurrences = (units) => {
          const occs = [];
          const len = units.length;
          const occFits = (x, y, dir) => {
            const ex = x + dir[0] * (len - 1);
            const ey = y + dir[1] * (len - 1);
            return ex >= 0 && ey >= 0 && ex < gridCols && ey < gridRows;
          };
          for (let y = 0; y < gridRows; y++) {
            for (let x = 0; x < gridCols; x++) {
              for (const dir of DIRECTIONS) {
                if (!occFits(x, y, dir)) continue;
                let ok = true;
                for (let i = 0; i < len; i++) {
                  const nx = x + dir[0] * i, ny = y + dir[1] * i;
                  if (grid[ny][nx] !== units[i]) { ok = false; break; }
                }
                if (ok) {
                  occs.push({ start: { x, y }, end: { x: x + dir[0] * (len - 1), y: y + dir[1] * (len - 1) } });
                }
              }
            }
          }
          return dedupeOccurrences(occs);
        };

        const grid = Array.from({ length: gridRows }, () => Array(gridCols).fill(''));
        const covered = new Set();
        let filledCount = 0;
        const targetDensity = 0.95;
        const cellCount = gridCols * gridRows;

        const writeTargetAt = (x, y, dir) => {
          if (!fits(x, y, dir, placeUnits.length)) return false;
          for (let i = 0; i < placeUnits.length; i++) {
            const nx = x + dir[0] * i, ny = y + dir[1] * i;
            if (grid[ny][nx] === '') filledCount++;
            grid[ny][nx] = placeUnits[i];
            covered.add(nx + ',' + ny);
          }
          return true;
        };

        const wl = Math.max(1, placeUnits.length);
        const coverageCells = cellCount * 0.85;
        const minForCoverage = Math.max(2, Math.ceil(coverageCells / (wl * 1.75)));
        const geometricCeiling = Math.max(2, Math.floor(cellCount / wl));
        const minOccurrences = Math.min(minForCoverage, geometricCeiling);
        const coverageTarget = 0.85;
        const maxPlaceTries = Math.min(cellCount * 35, 5000);
        const scanInterval = Math.max(10, Math.floor(cellCount / 15));
        const dirCounts = { H: 0, V: 0, D: 0 };
        const dirGroupFor = (dir) => {
          if (dir[1] === 0) return 'V';
          if (dir[0] === 0) return 'H';
          return 'D';
        };

        const placeTargetOnce = () => {
          // 方向の偏りを抑えてタテ・ヨコ・ナナメに散らす（行スイープは全行同一になるので使わない）
          const groups = ['H', 'V', 'D'].sort((a, b) => dirCounts[a] - dirCounts[b]);
          const tryDirs = [];
          for (const g of groups) {
            for (const dir of DIRECTIONS) {
              if (dirGroupFor(dir) === g) tryDirs.push(dir);
            }
          }
          for (let i = tryDirs.length - 1; i > 0; i--) {
            const j = Math.floor(rng.next() * (i + 1));
            const tmp = tryDirs[i];
            tryDirs[i] = tryDirs[j];
            tryDirs[j] = tmp;
          }
          for (const dir of tryDirs) {
            for (let t = 0; t < 6; t++) {
              const x = Math.floor(rng.next() * gridCols);
              const y = Math.floor(rng.next() * gridRows);
              if (writeTargetAt(x, y, dir)) {
                dirCounts[dirGroupFor(dir)]++;
                return true;
              }
            }
          }
          return false;
        };

        let occs = scanOccurrences(placeUnits);
        let tries = 0;
        while (tries < maxPlaceTries) {
          const coverageRatio = covered.size / cellCount;
          if (coverageRatio >= coverageTarget && occs.length >= minOccurrences) break;
          tries++;
          if (!placeTargetOnce()) continue;
          if (tries % scanInterval === 0 || coverageRatio >= coverageTarget) {
            occs = scanOccurrences(placeUnits);
            if (occs.length >= minOccurrences && covered.size / cellCount >= coverageTarget) break;
          }
          if (filledCount / cellCount >= targetDensity && occs.length >= minOccurrences) break;
        }
        if (!occs || occs.length === 0) {
          occs = scanOccurrences(placeUnits);
        }

        const rowsAllIdentical = () => {
          if (gridRows < 2) return false;
          const first = grid[0].join('');
          for (let y = 1; y < gridRows; y++) {
            if (grid[y].join('') !== first) return false;
          }
          return true;
        };
        if (rowsAllIdentical()) {
          let rescue = 0;
          while (rescue < maxPlaceTries && rowsAllIdentical()) {
            rescue++;
            placeTargetOnce();
          }
          occs = scanOccurrences(placeUnits);
        }

        // Fill remaining cells
        for (let y = 0; y < gridRows; y++) {
          for (let x = 0; x < gridCols; x++) {
            if (grid[y][x] === '') {
              grid[y][x] = pickPickupFill();
            }
          }
        }

        // Prohibited scrubbing (hiragana only)
        if (charset === 'hiragana') {
          let foundProhibited = true;
          let safetyTries = 0;
          while (foundProhibited && safetyTries < 10) {
            foundProhibited = false;
            safetyTries++;
            for (let y = 0; y < gridRows; y++) {
              for (let x = 0; x < gridCols; x++) {
                for (const dir of DIRECTIONS) {
                  let s = "";
                  for (let l = 0; l < Math.max(gridCols, gridRows); l++) {
                    const nx = x + dir[0] * l, ny = y + dir[1] * l;
                    if (nx < 0 || ny < 0 || nx >= gridCols || ny >= gridRows) break;
                    s += grid[ny][nx];
                    if (s.length >= 2 && prohibitedSet.has(convertToHiragana(s))) {
                      const changeIdx = Math.floor(rng.next() * s.length);
                      const cx = x + dir[0] * changeIdx, cy = y + dir[1] * changeIdx;
                      grid[cy][cx] = pickPickupFill();
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
        }

        // 禁止語除去後に出現数が足りなければ追加配置（上書き可）
        occs = scanOccurrences(placeUnits);
        let boostTries = 0;
        const boostScanEvery = Math.max(8, Math.floor(minOccurrences / 8));
        while (occs.length < minOccurrences && boostTries < maxPlaceTries) {
          boostTries++;
          if (!placeTargetOnce()) continue;
          if (boostTries % boostScanEvery === 0) {
            occs = scanOccurrences(placeUnits);
          }
        }
        occs = scanOccurrences(placeUnits);

        const placedWords = occs.length > 0 ? [{ word: placeWord, occurrences: occs }] : [];
        self.postMessage({ grid, placedWords, density: covered.size / cellCount, occurrenceCount: occs.length });
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
      const maxPoolChars = size * size * (isSearchMode ? 3 : 1.5); // search: ~2× pool for more target placements
      
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

      const finalWords = Array.from(foundMap.values()).map((w) => ({
        word: w.word,
        occurrences: dedupeOccurrences(w.occurrences),
      }));
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
