import { NextRequest } from "next/server";
import {
  listStrategies,
  createStrategy,
  seedDefaultStrategy,
} from "@/lib/db/strategy-store";
import { validateStrategy } from "@/lib/strategy-validator";
import { getUserIdFromRequest } from "@/lib/get-user-id";

/**
 * GET /api/strategy
 * List all strategies for the current user. Seeds the default if none exist.
 */
export async function GET(request: NextRequest) {
  const userId = getUserIdFromRequest(request);

  // Ensure default strategy exists for this user
  await seedDefaultStrategy(userId);

  const strategies = await listStrategies(userId);

  return Response.json(strategies);
}

/**
 * POST /api/strategy
 * Create a new strategy.
 * Body: { name, description, code, chatHistory? }
 */
export async function POST(request: NextRequest) {
  const userId = getUserIdFromRequest(request);

  let body: {
    name: string;
    description: string;
    code: string;
    chatHistory?: any[];
  };

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { name, description, code, chatHistory } = body;

  if (!name || !description || !code) {
    return Response.json(
      { error: "Missing name, description, or code" },
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

  const id = await createStrategy(userId, name, description, code, chatHistory);

  return Response.json({ id }, { status: 201 });
}
