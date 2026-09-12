import { GoogleGenAI, Type, FunctionCallingConfigMode } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// This route is the whole "AI brain" of the app. Before the main call, a cheap
// router (classifyGoal) decides between two tool-forced paths:
//   1. breakdown -> schedule_calendar_events (the original behavior below).
//      Quick create: user describes one (or several) concrete thing(s) to
//      schedule; we return that many events, added straight to the calendar.
//      Goal breakdown: user describes a big/vague goal; we return an initial
//      3-8 subtask breakdown covering the whole goal (isGoalBreakdown: true).
//      The client puts those cards into the swipe-to-refine review stack
//      instead of the calendar — the user can further split any one subtask
//      that still feels too big (see /api/decompose) or insert a gap-filler
//      between two neighboring cards (see /api/insert-crumb).
//   2. clarify -> ask_clarifying_questions. Only taken when the goal is vague
//      enough that a missing detail (timeframe/cadence/session_length/
//      starting_point) would change the STRUCTURE of the breakdown, not just
//      the wording of one step. Capped to one round ever per goal (see the
//      `kind: "clarify"` check below) so the user is never asked twice.
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
            title: {
              type: Type.STRING,
              description:
                "Short, specific, actionable title. At most 48 characters, so it fits on one line " +
                "(e.g. \"Write and run your first console.log script\").",
            },
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

const MISSING_SLOTS = ["timeframe", "cadence", "session_length", "starting_point"] as const;
type MissingSlot = (typeof MISSING_SLOTS)[number];

const clarifyTool = {
  name: "ask_clarifying_questions",
  description:
    "Ask the user a single quick round of tap-to-answer questions before breaking a vague/long-horizon goal " +
    "down, because a missing detail here would change the STRUCTURE of the breakdown, not just wording or timing.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      reply: {
        type: Type.STRING,
        description: "1-2 warm, friendly sentences introducing the questions. No interrogation tone.",
      },
      questions: {
        type: Type.ARRAY,
        description: "At most 3 questions, each about one of the given missing slots.",
        items: {
          type: Type.OBJECT,
          properties: {
            slot: { type: Type.STRING, enum: [...MISSING_SLOTS] },
            question: { type: Type.STRING, description: "Short, plain-language question." },
            options: {
              type: Type.ARRAY,
              description: "2-4 short, tappable predicted answers. Every question must have options.",
              items: { type: Type.STRING },
            },
          },
          required: ["slot", "question", "options"],
        },
      },
    },
    required: ["reply", "questions"],
  },
};

// A cheap, fast Gemini call that decides whether a missing detail would change the
// STRUCTURE of the breakdown (-> clarify) or not (-> straight to breakdown). Errs hard
// toward "breakdown" on any failure/timeout/malformed output — this path must never
// block or break the main flow, and a wrong assumption here is cheap to fix by swiping.
async function classifyGoal(
  ai: GoogleGenAI,
  message: string
): Promise<{ route: "breakdown" | "clarify"; missingSlots: MissingSlot[] }> {
  const fallback = { route: "breakdown" as const, missingSlots: [] as MissingSlot[] };
  try {
    const call = ai.models.generateContent({
      model: "gemini-3.5-flash-lite",
      contents: [{ role: "user" as const, parts: [{ text: message }] }],
      config: {
        systemInstruction:
          `Decide whether this user message needs one quick round of clarifying questions before it can be ` +
          `broken down into a task/calendar plan, or whether it can be broken down immediately. ` +
          `Ask (route: "clarify") ONLY when a missing piece of information would change the STRUCTURE of the ` +
          `breakdown (which steps exist, how many, over what span) — not just the wording or exact timing of one ` +
          `step. Short-horizon concrete tasks (e.g. "clean my room", "finish my problem set tonight") are always ` +
          `"breakdown" with zero questions. Long-horizon or open-ended goals where the timeframe, recurrence, or ` +
          `starting point is genuinely unknown (e.g. "get an internship for next summer", "go to the gym ` +
          `regularly") are "clarify". When in doubt, choose "breakdown". ` +
          `missingSlots must be a subset of: ${MISSING_SLOTS.join(", ")}.`,
        maxOutputTokens: 200,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            route: { type: Type.STRING, enum: ["breakdown", "clarify"] },
            missingSlots: { type: Type.ARRAY, items: { type: Type.STRING, enum: [...MISSING_SLOTS] } },
          },
          required: ["route", "missingSlots"],
        },
      },
    });

    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("router timeout")), 1500));
    const response = await Promise.race([call, timeout]);

    const parsed = JSON.parse(response.text ?? "") as { route?: string; missingSlots?: unknown };
    if (parsed.route !== "clarify") return fallback;

    const missingSlots = Array.isArray(parsed.missingSlots)
      ? parsed.missingSlots.filter((s): s is MissingSlot => (MISSING_SLOTS as readonly string[]).includes(s as string))
      : [];
    if (missingSlots.length === 0) return fallback;

    return { route: "clarify", missingSlots };
  } catch (err) {
    console.error("classifyGoal failed, falling back to breakdown", err);
    return fallback;
  }
}

// Softened tints of the app's own palette (see "UI for crumble/Color Code.txt": Oat,
// Sprout, Cookie, Choco, Crumb) instead of arbitrary generic colors, so events read as
// part of the same brand rather than a default chart palette.
const PROJECT_COLORS = [
  "#e4f7a3", // soft Sprout
  "#f6c98a", // soft Cookie
  "#b79a82", // soft Choco
  "#fadfb0", // soft Crumb
  "#ede28f", // soft Sprout/Cookie blend
  "#d9b896", // soft Choco/Crumb blend
];

export async function POST(req: NextRequest) {
  const { message, history, clientNow, existingEvents, forceBreakdown } = (await req.json()) as {
    message: string;
    history: { role: "user" | "assistant"; content: string; kind?: "clarify" }[];
    clientNow?: string;
    existingEvents?: { title: string; start: string; end: string; allDay?: boolean; color?: string }[];
    forceBreakdown?: boolean;
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

  // At most one clarify round ever: if we already asked once in this conversation (or the
  // caller explicitly wants to skip straight to a breakdown, e.g. the "Just start" button),
  // don't even spend the latency on the router — force breakdown immediately.
  const alreadyClarified = history.some((m) => m.kind === "clarify");
  const { route, missingSlots } =
    forceBreakdown || alreadyClarified ? { route: "breakdown" as const, missingSlots: [] } : await classifyGoal(ai, message);

  try {
    if (route === "clarify") {
      const clarifyResponse = await ai.models.generateContent({
        model: "gemini-3.5-flash-lite",
        contents,
        config: {
          systemInstruction:
            `You are Crumbles, helping someone who struggles to start things. Before breaking their goal down, ` +
            `ask ONE quick round of tap-to-answer questions — at most 3 — about ONLY these missing details: ` +
            `${missingSlots.join(", ")}. Every question MUST include 2-4 short, predicted-answer options; never ask ` +
            `an open-ended question with no options. Keep the reply warm and brief (1-2 sentences), no interrogation ` +
            `tone. Always respond by calling ask_clarifying_questions.`,
          tools: [{ functionDeclarations: [clarifyTool] }],
          toolConfig: {
            functionCallingConfig: {
              mode: FunctionCallingConfigMode.ANY,
              allowedFunctionNames: ["ask_clarifying_questions"],
            },
          },
        },
      });

      const call =
        clarifyResponse.functionCalls?.[0] ??
        (clarifyResponse.candidates?.[0]?.content?.parts?.find((p) => p.functionCall)
          ?.functionCall as { args?: Record<string, unknown> } | undefined);

      const args = (call?.args ?? { reply: clarifyResponse.text ?? "Quick question first:", questions: [] }) as {
        reply: string;
        questions: { slot: string; question: string; options: string[] }[];
      };

      console.log(
        "[ask_clarifying_questions] raw tool call ->\n" +
          JSON.stringify({ name: "ask_clarifying_questions", args }, null, 2)
      );

      return NextResponse.json({
        type: "clarify",
        reply: args.reply,
        questions: args.questions ?? [],
        debug: { toolCall: { name: "ask_clarifying_questions", args } },
      });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash-lite",
      contents,
      config: {
        systemInstruction:
          `You are Crumbles. You help people who struggle to start things. You take a goal and break it into ` +
          `crumbs: single, concrete, physical next actions that take 5-45 minutes and require no further ` +
          `planning or decision-making from the user. A crumb names an observable action ("open the job board ` +
          `and save 3 postings"), never a vague intention ("research internships"). If a crumb still requires ` +
          `the user to decide something before they can start, it is too big. Keep every title to at most 48 ` +
          `characters so it fits on one line in the UI (e.g. "Write and run your first console.log script"). ` +
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
          `"I want to win a hackathon"). Vary the time of day across subtasks realistically — do NOT default every ` +
          `subtask to the same clock time just because it lands on a different day (e.g. never "10:00-11:00" on ` +
          `every single day in a row). Think about each piece of work on its own terms: quick planning/admin ` +
          `steps often fit in a morning slot, focused build work often runs longer blocks in the afternoon, and ` +
          `people's schedules aren't perfectly identical day to day — stagger start times so the plan reads like a ` +
          `real week, not a copy-pasted template. These are the user's starting point, not the final word — they ` +
          `land in a review screen where the user can further split any subtask that still feels too big, so bias ` +
          `toward fewer, meatier subtasks rather than trying to anticipate every possible sub-step yourself.\n` +
          `If the user is just asking a question or chatting (not scheduling anything), use isGoalBreakdown: false ` +
          `and return an empty events array.`,
        tools: [{ functionDeclarations: [scheduleTool] }],
        toolConfig: {
          functionCallingConfig: {
            mode: FunctionCallingConfigMode.ANY,
            allowedFunctionNames: ["schedule_calendar_events"],
          },
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
    // Prefer a color not already used by anything on the calendar — without this, nextColor
    // always restarted at 0 each request, so a single-project request (the common case)
    // always landed on PROJECT_COLORS[0] no matter what colors were already in use.
    const usedColors = new Set(
      (existingEvents ?? []).map((e) => e.color).filter((c): c is string => Boolean(c))
    );
    const colorPool = [...PROJECT_COLORS.filter((c) => !usedColors.has(c)), ...PROJECT_COLORS];
    const colorByProject = new Map<string, string>();
    let nextColor = 0;
    const events = (args.events ?? []).map((e) => {
      let color: string | undefined;
      let projectId: string | undefined;
      if (e.projectTitle) {
        if (!colorByProject.has(e.projectTitle)) {
          colorByProject.set(e.projectTitle, colorPool[nextColor % colorPool.length]);
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
      type: "events",
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
