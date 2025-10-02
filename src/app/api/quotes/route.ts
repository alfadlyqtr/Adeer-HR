import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

export async function GET() {
  try {
    const filePath = path.resolve(process.cwd(), "quots");
    const raw = fs.readFileSync(filePath, "utf8");
    const quotes = raw
      .split(/\r?\n/)
      .filter((l) => l.trim().length > 0 && !/^\p{Emoji}|^[\p{S}\p{P}]{1,3}$/u.test(l))
      .filter((l) => !l.endsWith(":"));
    
    return NextResponse.json({ quotes });
  } catch (error) {
    console.error("Failed to load quotes:", error);
    return NextResponse.json({ quotes: [] });
  }
}
