"use client";

import { useEffect, useMemo, useState } from "react";
import type { Answer, WordWithVotes, WordsResponse } from "../lib/types";

const clientIdStorageKey = "word-client-id";

export default function Home() {
  const [words, setWords] = useState<WordWithVotes[]>([]);
  const [selectedWordId, setSelectedWordId] = useState("");
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [clientId, setClientId] = useState("");
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const savedClientId = getOrCreateClientId();
    setClientId(savedClientId);

    fetchWords(savedClientId)
      .then((payload) => {
        setWords(payload.words);
        setSelectedWordId(payload.todayWordId);
      })
      .catch(() => setError("単語データを読み込めませんでした。"))
      .finally(() => setLoading(false));
  }, []);

  const selectedWord = useMemo(
    () => words.find((word) => word.id === selectedWordId) ?? words[0],
    [selectedWordId, words],
  );

  useEffect(() => {
    setAnswer(selectedWord?.clientAnswer ?? null);
    setCopied(false);
  }, [selectedWord?.id, selectedWord?.clientAnswer]);

  const shareText = selectedWord
    ? `今日の言葉、知ってる？\n「${selectedWord.word}」(${selectedWord.reading})\n私は「${answer === "known" ? "知ってる" : "知らない"}」でした。`
    : "";

  const handleAnswer = async (nextAnswer: Answer) => {
    if (!selectedWord || !clientId) {
      return;
    }

    setVoting(true);
    setError("");
    setCopied(false);

    try {
      const response = await fetch("/api/votes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          wordId: selectedWord.id,
          clientId,
          answer: nextAnswer,
        }),
      });

      if (!response.ok) {
        throw new Error("Vote failed");
      }

      const payload = (await response.json()) as WordsResponse;
      setWords(payload.words);
      setAnswer(nextAnswer);
    } catch {
      setError("投票を保存できませんでした。もう一度お試しください。");
    } finally {
      setVoting(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(shareText);
    setCopied(true);
  };

  return (
    <main className="page">
      <div className="app-shell">
        <div className="title-block">
          <p className="eyebrow">今日の言葉、知ってる？</p>
          <h1>知らない言葉ほど、ちょっと面白い</h1>
        </div>

        <section className="panel" aria-label="今日の単語">
          {loading && <p className="state-message">読み込み中...</p>}

          {!loading && selectedWord && (
            <>
              <div className="word-area">
                <label className="select-label" htmlFor="word-select">
                  テストする単語
                </label>
                <select
                  id="word-select"
                  className="word-select"
                  value={selectedWord.id}
                  onChange={(event) => setSelectedWordId(event.target.value)}
                >
                  {words.map((word) => (
                    <option key={word.id} value={word.id}>
                      {word.publishDate} / {word.word}
                    </option>
                  ))}
                </select>

                <p className="date-label">{selectedWord.publishDate} の単語</p>
                <p className="word">{selectedWord.word}</p>
                <p className="reading">{selectedWord.reading}</p>

                <p className="question">この言葉、知ってる？</p>
                <div className="actions">
                  <button
                    className="choice-button primary"
                    type="button"
                    disabled={voting}
                    onClick={() => handleAnswer("known")}
                  >
                    知ってる
                  </button>
                  <button
                    className="choice-button"
                    type="button"
                    disabled={voting}
                    onClick={() => handleAnswer("unknown")}
                  >
                    知らない
                  </button>
                </div>
                {error && <p className="error-message">{error}</p>}
              </div>

              {answer && (
                <div className="result-area" aria-live="polite">
                  <div className="answer-pill">
                    あなたの回答: {answer === "known" ? "知ってる" : "知らない"}
                  </div>

                  <section className="section">
                    <p className="label">意味</p>
                    <p className="body-text">{selectedWord.meaning}</p>
                  </section>

                  <section className="section">
                    <p className="label">例文</p>
                    <p className="example">{selectedWord.example}</p>
                  </section>

                  <section className="section">
                    <p className="label">みんなの回答割合</p>
                    <div className="poll">
                      <PollRow label="知ってる" value={selectedWord.knownPercent} />
                      <PollRow
                        label="知らない"
                        value={selectedWord.unknownPercent}
                        variant="unknown"
                      />
                    </div>
                    <p className="vote-count">
                      {selectedWord.totalVotes}票 / 知ってる {selectedWord.knownVotes}票・知らない{" "}
                      {selectedWord.unknownVotes}票
                    </p>
                  </section>

                  <section className="section">
                    <p className="label">共有用テキスト</p>
                    <textarea className="share-box" readOnly value={shareText} />
                    <button className="secondary-button" type="button" onClick={handleCopy}>
                      {copied ? "コピーしました" : "コピーする"}
                    </button>
                  </section>
                </div>
              )}
            </>
          )}
        </section>

        {words.length > 0 && (
          <section className="history" aria-label="過去の単語">
            <div className="history-heading">
              <h2>過去の単語</h2>
              <span>{words.length}件</span>
            </div>
            <div className="history-list">
              {words.map((word) => (
                <button
                  className="history-item"
                  type="button"
                  key={word.id}
                  onClick={() => setSelectedWordId(word.id)}
                >
                  <span>
                    <strong>{word.word}</strong>
                    <small>
                      {word.publishDate} / {word.totalVotes}票
                    </small>
                  </span>
                  <span className="history-ratio">{word.knownPercent}%</span>
                </button>
              ))}
            </div>
          </section>
        )}

        <p className="footer-note">
          単語と投票数はDBに保存されます。認証なしのため、回答済み判定だけこの端末のIDをlocalStorageに保存します。
        </p>
      </div>
    </main>
  );
}

async function fetchWords(clientId: string) {
  const response = await fetch(`/api/words?clientId=${encodeURIComponent(clientId)}`);

  if (!response.ok) {
    throw new Error("Fetch failed");
  }

  const payload = (await response.json()) as WordsResponse;
  return payload;
}

function getOrCreateClientId() {
  const savedClientId = window.localStorage.getItem(clientIdStorageKey);
  if (savedClientId) {
    return savedClientId;
  }

  const nextClientId =
    typeof window.crypto.randomUUID === "function"
      ? window.crypto.randomUUID()
      : `client-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  window.localStorage.setItem(clientIdStorageKey, nextClientId);
  return nextClientId;
}

function PollRow({
  label,
  value,
  variant,
}: {
  label: string;
  value: number;
  variant?: "unknown";
}) {
  return (
    <div className="poll-row">
      <span>{label}</span>
      <span className="bar-track" aria-hidden="true">
        <span
          className={variant ? `bar-fill ${variant}` : "bar-fill"}
          style={{ width: `${value}%` }}
        />
      </span>
      <span>{value}%</span>
    </div>
  );
}
