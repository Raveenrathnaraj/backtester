import { NextRequest } from 'next/server';
import {
  getStrategy,
  updateStrategy,
  deleteStrategy,
} from '@/lib/db/strategy-store';
import { validateStrategy } from '@/lib/strategy-validator';

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/strategy/:id
 */
export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const strategy = getStrategy(Number(id));

  if (!strategy) {
    return Response.json({ error: 'Strategy not found' }, { status: 404 });
  }

  return Response.json(strategy);
}

/**
 * PUT /api/strategy/:id
 * Update (overwrite) a strategy.
 */
export async function PUT(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const numId = Number(id);

  const existing = getStrategy(numId);
  if (!existing) {
    return Response.json({ error: 'Strategy not found' }, { status: 404 });
  }

  let body: {
    name: string;
    description: string;
    code: string;
    chatHistory?: any[];
  };

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { name, description, code, chatHistory } = body;

  if (!name || !description || !code) {
    return Response.json(
      { error: 'Missing name, description, or code' },
      { status: 400 },
    );
  }

  // Validate the strategy code
  const validation = validateStrategy(code);
  if (!validation.valid) {
    return Response.json(
      { error: `Strategy validation failed: ${validation.error}` },
      { status: 422 },
    );
  }

  updateStrategy(numId, name, description, code, chatHistory);

  return Response.json({ success: true });
}

/**
 * DELETE /api/strategy/:id
 */
export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const numId = Number(id);

  const existing = getStrategy(numId);
  if (!existing) {
    return Response.json({ error: 'Strategy not found' }, { status: 404 });
  }

  if (existing.isDefault) {
    return Response.json(
      { error: 'Cannot delete the default strategy' },
      { status: 403 },
    );
  }

  deleteStrategy(numId);

  return Response.json({ success: true });
}
