import { GoogleGenAI, Type, FunctionCallingConfigMode, FunctionDeclaration, Schema } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Powers ExecutionScreen's agent input bar and blocker chips. The ONE mechanic this route
// serves: every agent turn is exactly one tool call against the current plan, addressed by
// task id (never index/position — ids are stable, indexes shift as the plan changes). The
// route never applies the tool itself; it returns {tool, args} and the client (useAgent ->
// usePlan, see src/lib/plan.ts) applies it so before/after state is diffable for animation.
//
// reply_only exists for turns that don't change the plan (e.g. a question) — the mechanic
// has no chat transcript on this screen, so even a plain answer surfaces as the ephemeral
// line above the input bar, never a bubble.
// ---------------------------------------------------------------------------

const taskInputSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description:
        "A single, concrete, physical next action. At most 48 characters so it fits on one line " +
        "(e.g. \"Sort darks from lights\").",
    },
    detail: { type: Type.STRING, description: "Optional 1-sentence extra detail." },
    estimateMinutes: { type: Type.NUMBER, description: "Rough minutes this step takes. Default ~20." },
  },
  required: ["title"],
};

const tools: FunctionDeclaration[] = [
  {
    name: "add_tasks",
    description: "Add one or more new steps to the plan.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        tasks: { type: Type.ARRAY, items: taskInputSchema, description: "1-4 new steps, in order." },
        afterTaskId: {
          type: Type.STRING,
          description: "Insert immediately after this task id. Omit to append at the end.",
        },
      },
      required: ["tasks"],
    },
  },
  {
    name: "update_task",
    description: "Edit one existing step's title, detail, and/or time estimate.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING, description: "The task id to update." },
        title: { type: Type.STRING },
        detail: { type: Type.STRING },
        estimateMinutes: { type: Type.NUMBER },
      },
      required: ["id"],
    },
  },
  {
    name: "delete_tasks",
    description: "Remove one or more steps from the plan.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        ids: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Task ids to remove." },
      },
      required: ["ids"],
    },
  },
  {
    name: "split_task",
    description: "Replace one step, in place, with several smaller, more concrete steps.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING, description: "The task id to split." },
        into: { type: Type.ARRAY, items: taskInputSchema, description: "2-4 replacement steps, in order." },
      },
      required: ["id", "into"],
    },
  },
  {
    name: "reorder_tasks",
    description: "Change the order of the plan's steps.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        orderedIds: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Every task id in the plan, in the new order.",
        },
      },
      required: ["orderedIds"],
    },
  },
  {
    name: "reply_only",
    description: "Use ONLY when nothing about the plan needs to change (e.g. answering a question).",
    parameters: {
      type: Type.OBJECT,
      properties: {
        message: { type: Type.STRING, description: "Short (<=1 sentence) reply shown as the ephemeral line." },
      },
      required: ["message"],
    },
  },
];

const ALLOWED = tools.map((t) => t.name).filter((n): n is string => !!n);

export async function POST(req: NextRequest) {
  const { message, plan, scopedTaskId } = (await req.json()) as {
    message: string;
    plan: { projectTitle: string; tasks: { id: string; title: string }[] };
    scopedTaskId?: string;
  };

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { tool: "reply_only", args: { message: "No GEMINI_API_KEY set on the server." } },
      { status: 200 }
    );
  }

  const ai = new GoogleGenAI({ apiKey });

  const taskList = plan.tasks.map((t, i) => `${i + 1}. [id: ${t.id}] ${t.title}`).join("\n") || "(no steps yet)";
  const scopeLine = scopedTaskId
    ? `The user has step [id: ${scopedTaskId}] selected/focused — prefer applying their request to that step specifically.`
    : "No specific step is selected — the request applies to the whole plan unless it clearly names one step.";

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash-lite",
      contents: [{ role: "user" as const, parts: [{ text: message }] }],
      config: {
        systemInstruction:
          `You are Crumbles, helping someone execute the plan "${plan.projectTitle}". Steps (task ids in ` +
          `brackets, never refer to a step by number/position):\n${taskList}\n\n${scopeLine}\n\n` +
          `Respond by calling exactly ONE tool. Prefer split_task when a step is too big to start, add_tasks ` +
          `for a missing recovery step (e.g. the user hit a blocker), update_task for a wording/estimate fix, ` +
          `delete_tasks for something no longer needed, reorder_tasks to resequence, and reply_only only when ` +
          `no plan change applies. Always address existing steps by their id, never by position.`,
        tools: [{ functionDeclarations: tools }],
        toolConfig: {
          functionCallingConfig: { mode: FunctionCallingConfigMode.ANY, allowedFunctionNames: ALLOWED },
        },
      },
    });

    const call =
      response.functionCalls?.[0] ??
      (response.candidates?.[0]?.content?.parts?.find((p) => p.functionCall)?.functionCall as
        | { name?: string; args?: Record<string, unknown> }
        | undefined);

    if (!call?.name) {
      return NextResponse.json({ tool: "reply_only", args: { message: response.text ?? "Didn't catch that." } });
    }

    console.log("[agent] tool call ->", JSON.stringify({ name: call.name, args: call.args }, null, 2));

    return NextResponse.json({ tool: call.name, args: call.args ?? {} });
  } catch (err) {
    console.error("Gemini request failed", err);
    return NextResponse.json(
      { tool: "reply_only", args: { message: "Something went wrong talking to the AI." } },
      { status: 500 }
    );
  }
}
