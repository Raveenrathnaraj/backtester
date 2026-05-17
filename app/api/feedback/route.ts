import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getUserIdFromRequest } from "@/lib/get-user-id";

export async function POST(request: NextRequest) {
  try {
    const userId = getUserIdFromRequest(request);
    const body = await request.json();
    const { type, content } = body;

    if (!type || !content) {
      return Response.json(
        { error: "Type and content are required" },
        { status: 400 },
      );
    }

    if (type !== "bug" && type !== "feature") {
      return Response.json(
        { error: "Type must be either bug or feature" },
        { status: 400 },
      );
    }

    const supabase = createServiceClient();

    const { error } = await supabase.from("feedback").insert({
      user_id: userId,
      type,
      content,
    });

    if (error) {
      console.error("Error inserting feedback:", error);
      return Response.json(
        { error: "Failed to save feedback" },
        { status: 500 },
      );
    }

    return Response.json({ success: true }, { status: 201 });
  } catch (error: any) {
    console.error("Feedback API Error:", error);
    return Response.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 },
    );
  }
}
