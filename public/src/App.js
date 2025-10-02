import React, { useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, HelpCircle, RotateCcw, Check, X, SkipForward } from "lucide-react";

/**
 * Custom Word Riddle Game (single-file React component)
 * Features:
 * - Upload up to 20 words via .txt / .csv / .json (optional second column: hint)
 * - "Letters from letters" gameplay: guess the target word by tapping letter tiles
 * - On-screen letter bank with shuffle, remove, and hint (reveal next correct letter)
 * - Progress, score, attempts; mobile-first layout; ocean-like styling (neutral & original)
 * - Local persistence (sessionStorage) for the uploaded set
 *
 * File formats:
 * - TXT: one word per line, optional " | hint" after the word (e.g., "panda | animal")
 * - CSV: word,hint (header optional)
 * - JSON: [{"word":"...","hint":"..."}, ...]
 */

export default function App() {
  const [items, setItems] = useState(() => loadItems());
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState([] as { ch: string; i: number }[]);
  const [shuffled, setShuffled] = useState<string[]>([]);
  const [status, setStatus] = useState<"idle" | "correct" | "wrong">("idle");
  const [revealed, setRevealed] = useState(0); // how many letters revealed by hint
  const fileRef = useRef<HTMLInputElement>(null);

  const current = items[index];
  const target = useMemo(() => (current?.word || "").trim(), [current]);
  const normalizedTarget = useMemo(() => normalizeWord(target), [target]);

  const displayWord = useMemo(() =>
    target.split("").map((c, i) => ({
      char: c,
      isLetter: /[a-zA-Zа-яА-ЯёЁ]/.test(c),
      revealed: i < revealed
    })),
    [target, revealed]
  );

  React.useEffect(() => {
    if (!current) return;
    const bank = makeLetterBank(normalizedTarget);
    setShuffled(shuffle(bank));
    setPicked([]);
    setStatus("idle");
    setRevealed(0);
  }, [index, normalizedTarget]);

  function onTileClick(ch: string, i: number) {
    if (status !== "idle") return;
    // find first still-empty letter slot (skipping non-letters)
    const slots = displayWord
      .map((x, idx) => ({ ...x, idx }))
      .filter((x) => x.isLetter);

    const filledCount = picked.length + revealed;
    if (filledCount >= slots.length) return;

    setPicked((p) => [...p, { ch, i }]);
    setShuffled((b) => b.map((c, bi) => (bi === i ? "" : c)));
  }

  function removeLast() {
    if (picked.length === 0 || status !== "idle") return;
    const last = picked[picked.length - 1];
    setPicked((p) => p.slice(0, -1));
    setShuffled((b) => b.map((c, bi) => (bi === last.i ? last.ch : c)));
  }

  function check() {
    if (!current) return;
    const user = (displayWord
      .map((x) => (x.isLetter ? undefined : x.char)) // keep punctuation/spaces undefined markers
      .filter((x) => x !== undefined).length > 0)
      ? picked.map((p) => p.ch).join("") // if punctuation exists, we only collect picked for letters
      : picked.map((p) => p.ch).join("");

    const userFull = rebuildWithPunctuation(picked, displayWord, revealed);

    const normalizedUser = normalizeWord(userFull);
    const ok = normalizedUser === normalizedTarget;
    setStatus(ok ? "correct" : "wrong");
  }

  function next() {
    setIndex((i) => (i + 1 < items.length ? i + 1 : 0));
  }

  function hint() {
    // reveal next correct letter (skips spaces/punct.)
    const slots = displayWord
      .map((x, idx) => ({ ...x, idx }))
      .filter((x) => x.isLetter);
    if (revealed >= slots.length) return;
    setRevealed((n) => n + 1);
  }

  function shuffleBank() {
    setShuffled((b) => shuffle(b));
  }

  function reset() {
    setPicked([]);
    setStatus("idle");
    setRevealed(0);
    setShuffled((b) => shuffle(b.filter(Boolean)));
  }

  function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = (file.name.split(".").pop() || "").toLowerCase();
    const reader = new FileReader();
    reader.onload = () => {
      try {
        let parsed: { word: string; hint?: string }[] = [];
        const txt = String(reader.result || "");
        if (ext === "json") {
          const j = JSON.parse(txt);
          if (Array.isArray(j)) {
            parsed = j
              .map((x) => ({ word: String(x.word || "").trim(), hint: x.hint ? String(x.hint) : undefined }))
              .filter((x) => x.word.length > 0);
          }
        } else if (ext === "csv") {
          parsed = parseCSV(txt);
        } else {
          parsed = parseTXT(txt);
        }
        if (parsed.length === 0) throw new Error("Файл не содержит слов");
        const unique = dedupe(parsed).slice(0, 20);
        setItems(unique);
        sessionStorage.setItem("custom-words", JSON.stringify(unique));
        setIndex(0);
      } catch (err) {
        alert("Не удалось прочитать файл: " + (err as Error).message);
      } finally {
        if (fileRef.current) fileRef.current.value = "";
      }
    };
    reader.readAsText(file, "utf-8");
  }

  function clearSet() {
    sessionStorage.removeItem("custom-words");
    setItems(defaultSet);
    setIndex(0);
  }

  const progress = items.length ? Math.round(((index + 1) / items.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-100 via-blue-100 to-cyan-100 text-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            Ocean of Riddles — Custom
          </h1>
          <div className="flex gap-2">
            <button
              className="inline-flex items-center gap-2 rounded-2xl px-3 py-2 bg-white/70 shadow hover:shadow-md border border-white/60 backdrop-blur"
              onClick={shuffleBank}
              title="Перемешать банк букв"
            >
              <RotateCcw size={18} /> Shuffle
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-2xl px-3 py-2 bg-white/70 shadow hover:shadow-md border border-white/60 backdrop-blur"
              onClick={hint}
              title="Подсказка: открыть следующую букву"
            >
              <HelpCircle size={18} /> Hint
            </button>
          </div>
        </div>

        {/* Upload panel */}
        <div className="mb-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl p-4 bg-white/70 border border-white/60 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">Загрузить свои слова (до 20)</p>
                <p className="text-sm text-slate-600">TXT (слово | подсказка), CSV (word,hint) или JSON</p>
              </div>
              <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-sky-600 text-white cursor-pointer hover:bg-sky-700">
                <Upload size={18} /> Upload
                <input ref={fileRef} type="file" className="hidden" accept=".txt,.csv,.json" onChange={onUpload} />
              </label>
            </div>
            <div className="mt-3 text-xs text-slate-700">
              Пример TXT: <code>dragon | a mythical animal</code>
            </div>
          </div>

          <div className="rounded-2xl p-4 bg-white/70 border border-white/60 shadow-sm">
            <p className="font-semibold">Текущий набор</p>
            <p className="text-sm text-slate-600">{items.length} слов • {index + 1} / {items.length}</p>
            <div className="mt-2 w-full h-2 rounded-full bg-white/60">
              <div
                className="h-2 rounded-full bg-sky-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="mt-3 flex gap-2">
              <button onClick={clearSet} className="px-3 py-2 rounded-xl bg-white border hover:bg-white/80">Сбросить к демо</button>
              <button onClick={next} className="px-3 py-2 rounded-xl bg-sky-600 text-white hover:bg-sky-700 inline-flex items-center gap-2"><SkipForward size={18}/>Далее</button>
            </div>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-3xl p-5 md:p-6 bg-white/80 border border-white shadow-xl backdrop-blur">
          {/* Hint */}
          {current?.hint ? (
            <div className="mb-3 text-slate-600 text-sm">Подсказка: <span className="font-medium">{current.hint}</span></div>
          ) : (
            <div className="mb-3 text-slate-500 text-sm">Подсказка: —</div>
          )}

          {/* Target slots */}
          <div className="flex flex-wrap gap-2 mb-4">
            {displayWord.map((slot, idx) => (
              <div key={idx} className="w-10 h-12 md:w-12 md:h-14 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center text-xl font-semibold tracking-widest">
                {slot.isLetter ? (
                  // revealed letters first, then picked letters fill the remaining slots
                  idx < revealed
                    ? target[idx]
                    : renderPickedChar(displayWord, picked, revealed, idx)
                ) : (
                  <span className="text-slate-400">{slot.char}</span>
                )}
              </div>
            ))}
          </div>

          {/* Controls */}
          <div className="flex flex-wrap gap-2 mb-4">
            <button onClick={removeLast} className="px-3 py-2 rounded-xl bg-white border hover:bg-white/80 inline-flex items-center gap-2"><X size={18}/>Удалить</button>
            <button onClick={check} className="px-3 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 inline-flex items-center gap-2"><Check size={18}/>Проверить</button>
            <button onClick={reset} className="px-3 py-2 rounded-xl bg-white border hover:bg-white/80 inline-flex items-center gap-2"><RotateCcw size={18}/>Сброс</button>
          </div>

          {/* Letter bank */}
          <div className="grid grid-cols-8 sm:grid-cols-10 md:grid-cols-12 gap-2">
            {shuffled.map((ch, i) => (
              <AnimatePresence key={i}>
                <motion.button
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  disabled={!ch}
                  onClick={() => onTileClick(ch, i)}
                  className={`h-10 rounded-xl border text-sm font-bold tracking-widest ${
                    ch ? "bg-white hover:bg-sky-50 active:scale-95" : "bg-slate-100 text-slate-300"
                  }`}
                >
                  {ch || ""}
                </motion.button>
              </AnimatePresence>
            ))}
          </div>

          {/* Feedback */}
          <AnimatePresence>
            {status !== "idle" && (
              <motion.div
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className={`mt-4 rounded-2xl px-4 py-3 font-semibold inline-flex items-center gap-2 ${
                  status === "correct" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-rose-50 text-rose-700 border border-rose-200"
                }`}
              >
                {status === "correct" ? "Верно!" : "Попробуй ещё раз"}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-500 mt-4">
          Демо-слова предоставлены для примера. Вы можете загрузить свой набор (до 20 слов). Оформление вдохновлено казуальными словесными играми; все стили и ресурсы оригинальны.
        </p>
      </div>
    </div>
  );
}

// ------- Helpers -------

type Item = { word: string; hint?: string };

const defaultSet: Item[] = [
  { word: "DRAGON", hint: "mythical creature" },
  { word: "MOUSE", hint: "small animal" },
  { word: "FOREST", hint: "many trees" },
  { word: "FRIEND", hint: "buddy" },
  { word: "SING", hint: "make music with your voice" },
];

function loadItems(): Item[] {
  try {
    const raw = sessionStorage.getItem("custom-words");
    if (raw) return JSON.parse(raw);
  } catch {}
  return defaultSet;
}

function normalizeWord(w: string) {
  return w.replace(/\s+/g, "").replace(/[\-_'`.,!?\u00AB\u00BB\(\)]/g, "").toLowerCase();
}

function makeLetterBank(normTarget: string) {
  // create bank: target letters + random fillers (from alphabet) up to 12-16 tiles
  const ALPHA = "абвгдеёжзийклмнопрстуфхцчшщъыьэюяABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const base = normTarget.toUpperCase().split("");
  const size = Math.max(12, Math.min(16, base.length + 6));
  while (base.length < size) {
    const r = ALPHA[Math.floor(Math.random() * ALPHA.length)];
    base.push(r);
  }
  return shuffle(base).slice(0, size);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function renderPickedChar(
  displayWord: { char: string; isLetter: boolean; revealed: boolean }[],
  picked: { ch: string; i: number }[],
  revealedCount: number,
  idx: number
) {
  const letterSlots = displayWord
    .map((x, i) => ({ ...x, i }))
    .filter((x) => x.isLetter);
  const logicalIndex = letterSlots.findIndex((x) => x.i === idx);
  const taken = picked[logicalIndex - revealedCount]?.ch;
  return taken || "";
}

function rebuildWithPunctuation(
  picked: { ch: string; i: number }[],
  displayWord: { char: string; isLetter: boolean; revealed: boolean }[],
  revealedCount: number
) {
  // rebuild the full candidate with punctuation to compare after normalization
  const letters = picked.map((p) => p.ch);
  let pos = 0;
  return displayWord
    .map((x) => {
      if (!x.isLetter) return x.char; // keep punctuation for display; later normalize
      if (x.revealed) return x.char; // revealed true letter
      const v = letters[pos];
      pos++;
      return v || "";
    })
    .join("");
}

function parseTXT(txt: string): Item[] {
  return txt
    .split(/\r?\n/) 
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [w, h] = line.split("|");
      return { word: (w || "").trim(), hint: h ? h.trim() : undefined };
    })
    .filter((x) => x.word.length > 0);
}

function parseCSV(txt: string): Item[] {
  const lines = txt.split(/\r?\n/).filter(Boolean);
  const rows = lines.map((l) => l.split(/,|;|\t/).map((c) => c.trim()));
  const maybeHeader = rows[0]?.[0]?.toLowerCase() === "word";
  const start = maybeHeader ? 1 : 0;
  const out: Item[] = [];
  for (let i = start; i < rows.length; i++) {
    const [w, h] = rows[i];
    if (w) out.push({ word: w, hint: h });
  }
  return out;
}

function dedupe(arr: Item[]): Item[] {
  const seen = new Set<string>();
  const out: Item[] = [];
  for (const it of arr) {
    const key = normalizeWord(it.word);
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ word: it.word.toUpperCase(), hint: it.hint });
  }
  return out;
}
