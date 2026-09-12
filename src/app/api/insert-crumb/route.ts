import { GoogleGenAI, Type, FunctionCallingConfigMode } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Powers "insert a step in between" on the review stack: given the crumb right
// before and the crumb right after a gap, propose ONE new crumb that belongs
// between them — filling a hole in the plan the AI's initial breakdown missed
// (e.g. the actual build step between "outline the idea" and "record the demo").
// ---------------------------------------------------------------------------

const insertTool = {
  name: "insert_crumb",
  description: "Propose one new task that belongs between two existing tasks in a plan.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      crumb: {
        type: Type.OBJECT,
        properties: {
          title: {
            type: Type.STRING,
            description: "A single, concrete, physical next action that fills the gap between the two given tasks.",
          },
          start: { type: Type.STRING, description: "ISO 8601 datetime, e.g. 2026-09-15T14:00:00" },
          end: { type: Type.STRING, description: "ISO 8601 datetime, must be after start." },
          allDay: { type: Type.BOOLEAN },
          notes: { type: Type.STRING, description: "Optional 1-sentence detail." },
        },
        required: ["title", "start", "end"],
      },
    },
    required: ["crumb"],
  },
};

export async function POST(req: NextRequest) {
  const { prev, next, projectTitle, clientNow } = (await req.json()) as {
    prev: { title: string; start: string; end: string; allDay?: boolean; notes?: string };
    next: { title: string; start: string; end: string; allDay?: boolean; notes?: string };
    projectTitle?: string;
    clientNow?: string;
  };

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "No GEMINI_API_KEY is set on the server." }, { status: 500 });
  }
  if (!prev || !next) {
    return NextResponse.json({ error: "Need a task on both sides of the gap." }, { status: 400 });
  }

  const gapStartMs = new Date(prev.end).getTime();
  const gapEndMs = new Date(next.start).getTime();
  if (!(gapEndMs > gapStartMs)) {
    return NextResponse.json(
      { error: "There's no time gap between these two tasks to insert into — move one first." },
      { status: 400 }
    );
  }

  const nowLabel = clientNow ?? new Date().toISOString().slice(0, 19);
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
                `Goal: "${projectTitle ?? "(untitled)"}"\n` +
                `Task before the gap: "${prev.title}" (ends ${prev.end}${prev.notes ? `, notes: ${prev.notes}` : ""})\n` +
                `Task after the gap: "${next.title}" (starts ${next.start}${next.notes ? `, notes: ${next.notes}` : ""})\n` +
                `The user wants to insert a step in between these two, because something is missing from the plan ` +
                `there. Propose the single most useful task to fill that gap.`,
            },
          ],
        },
      ],
      config: {
        systemInstruction:
          `You are Crumbles. You help people who struggle to start things by breaking a goal into ` +
          `crumbs: single, concrete, physical next actions that take 5-45 minutes and require no further ` +
          `planning or decision-making from the user. A crumb names an observable action, never a vague intention. ` +
          `The current date/time is ${nowLabel}. Do not schedule anything before this. ` +
          `Write start/end as a naive local datetime with NO timezone suffix (no "Z", no offset), e.g. ` +
          `2026-09-15T14:00:00. ` +
          `The new crumb's start must be >= ${prev.end} and its end must be <= ${next.start} — it must fit inside ` +
          `the gap without overlapping either neighboring task. Looking at what comes before and after, infer what ` +
          `real step is missing between them (e.g. between "outline the idea" and "record the demo" the missing ` +
          `step is probably building the thing) — never a rephrasing of either neighbor, and never generic filler. ` +
          `Always respond by calling insert_crumb with exactly one crumb.`,
        tools: [{ functionDeclarations: [insertTool] }],
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
      | { crumb?: { title: string; start: string; end: string; allDay?: boolean; notes?: string } }
      | undefined;

    if (!args?.crumb) {
      console.error("[insert_crumb] no crumb returned", args);
      return NextResponse.json({ error: "The AI didn't return a task. Try again." }, { status: 502 });
    }

    return NextResponse.json({ crumb: args.crumb });
  } catch (err) {
    console.error("Gemini request failed", err);
    return NextResponse.json({ error: "Something went wrong talking to the AI." }, { status: 500 });
  }
}
