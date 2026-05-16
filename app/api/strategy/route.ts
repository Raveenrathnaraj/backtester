import { NextRequest } from 'next/server';
import {
  listStrategies,
  createStrategy,
  seedDefaultStrategy,
} from '@/lib/db/strategy-store';
import { validateStrategy } from '@/lib/strategy-validator';

/**
 * GET /api/strategy
 * List all strategies. Seeds the default if none exist.
 */
export async function GET() {
  // Ensure default strategy exists
  seedDefaultStrategy();

  const strategies = listStrategies();

  return Response.json(strategies);
}

/**
 * POST /api/strategy
 * Create a new strategy.
 * Body: { name, description, code, chatHistory? }
 */
export async function POST(request: NextRequest) {
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

  const id = createStrategy(name, description, code, chatHistory);

  return Response.json({ id }, { status: 201 });
}
