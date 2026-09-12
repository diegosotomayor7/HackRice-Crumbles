import { GoogleGenAI, Type, FunctionCallingConfigMode } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// This route is the whole "AI brain" of the app. One tool call does both jobs:
//   1. Quick create  -> user describes one concrete thing, we return 1 event.
//   2. Task breakdown -> user describes a big/vague goal, we return N subtask
//      events spread across realistic dates, all tagged with the same
//      projectId/projectTitle so the calendar can color-code them together.
// The model decides which mode applies based on the system instruction below.
// ---------------------------------------------------------------------------

const scheduleTool = {
  name: "schedule_calendar_events",
  description:
    "Reply to the user and, when appropriate, create one or more calendar events. " +
    "Use exactly one event for a single concrete request. For a large or multi-step " +
    "goal, break it into several smaller, actionable, realistically-scheduled subtasks.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      reply: {
        type: Type.STRING,
        description: "Short, friendly chat reply to show the user (1-3 sentences).",
      },
      events: {
        type: Type.ARRAY,
        description: "Calendar events to create. Empty array if the user didn't ask to schedule anything.",
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: "Short, specific, actionable title." },
            start: { type: Type.STRING, description: "ISO 8601 datetime, e.g. 2026-09-15T14:00:00" },
            end: { type: Type.STRING, description: "ISO 8601 datetime, must be after start." },
            allDay: { type: Type.BOOLEAN },
            notes: { type: Type.STRING, description: "Optional 1-sentence detail about the subtask." },
            projectTitle: {
              type: Type.STRING,
              description:
                "Only set when this event is one of several subtasks from a single breakdown request " +
                "(same value for every subtask in that breakdown). Omit for standalone events.",
            },
          },
          required: ["title", "start", "end"],
        },
      },
    },
    required: ["reply", "events"],
  },
};

const PROJECT_COLORS = ["#6366f1", "#0ea5e9", "#22c55e", "#f97316", "#ec4899", "#a855f7"];

export async function POST(req: NextRequest) {
  const { message, history, clientNow, existingEvents } = (await req.json()) as {
    message: string;
    history: { role: "user" | "assistant"; content: string }[];
    clientNow?: string;
    existingEvents?: { title: string; start: string; end: string; allDay?: boolean }[];
  };

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      reply:
        "No GEMINI_API_KEY is set on the server yet. Grab a free key at https://aistudio.google.com/apikey, " +
        "add it to .env.local as GEMINI_API_KEY=..., and restart the dev server.",
      events: [],
    });
  }

  // Trust the client's wall-clock time over the server's — they can be in different
  // timezones, and "tomorrow"/"next week" must resolve against the user's own clock
  // (the one they see in the calendar UI), not wherever this process happens to run.
  const nowLabel = clientNow ?? new Date().toISOString().slice(0, 19);
  const nowDayOfWeek = new Date(nowLabel).toLocaleDateString("en-US", { weekday: "long" });

  const existingEventsList =
    existingEvents && existingEvents.length > 0
      ? existingEvents
          .map((e) => `- "${e.title}": ${e.start} to ${e.end}${e.allDay ? " (all day)" : ""}`)
          .join("\n")
      : "(none)";

  const ai = new GoogleGenAI({ apiKey });

  const contents = [
    ...history.map((m) => ({
      role: m.role === "assistant" ? ("model" as const) : ("user" as const),
      parts: [{ text: m.content }],
    })),
    { role: "user" as const, parts: [{ text: message }] },
  ];

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash-lite",
      contents,
      config: {
        systemInstruction:
          `You are Crumble, an AI scheduling assistant embedded in a calendar app. ` +
          `The current date/time, exactly as shown on the user's own device, is ${nowLabel} (a ${nowDayOfWeek}). ` +
          `Always compute relative dates ("today", "tomorrow", "next week", "in 3 days") from this exact value — ` +
          `"tomorrow" always means the calendar day immediately after ${nowLabel.slice(0, 10)}, never two days later. ` +
          `Do not use any other notion of the current date. ` +
          `Write every start/end as a naive local datetime with NO timezone suffix (no "Z", no offset), in the ` +
          `same format as the current date/time above, e.g. 2026-09-15T14:00:00. ` +
          `Always set allDay explicitly (true or false) on every event. ` +
          `Never make an event span an entire day (00:00 to 00:00/23:59, or a 24-hour block) unless allDay is true ` +
          `and the task is genuinely a full-day thing (e.g. "vacation", "conference") — ordinary tasks get a ` +
          `specific, realistic start time and a duration that matches the work (typically 15 minutes to 3 hours), ` +
          `scheduled within reasonable waking/working hours (roughly 8am-9pm) unless the user says otherwise. ` +
          `\n\n` +
          `Existing events already on the calendar (both user-created and from earlier AI replies):\n${existingEventsList}\n` +
          `New events you create must NOT overlap each other, and must NOT overlap any existing event listed above — ` +
          `pick different times/days instead. Overlaps are only ever acceptable if the user explicitly asks for two ` +
          `things at the same time.` +
          `\n\n` +
          `Always respond by calling schedule_calendar_events. ` +
          `If the user describes ONE concrete thing to schedule, return exactly one event. ` +
          `If the user describes a big, vague, or multi-step goal or project, break it into concrete, actionable ` +
          `subtasks (as many as needed, there is no upper limit — do not truncate), each with its own specific, ` +
          `non-overlapping start/end datetime spread out sensibly between now and any deadline mentioned (default ` +
          `to spreading over the next 1-2 weeks if no deadline is given). ` +
          `If the user asks for something recurring across multiple weeks (e.g. "every Monday and Wednesday for ` +
          `the next 6 weeks", "daily standup for the rest of the month"), you MUST enumerate every single ` +
          `occurrence as its own event for the ENTIRE requested range — never stop after just the first few; ` +
          `count the occurrences yourself before answering to make sure none are missing. ` +
          `Order subtasks/occurrences logically and give every event in the same breakdown or recurring series ` +
          `the same projectTitle. ` +
          `If the user is just asking a question or chatting (not scheduling anything), return an empty events array.`,
        tools: [{ functionDeclarations: [scheduleTool] }],
        toolConfig: {
          functionCallingConfig: { mode: FunctionCallingConfigMode.ANY },
        },
      },
    });

    const call =
      response.functionCalls?.[0] ??
      (response.candidates?.[0]?.content?.parts?.find((p) => p.functionCall)
        ?.functionCall as { args?: Record<string, unknown> } | undefined);

    const args = (call?.args ?? { reply: response.text ?? "Sorry, I didn't catch that.", events: [] }) as {
      reply: string;
      events: {
        title: string;
        start: string;
        end: string;
        allDay?: boolean;
        notes?: string;
        projectTitle?: string;
      }[];
    };

    // Debug: log the raw tool call the model made so it's visible in the dev server terminal.
    console.log(
      "[schedule_calendar_events] raw tool call ->\n" + JSON.stringify({ name: "schedule_calendar_events", args }, null, 2)
    );

    // Assign a shared color per projectTitle so breakdown subtasks look grouped on the calendar.
    const colorByProject = new Map<string, string>();
    let nextColor = 0;
    const events = (args.events ?? []).map((e) => {
      let color: string | undefined;
      let projectId: string | undefined;
      if (e.projectTitle) {
        if (!colorByProject.has(e.projectTitle)) {
          colorByProject.set(e.projectTitle, PROJECT_COLORS[nextColor % PROJECT_COLORS.length]);
          nextColor += 1;
        }
        color = colorByProject.get(e.projectTitle);
        projectId = e.projectTitle;
      }
      return {
        id: crypto.randomUUID(),
        title: e.title,
        start: e.start,
        end: e.end,
        allDay: e.allDay ?? false,
        notes: e.notes,
        projectTitle: e.projectTitle,
        projectId,
        color,
      };
    });

    return NextResponse.json({
      reply: args.reply,
      events,
      debug: { toolCall: { name: "schedule_calendar_events", args } },
    });
  } catch (err) {
    console.error("Gemini request failed", err);
    return NextResponse.json(
      { reply: "Something went wrong talking to the AI. Check the server logs / API key.", events: [] },
      { status: 500 }
    );
  }
}
