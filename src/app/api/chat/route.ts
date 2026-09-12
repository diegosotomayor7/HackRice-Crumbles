import { GoogleGenAI, Type, FunctionCallingConfigMode } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// This route is the whole "AI brain" of the app. One tool call does both jobs:
//   1. Quick create   -> user describes one (or several) concrete thing(s) to
//      schedule; we return that many events, added straight to the calendar.
//   2. Goal breakdown -> user describes a big/vague goal; we return an initial
//      3-8 subtask breakdown covering the whole goal (isGoalBreakdown: true).
//      The client puts those cards into the swipe-to-refine review stack
//      instead of the calendar — the user can further split any one subtask
//      that still feels too big (see /api/decompose) or insert a gap-filler
//      between two neighboring cards (see /api/insert-crumb).
// The model decides which mode applies based on the system instruction below.
// ---------------------------------------------------------------------------

const scheduleTool = {
  name: "schedule_calendar_events",
  description:
    "Reply to the user and, when appropriate, create calendar events — or, for a big/vague goal, " +
    "hand back an initial subtask breakdown for the user to further refine themselves by swiping.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      reply: {
        type: Type.STRING,
        description: "Short, friendly chat reply to show the user (1-3 sentences).",
      },
      isGoalBreakdown: {
        type: Type.BOOLEAN,
        description:
          "True when the user described a big, vague, or multi-step goal/project. False for a single " +
          "concrete thing to schedule, or when just chatting.",
      },
      events: {
        type: Type.ARRAY,
        description:
          "When isGoalBreakdown is true: 3-8 subtask events covering the whole goal end to end — this is a " +
          "starting point the user will further refine themselves by swiping, not the final word. When " +
          "isGoalBreakdown is false: zero or more concrete events to create directly (empty if the user didn't " +
          "ask to schedule anything).",
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: "Short, specific, actionable title." },
            start: { type: Type.STRING, description: "ISO 8601 datetime, e.g. 2026-09-15T14:00:00" },
            end: { type: Type.STRING, description: "ISO 8601 datetime, must be after start." },
            allDay: { type: Type.BOOLEAN },
            notes: { type: Type.STRING, description: "Optional 1-sentence detail." },
            projectTitle: {
              type: Type.STRING,
              description:
                "Only set when isGoalBreakdown is true (the goal itself, e.g. \"Winning the hackathon\") or " +
                "this event is one of several standalone events from the same request. Omit otherwise.",
            },
          },
          required: ["title", "start", "end"],
        },
      },
    },
    required: ["reply", "isGoalBreakdown", "events"],
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
          `You are Crumbles. You help people who struggle to start things. You take a goal and break it into ` +
          `crumbs: single, concrete, physical next actions that take 5-45 minutes and require no further ` +
          `planning or decision-making from the user. A crumb names an observable action ("open the job board ` +
          `and save 3 postings"), never a vague intention ("research internships"). If a crumb still requires ` +
          `the user to decide something before they can start, it is too big. ` +
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
          `Events you return, whether isGoalBreakdown is true or false, must NOT overlap each other, and must NOT ` +
          `overlap any existing event listed above — pick different times/days instead. Overlaps are only ever ` +
          `acceptable if the user explicitly asks for two things at the same time.` +
          `\n\n` +
          `Always respond by calling schedule_calendar_events. Decide which of these two modes applies:\n` +
          `1. isGoalBreakdown: false — the user described ONE concrete thing to schedule (or several concrete, ` +
          `unrelated things), or is just asking a question/chatting. Return that many events directly (zero if ` +
          `just chatting). If the user asks for something recurring across multiple weeks (e.g. "every Monday and ` +
          `Wednesday for the next 6 weeks"), you MUST enumerate every single occurrence as its own event for the ` +
          `ENTIRE requested range — never stop after just the first few; count the occurrences yourself before ` +
          `answering. Give every event from the same recurring series the same projectTitle.\n` +
          `2. isGoalBreakdown: true — the user described a big, vague, or multi-step goal or project (e.g. "I want ` +
          `to win a hackathon", "build a marketing site"). Break it into 3-8 concrete subtasks that cover the ` +
          `WHOLE arc of the goal end to end — not just the first couple of steps. For a hackathon-style goal that ` +
          `means something like: set up the repo, scope/outline the idea, build the core feature(s), build any ` +
          `remaining features, prepare the demo/pitch, submit — never stop at just "set up" and "outline." Each ` +
          `subtask still needs its own start/end datetime spread out sensibly between now and any deadline ` +
          `mentioned (default to the next 1-2 weeks if none given), and every subtask must share the same ` +
          `projectTitle: a short noun-phrase distillation of the goal itself (e.g. "Winning the hackathon", not ` +
          `"I want to win a hackathon"). These are the user's starting point, not the final word — they land in a ` +
          `review screen where the user can further split any subtask that still feels too big, so bias toward ` +
          `fewer, meatier subtasks rather than trying to anticipate every possible sub-step yourself.\n` +
          `If the user is just asking a question or chatting (not scheduling anything), use isGoalBreakdown: false ` +
          `and return an empty events array.`,
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

    const args = (call?.args ?? {
      reply: response.text ?? "Sorry, I didn't catch that.",
      isGoalBreakdown: false,
      events: [],
    }) as {
      reply: string;
      isGoalBreakdown: boolean;
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
      isGoalBreakdown: args.isGoalBreakdown,
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
