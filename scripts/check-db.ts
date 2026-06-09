import { loadEnvConfig } from "@next/env";
import postgres from "postgres";
import { seedWords } from "../data/seedWords";

loadEnvConfig(process.cwd());

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error(
    [
      "DATABASE_URL is not set.",
      "",
      "1. Create a Postgres database, for example on Neon.",
      "2. Copy the pooled connection string.",
      "3. Create .env.local from .env.example and paste it as DATABASE_URL.",
      "4. Run npm run db:check again.",
    ].join("\n"),
  );
  process.exit(1);
}

main(databaseUrl).catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});

async function main(url: string) {
  const sql = postgres(url, { max: 1 });

  try {
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

    const [summary] = await sql<{ word_count: number; total_votes: number }[]>`
      SELECT
        COUNT(*)::int AS word_count,
        COALESCE(SUM(known_votes + unknown_votes), 0)::int AS total_votes
      FROM words
    `;

    console.log("Database connection OK.");
    console.log(`Seed words: ${summary.word_count}`);
    console.log(`Total votes: ${summary.total_votes}`);
  } finally {
    await sql.end();
  }
}
