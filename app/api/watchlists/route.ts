import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '@/lib/get-user-id';
import { createServiceClient } from '@/lib/supabase/service';

const supabase = createServiceClient();

export async function GET(request: NextRequest) {
  const userId = getUserIdFromRequest(request);

  const { data, error } = await supabase
    .from('watchlists')
    .select('id, name, base_index, stock_count, symbols, tokens, created_at, updated_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Map column names to camelCase for frontend compatibility
  const rows = (data ?? []).map((row: any) => ({
    id: row.id,
    name: row.name,
    baseIndex: row.base_index,
    stockCount: row.stock_count,
    symbols: row.symbols,
    tokens: row.tokens,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  return NextResponse.json(rows);
}

export async function POST(request: NextRequest) {
  const userId = getUserIdFromRequest(request);
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

  const { data, error } = await supabase
    .from('watchlists')
    .insert({
      user_id: userId,
      name,
      base_index: baseIndex,
      symbols,
      tokens,
      stock_count: symbols.length,
    })
    .select('id')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: data.id }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const userId = getUserIdFromRequest(request);
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const { error } = await supabase
    .from('watchlists')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
