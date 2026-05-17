import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { db: { schema: "alphaforge" } },
);

async function test() {
  const { data, error } = await supabase
    .from("instruments")
    .select("*")
    .limit(1);
  console.log("Data:", data);
  console.log("Error:", error);
}

test();
