import { GoogleGenAI, Type, FunctionCallingConfigMode } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Powers the first tap on a plain (non-goal) Today's Plan event: guarantees a
// breakdown into 2-4 concrete physical steps, unlike /api/agent's split_task
// (which the general execution agent may reasonably decline to call at all if
// it judges a task isn't "too big" — no good for a bootstrap step that must
// always produce something). Returns plain {title, detail, estimateMinutes}
// TaskInputs, not explicit start/end times — page.tsx feeds these straight into
// the store's existing splitTask, the same time-slicing logic the agent's own
// split_task and ExecutionScreen's swipe-left already use, so there's one
// canonical way a task's window gets subdivided, not two.
// ---------------------------------------------------------------------------

const stepsTool = {
  name: "generate_steps",
  description: "Break one task into 2-4 concrete physical steps.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      steps: {
        type: Type.ARRAY,
        description: "2-4 steps, in the order they'd actually be done.",
        items: {
          type: Type.OBJECT,
          properties: {
            title: {
              type: Type.STRING,
              description:
                "A single, concrete, physical next action — never a rephrasing of the original task. At most " +
                "48 characters (e.g. \"Scrub the shower tiles\").",
            },
            detail: { type: Type.STRING, description: "Optional 1-sentence extra detail." },
            estimateMinutes: { type: Type.NUMBER, description: "Rough minutes this step takes." },
          },
          required: ["title", "estimateMinutes"],
        },
      },
    },
    required: ["steps"],
  },
};

export async function POST(req: NextRequest) {
  const { title, notes, totalMinutes } = (await req.json()) as {
    title: string;
    notes?: string;
    totalMinutes: number;
  };

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "No GEMINI_API_KEY is set on the server." }, { status: 500 });
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash-lite",
      contents: [
        {
          role: "user" as const,
          parts: [
            {
              text:
                `Task: "${title}"\n` +
                `Scheduled duration: about ${totalMinutes} minutes total\n` +
                (notes ? `Notes: ${notes}\n` : "") +
                `Break this into the physical steps someone would actually do to get it done.`,
            },
          ],
        },
      ],
      config: {
        systemInstruction:
          `You are Crumbles. You help people who struggle to start things by breaking a task into ` +
          `crumbs: single, concrete, physical next actions that require no further planning or decision-making ` +
          `from the user. A crumb names an observable action ("scrub the shower tiles"), never a vague intention ` +
          `("clean the bathroom"). Keep every title to at most 48 characters so it fits on one line in the UI. ` +
          `Always produce between 2 and 4 steps — never just 1, even if the task looks simple; there is always a ` +
          `natural first physical motion and a natural last one. Their estimateMinutes should roughly sum to the ` +
          `task's own scheduled duration (${totalMinutes} min), but a slight mismatch is fine. Each step must be ` +
          `strictly smaller and more concrete than the original task — never a rephrasing or a duplicate of it. ` +
          `Always respond by calling generate_steps with 2-4 steps, in the order they'd be done.`,
        tools: [{ functionDeclarations: [stepsTool] }],
        toolConfig: {
          functionCallingConfig: { mode: FunctionCallingConfigMode.ANY },
        },
      },
    });

    const call =
      response.functionCalls?.[0] ??
      (response.candidates?.[0]?.content?.parts?.find((p) => p.functionCall)
        ?.functionCall as { args?: Record<string, unknown> } | undefined);

    const args = call?.args as
      | { steps?: { title: string; detail?: string; estimateMinutes?: number }[] }
      | undefined;

    const steps = args?.steps ?? [];
    if (steps.length < 2 || steps.length > 4) {
      console.error("[generate_steps] expected 2-4 steps, got", steps.length, args);
      return NextResponse.json({ error: "The AI didn't return a usable breakdown. Try again." }, { status: 502 });
    }

    return NextResponse.json({ steps });
  } catch (err) {
    console.error("Gemini request failed", err);
    return NextResponse.json({ error: "Something went wrong talking to the AI." }, { status: 500 });
  }
}
