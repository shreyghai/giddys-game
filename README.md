# Giddy's Game 💜

A daily trivia game. The only file you need to edit is `questions.json`.

## Adding questions

Add a new block for each day:

```json
{
  "date": "2026-11-15",
  "theme": "Space",
  "emoji": "🚀",
  "intro": "optional, a line shown on the theme screen",
  "questions": [
    {
      "question": "Where did we first meet?",
      "answers": ["coffee shop", "the coffee shop", "starbucks"],
      "hint": "optional, shown after her first wrong guess",
      "note": "optional, a little message shown after she answers"
    }
  ]
}
```

- `answers` holds every answer you'll accept. The first one is what gets shown as "the answer". Case, punctuation, a leading "the/a/my", and small typos are ignored automatically.
- Each day opens with a theme screen ("Today's theme: 🚀 Space") before the first question. `theme` and `emoji` are what show there. Leave out `theme` and it skips straight to the questions.
- A day can have as many questions as you want (5 is the plan).
- Answers with numbers in them (years, counts) have to match exactly, so no typo allowance there.
- You can add days ahead of time. Each one only shows up on its date.
- Watch your commas: every `}` between blocks needs a `,` after it, but the last one doesn't. If you get it wrong, the site shows a "typo" message.

## Previewing

- Run locally with `python3 -m http.server 8000` in this folder, then open http://localhost:8000
- To preview a specific day, add `?date=2026-11-13` to the URL. Progress is saved per device, so your testing won't affect hers.
