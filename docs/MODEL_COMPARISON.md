# Model comparison (Phase 3, milestone 6), 3 November 2026

Which model should write QueAura's questions? Every candidate wrote the same 80 questions (8 topics
× 10, mixed difficulty and answer types) through the app's own pipeline (`backend/tools/compare.ts`):
same instructions, same checks, same word list. Claude Opus 5.5 with web search fact-checked every
question. Rerun with `npm run compare` in `backend/`.

## Results

| Model | Correct | Wrong | Ambiguous | Seconds per 10 | Tokens per AI game (in / out) | Price per 1M tokens (in / out) | Model cost per AI game | Margin on a $4.99 10-pack |
|---|---|---|---|---|---|---|---|---|
| Claude Haiku 5.5 | 98% | 1 | 1 | 12.9 | 6,084 / 14,904 | $0.10 / $0.50 | $0.008 | 83% |
| Claude Sonnet 5.5 | 99% | 0 | 1 | 8.6 | 6,161 / 6,784 | $2 / $10 | $0.080 | 69% |
| Claude Opus 5.5 | 100% | 0 | 0 | 18.1 | 6,084 / 9,999 | $4 / $20 | $0.22 | 40% |
| OpenAI gpt-6.1-sol | 100% | 0 | 0 | 21.6 | 2,117 / 6,736 | $2 / $10 * | $0.072 | 71% |
| OpenAI gpt-5.4-mini | 89% | 1 | 8 | 3.0 | 2,117 / 3,184 | $0.75 / $4.50 * | $0.016 | 82% |
| DeepSeek v4-pro | 98% | 0 | 2 | 50.4 | 2,597 / 19,129 | $1.32 / $3.96 * | $0.079 | 69% |
| DeepSeek flash | 99% | 0 | 1 | 14.8 | 2,342 / 14,461 | $0.30 / $1.20 * | $0.018 | 81% |
| Kimi k3.1-pro | not graded | | | 61–85, and 4 of 8 requests timed out after 3 minutes | | | | |

- An AI game is 50 questions. Margin: what is left of $4.99 after Google's 15% and the model cost of
  10 AI games; the most any model can reach is 85%. Spec §8 aims at 70–80%.
- \* Prices from third-party pricing guides (October–November 2026), not confirmed on the providers'
  own pages; DeepSeek's are its peak rates (off-peak is half). Anthropic's are its published list.
- 80 questions per model: one question is 1.25 points, so 98% to 100% is within one or two questions.
- The fact-checker searched the web 8 times in all and otherwise answered from its own knowledge.
  It is a Claude model; it rated an OpenAI model 100%, so no sign it favours Claude.
- Kimi was dropped for reliability (it timed out on half the requests), so its questions weren't
  fact-checked. The run stopped there when the test key's credit ran out.

## Flagged questions (for a person to check)

- Haiku · Football · wrong: maximum length of an international pitch, marked 120 m; the laws say 110 m for international matches.
- Haiku · Human body · ambiguous: "How many teeth… excluding wisdom teeth removed?", 32; confusing wording.
- Sonnet · 1990s music · ambiguous: "the producer" of Björk's *Post*, which had several.
- gpt-5.4-mini · 1990s music · wrong: "Barbie Girl" marked as the song opening "Live from New York, it's Saturday night".
- gpt-5.4-mini · 8 ambiguous: abbreviation letters for "Sol", countries in Africa (54), vertebrae (33), Ghent Altarpiece panels, figures at the Last Supper, Persistence of Memory, figures in The School of Athens, the first light-bulb patent year.
- DeepSeek v4-pro · ambiguous: number of continents (7), Edison's US patents (1,093).
- DeepSeek flash · ambiguous: "first practical steam engine", marked Newcomen.
