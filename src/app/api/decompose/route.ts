import { GoogleGenAI, Type, FunctionCallingConfigMode } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Powers the swipe-left mechanic on the review stack: takes ONE crumb the user
// couldn't start and splits it into exactly two smaller, more concrete crumbs
// that together fit inside the original crumb's time window. Deliberately
// exactly two (not "2-4" like /api/chat's breakdown mode) — the user controls
// how many subtasks exist by choosing how many times to swipe left, not the AI.
// ---------------------------------------------------------------------------

const splitTool = {
  name: "split_crumb",
  description:
    "Split one task into exactly two smaller, more concrete subtasks that together fit " +
    "inside the original task's time window.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      crumbs: {
        type: Type.ARRAY,
        description: "Exactly two subtasks, in chronological order.",
        items: {
          type: Type.OBJECT,
          properties: {
            title: {
              type: Type.STRING,
              description: "A single, concrete, physical next action — never a rephrasing of the original task.",
            },
            start: { type: Type.STRING, description: "ISO 8601 datetime, e.g. 2026-09-15T14:00:00" },
            end: { type: Type.STRING, description: "ISO 8601 datetime, must be after start." },
            allDay: { type: Type.BOOLEAN },
            notes: { type: Type.STRING, description: "Optional 1-sentence detail." },
          },
          required: ["title", "start", "end"],
        },
      },
    },
    required: ["crumbs"],
  },
};

export async function POST(req: NextRequest) {
  const { crumb, clientNow } = (await req.json()) as {
    crumb: {
      title: string;
      start: string;
      end: string;
      allDay?: boolean;
      notes?: string;
      projectTitle?: string;
      depth: number;
    };
    clientNow?: string;
  };

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "No GEMINI_API_KEY is set on the server." }, { status: 500 });
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
                `Task: "${crumb.title}"${crumb.projectTitle ? ` (part of the goal "${crumb.projectTitle}")` : ""}\n` +
                `Scheduled window: ${crumb.start} to ${crumb.end}${crumb.allDay ? " (all day)" : ""}\n` +
                (crumb.notes ? `Notes: ${crumb.notes}\n` : "") +
                `The user swiped left on this task — it still feels too big or vague to start. Split it into two.`,
            },
          ],
        },
      ],
      config: {
        systemInstruction:
          `You are Crumbles. You help people who struggle to start things by breaking a task into ` +
          `crumbs: single, concrete, physical next actions that take 5-45 minutes and require no further ` +
          `planning or decision-making from the user. A crumb names an observable action ("open the job board ` +
          `and save 3 postings"), never a vague intention ("research internships"). ` +
          `The current date/time is ${nowLabel}. Do not schedule anything before this. ` +
          `Write every start/end as a naive local datetime with NO timezone suffix (no "Z", no offset), e.g. ` +
          `2026-09-15T14:00:00. ` +
          `Split the given task into EXACTLY two crumbs. Both must fit inside the task's own scheduled window ` +
          `(${crumb.start} to ${crumb.end}) and must not overlap each other — the first ends before or when the ` +
          `second starts. Each crumb must be strictly smaller and more concrete than the original task — never ` +
          `a rephrasing or a duplicate of it, and never merely "part 1" / "part 2" of the same vague action. ` +
          `If the window is very short, it's fine for both crumbs to be brief, but keep each at least a few ` +
          `minutes long. This is depth ${crumb.depth + 1} of the breakdown — the deeper you go, the more ` +
          `literal and physical the action must be. ` +
          `Always respond by calling split_crumb with exactly two crumbs, in chronological order.`,
        tools: [{ functionDeclarations: [splitTool] }],
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
      | { crumbs?: { title: string; start: string; end: string; allDay?: boolean; notes?: string }[] }
      | undefined;

    const crumbs = args?.crumbs ?? [];
    if (crumbs.length !== 2) {
      console.error("[split_crumb] expected exactly 2 crumbs, got", crumbs.length, args);
      return NextResponse.json({ error: "The AI didn't return exactly two subtasks. Try again." }, { status: 502 });
    }

    return NextResponse.json({ crumbs });
  } catch (err) {
    console.error("Gemini request failed", err);
    return NextResponse.json({ error: "Something went wrong talking to the AI." }, { status: 500 });
  }
}
