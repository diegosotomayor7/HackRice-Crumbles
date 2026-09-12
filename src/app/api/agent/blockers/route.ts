import { GoogleGenAI, Type, FunctionCallingConfigMode } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Suggests 2-4 tappable "Running into blocks?" chips for the CURRENT step on ExecutionScreen.
// Read-only: this never touches the plan. Tapping a returned chip sends its label straight
// through /api/agent as a normal scoped message (see useAgent), same as if the user had typed it.
// ---------------------------------------------------------------------------

const chipsTool = {
  name: "suggest_blockers",
  description: "Suggest short blocker chips relevant to this specific step.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      chips: {
        type: Type.ARRAY,
        description: "2-4 short (<=24 char) blocker labels a user might tap, specific to this step.",
        items: { type: Type.STRING },
      },
    },
    required: ["chips"],
  },
};

const FALLBACK_CHIPS = ["Not sure how", "Missing something", "Out of time", "Skip for now"];

export async function POST(req: NextRequest) {
  const { title, detail } = (await req.json()) as { title: string; detail?: string };

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ chips: FALLBACK_CHIPS });

  const ai = new GoogleGenAI({ apiKey });

  try {
    const call = ai.models.generateContent({
      model: "gemini-3.5-flash-lite",
      contents: [
        { role: "user" as const, parts: [{ text: `Step: "${title}"${detail ? `\nDetail: ${detail}` : ""}` }] },
      ],
      config: {
        systemInstruction:
          `Suggest 2-4 short blocker chips specific to this step — things that might stop someone from doing ` +
          `it right now (missing a specific item/tool, unsure how, no time, etc). Each chip must be concrete to ` +
          `THIS step, not generic filler, and at most 24 characters. Always call suggest_blockers.`,
        tools: [{ functionDeclarations: [chipsTool] }],
        toolConfig: {
          functionCallingConfig: { mode: FunctionCallingConfigMode.ANY, allowedFunctionNames: ["suggest_blockers"] },
        },
      },
    });

    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 2000));
    const response = await Promise.race([call, timeout]);

    const args = response.functionCalls?.[0]?.args as { chips?: string[] } | undefined;
    const chips = args?.chips?.filter((c) => c.trim().length > 0).slice(0, 4);

    return NextResponse.json({ chips: chips && chips.length > 0 ? chips : FALLBACK_CHIPS });
  } catch (err) {
    console.error("suggest_blockers failed, using fallback", err);
    return NextResponse.json({ chips: FALLBACK_CHIPS });
  }
}
