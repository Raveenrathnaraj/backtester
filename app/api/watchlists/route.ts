import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { watchlists } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
  const rows = db
    .select({
      id: watchlists.id,
      name: watchlists.name,
      baseIndex: watchlists.baseIndex,
      stockCount: watchlists.stockCount,
      symbols: watchlists.symbols,
      tokens: watchlists.tokens,
      createdAt: watchlists.createdAt,
      updatedAt: watchlists.updatedAt,
    })
    .from(watchlists)
    .all();

  return NextResponse.json(rows);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, baseIndex, symbols, tokens } = body;

  if (!name || !baseIndex || !Array.isArray(symbols) || !Array.isArray(tokens)) {
    return NextResponse.json(
      { error: 'name, baseIndex, symbols[], and tokens[] are required' },
      { status: 400 },
    );
  }

  if (symbols.length === 0) {
    return NextResponse.json(
      { error: 'At least one stock must be selected' },
      { status: 400 },
    );
  }

  const result = db
    .insert(watchlists)
    .values({
      name,
      baseIndex,
      symbols: JSON.stringify(symbols),
      tokens: JSON.stringify(tokens),
      stockCount: symbols.length,
    })
    .returning({ id: watchlists.id })
    .get();

  return NextResponse.json({ id: result.id }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  db.delete(watchlists).where(eq(watchlists.id, Number(id))).run();

  return NextResponse.json({ success: true });
}
