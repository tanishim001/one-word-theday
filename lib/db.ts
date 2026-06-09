import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";
import initSqlJs, { type Database } from "sql.js";
import { seedWords } from "../data/seedWords";
import type { Answer, WordWithVotes, WordsResponse } from "./types";

type DbRow = {
  id: string;
  word: string;
  reading: string;
  meaning: string;
  example: string;
  publish_date: string;
  known_votes: number;
  unknown_votes: number;
  sort_order: number;
  client_answer?: Answer | null;
};

const localDbPath = path.join(process.cwd(), "data", "words.db");

const globalForPostgres = globalThis as typeof globalThis & {
  wordAppSql?: postgres.Sql;
};

function getDatabaseUrl() {
  return process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
}

function shouldUsePostgres() {
  return Boolean(getDatabaseUrl());
}

function getPostgresClient() {
  const databaseUrl = getDatabaseUrl();

  if (!databaseUrl) {
    throw new Error("DATABASE_URL or POSTGRES_URL is not set.");
  }

  globalForPostgres.wordAppSql ??= postgres(databaseUrl, {
    max: 1,
  });

  return globalForPostgres.wordAppSql;
}

export async function getWords(clientId?: string | null): Promise<WordsResponse> {
  return shouldUsePostgres() ? getPostgresWords(clientId) : getLocalWords(clientId);
}

export async function saveVote({
  wordId,
  clientId,
  answer,
}: {
  wordId: string;
  clientId: string;
  answer: Answer;
}) {
  return shouldUsePostgres()
    ? savePostgresVote({ wordId, clientId, answer })
    : saveLocalVote({ wordId, clientId, answer });
}

async function ensurePostgresSchemaAndSeed(sql: postgres.Sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS words (
      id TEXT PRIMARY KEY,
      word TEXT NOT NULL,
      reading TEXT NOT NULL,
      meaning TEXT NOT NULL,
      example TEXT NOT NULL,
      publish_date TEXT NOT NULL,
      known_votes INTEGER NOT NULL DEFAULT 0,
      unknown_votes INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS client_votes (
      word_id TEXT NOT NULL REFERENCES words(id),
      client_id TEXT NOT NULL,
      answer TEXT NOT NULL CHECK (answer IN ('known', 'unknown')),
      updated_at TEXT NOT NULL,
      PRIMARY KEY (word_id, client_id)
    )
  `;

  for (const seedWord of seedWords) {
    await sql`
      INSERT INTO words (
        id, word, reading, meaning, example, publish_date,
        known_votes, unknown_votes, sort_order
      )
      VALUES (
        ${seedWord.id}, ${seedWord.word}, ${seedWord.reading}, ${seedWord.meaning},
        ${seedWord.example}, ${seedWord.publishDate}, ${seedWord.knownVotes},
        ${seedWord.unknownVotes}, ${seedWord.sortOrder}
      )
      ON CONFLICT(id) DO UPDATE SET
        word = excluded.word,
        reading = excluded.reading,
        meaning = excluded.meaning,
        example = excluded.example,
        publish_date = excluded.publish_date,
        sort_order = excluded.sort_order
    `;
  }
}

async function getPostgresWords(clientId?: string | null): Promise<WordsResponse> {
  const sql = getPostgresClient();
  await ensurePostgresSchemaAndSeed(sql);

  const rows = await sql<DbRow[]>`
    SELECT
      words.*,
      client_votes.answer AS client_answer
    FROM words
    LEFT JOIN client_votes
      ON client_votes.word_id = words.id
      AND client_votes.client_id = ${clientId ?? ""}
    ORDER BY words.sort_order ASC, words.publish_date DESC
  `;

  const words = rows.map((row) => mapWord(row, row.client_answer ?? null));

  return {
    todayWordId: words[0]?.id ?? "",
    words,
  };
}

async function savePostgresVote({
  wordId,
  clientId,
  answer,
}: {
  wordId: string;
  clientId: string;
  answer: Answer;
}) {
  const sql = getPostgresClient();
  await ensurePostgresSchemaAndSeed(sql);

  await sql.begin(async (transaction) => {
    const existingRows = await transaction<{ answer: Answer }[]>`
      SELECT answer
      FROM client_votes
      WHERE word_id = ${wordId}
      AND client_id = ${clientId}
      LIMIT 1
    `;

    const existing = existingRows[0]?.answer ?? null;
    const now = new Date().toISOString();

    if (existing === answer) {
      await transaction`
        UPDATE client_votes
        SET updated_at = ${now}
        WHERE word_id = ${wordId}
        AND client_id = ${clientId}
      `;
      return;
    }

    if (existing) {
      await transaction`
        UPDATE words
        SET
          known_votes = known_votes + ${existing === "known" ? -1 : 0},
          unknown_votes = unknown_votes + ${existing === "unknown" ? -1 : 0}
        WHERE id = ${wordId}
      `;
    }

    await transaction`
      UPDATE words
      SET
        known_votes = known_votes + ${answer === "known" ? 1 : 0},
        unknown_votes = unknown_votes + ${answer === "unknown" ? 1 : 0}
      WHERE id = ${wordId}
    `;

    await transaction`
      INSERT INTO client_votes (word_id, client_id, answer, updated_at)
      VALUES (${wordId}, ${clientId}, ${answer}, ${now})
      ON CONFLICT(word_id, client_id)
      DO UPDATE SET answer = excluded.answer, updated_at = excluded.updated_at
    `;
  });

  return getPostgresWords(clientId);
}

async function openLocalDatabase() {
  const SQL = await initSqlJs({
    locateFile: (file) => path.join(process.cwd(), "node_modules", "sql.js", "dist", file),
  });

  const fileBuffer = fs.existsSync(localDbPath) ? fs.readFileSync(localDbPath) : undefined;
  const db = fileBuffer ? new SQL.Database(fileBuffer) : new SQL.Database();

  ensureLocalSchemaAndSeed(db);
  saveLocalDatabase(db);

  return db;
}

function ensureLocalSchemaAndSeed(db: Database) {
  db.run(`
    CREATE TABLE IF NOT EXISTS words (
      id TEXT PRIMARY KEY,
      word TEXT NOT NULL,
      reading TEXT NOT NULL,
      meaning TEXT NOT NULL,
      example TEXT NOT NULL,
      publish_date TEXT NOT NULL,
      known_votes INTEGER NOT NULL DEFAULT 0,
      unknown_votes INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS client_votes (
      word_id TEXT NOT NULL,
      client_id TEXT NOT NULL,
      answer TEXT NOT NULL CHECK (answer IN ('known', 'unknown')),
      updated_at TEXT NOT NULL,
      PRIMARY KEY (word_id, client_id),
      FOREIGN KEY (word_id) REFERENCES words(id)
    );
  `);

  for (const seedWord of seedWords) {
    db.run(
      `
        INSERT INTO words (
          id, word, reading, meaning, example, publish_date,
          known_votes, unknown_votes, sort_order
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          word = excluded.word,
          reading = excluded.reading,
          meaning = excluded.meaning,
          example = excluded.example,
          publish_date = excluded.publish_date,
          sort_order = excluded.sort_order;
      `,
      [
        seedWord.id,
        seedWord.word,
        seedWord.reading,
        seedWord.meaning,
        seedWord.example,
        seedWord.publishDate,
        seedWord.knownVotes,
        seedWord.unknownVotes,
        seedWord.sortOrder,
      ],
    );
  }
}

function saveLocalDatabase(db: Database) {
  fs.mkdirSync(path.dirname(localDbPath), { recursive: true });
  fs.writeFileSync(localDbPath, Buffer.from(db.export()));
}

function getLocalClientAnswer(
  db: Database,
  wordId: string,
  clientId?: string | null,
): Answer | null {
  if (!clientId) {
    return null;
  }

  const statement = db.prepare(
    "SELECT answer FROM client_votes WHERE word_id = ? AND client_id = ? LIMIT 1",
  );
  statement.bind([wordId, clientId]);

  const answer = statement.step() ? (statement.getAsObject().answer as Answer) : null;
  statement.free();

  return answer;
}

function mapWord(row: DbRow | Record<string, unknown>, clientAnswer: Answer | null): WordWithVotes {
  const knownVotes = Number(row.known_votes);
  const unknownVotes = Number(row.unknown_votes);
  const totalVotes = knownVotes + unknownVotes;

  return {
    id: String(row.id),
    word: String(row.word),
    reading: String(row.reading),
    meaning: String(row.meaning),
    example: String(row.example),
    publishDate: String(row.publish_date),
    knownVotes,
    unknownVotes,
    sortOrder: Number(row.sort_order),
    totalVotes,
    knownPercent: totalVotes === 0 ? 0 : Math.round((knownVotes / totalVotes) * 100),
    unknownPercent: totalVotes === 0 ? 0 : Math.round((unknownVotes / totalVotes) * 100),
    clientAnswer,
  };
}

async function getLocalWords(clientId?: string | null): Promise<WordsResponse> {
  const db = await openLocalDatabase();
  const statement = db.prepare("SELECT * FROM words ORDER BY sort_order ASC, publish_date DESC");
  const words: WordWithVotes[] = [];

  while (statement.step()) {
    const row = statement.getAsObject();
    words.push(mapWord(row, getLocalClientAnswer(db, String(row.id), clientId)));
  }

  statement.free();
  db.close();

  return {
    todayWordId: words[0]?.id ?? "",
    words,
  };
}

async function saveLocalVote({
  wordId,
  clientId,
  answer,
}: {
  wordId: string;
  clientId: string;
  answer: Answer;
}) {
  const db = await openLocalDatabase();
  const existing = getLocalClientAnswer(db, wordId, clientId);
  const now = new Date().toISOString();

  db.run("BEGIN TRANSACTION");

  try {
    if (existing === answer) {
      db.run(
        "UPDATE client_votes SET updated_at = ? WHERE word_id = ? AND client_id = ?",
        [now, wordId, clientId],
      );
    } else {
      if (existing) {
        db.run(
          `UPDATE words
           SET known_votes = known_votes + ?, unknown_votes = unknown_votes + ?
           WHERE id = ?`,
          [existing === "known" ? -1 : 0, existing === "unknown" ? -1 : 0, wordId],
        );
      }

      db.run(
        `UPDATE words
         SET known_votes = known_votes + ?, unknown_votes = unknown_votes + ?
         WHERE id = ?`,
        [answer === "known" ? 1 : 0, answer === "unknown" ? 1 : 0, wordId],
      );

      db.run(
        `
          INSERT INTO client_votes (word_id, client_id, answer, updated_at)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(word_id, client_id)
          DO UPDATE SET answer = excluded.answer, updated_at = excluded.updated_at;
        `,
        [wordId, clientId, answer, now],
      );
    }

    db.run("COMMIT");
  } catch (error) {
    db.run("ROLLBACK");
    db.close();
    throw error;
  }

  saveLocalDatabase(db);
  db.close();

  return getLocalWords(clientId);
}
