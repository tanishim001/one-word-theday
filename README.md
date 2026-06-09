# 今日の言葉、知ってる？

Next.jsで作った「今日の単語に答える」MVPです。

## Features

- 今日の単語を1つ表示
- 「知ってる」「知らない」で投票
- 回答後に意味、例文、回答割合、共有用テキストを表示
- テスト用に過去単語を切り替え
- ローカルではSQLite、`DATABASE_URL`がある環境ではPostgresを使用

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Database

Without `DATABASE_URL`, the app uses `data/words.db` as a local SQLite fallback.

For production, create `.env.local`:

```env
DATABASE_URL="postgres://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require"
```

Then check the connection and seed data:

```bash
npm run db:check
```

## Deploy

See [DEPLOY.md](DEPLOY.md).
