# DURF Federation Day 2026

Slides for the DURF Federation Day, Wednesday 18 November 2026, SURF Utrecht.

- Slides: https://durf-project.github.io/federation-day-2026/
- Quiz for phones: https://durf-project.github.io/federation-day-2026/#quiz (short link https://edu.nl/y6cmd, QR code in `assets/qr-quiz.svg`)

The page uses the [DURF design system](https://durf-project.github.io/durf-design-system/).

## Presenting

| Key | Does |
| --- | --- |
| → ↓ PageDown space Enter | next slide, or the next step within a slide (a presenter clicker sends one of these) |
| ← ↑ PageUp | back |
| Home / End | first / last slide |
| F | full screen |
| O, or the ▦ button | overview of all slides as thumbnails, grouped by the parts of the programme; click one to go there |
| D | on a quiz question: add demo answers (demo mode only) |
| Shift+R | on a quiz question or leaderboard: clear all answers and scores in this browser |

The DURF topbar at the top has the theme button (light, dark, system); in full screen it is hidden.
The mouse stays free: links, the circles of the federation and the accordions can be clicked.
Keys pressed inside an embedded page (the circles, the poster) still move the slides on.
The slide number is in the address (`#12`), so a reload keeps your place.

## Where the content comes from

Most content is taken from the other DURF sites when the slides load, so it stays the same:

| Slide | Source |
| --- | --- |
| Title | `project-page/content/00-hero.md` |
| Our shared responsibility, key figures | `project-page/content/02-statement.md`, `01-figures.md`, and the corpus picture |
| Central aim, strategic commitments | `position-paper/position-paper.md` (the *STRATEGIC* bullet of each theme) |
| Information chain | `position-paper/assets/durf-information-chain.svg` |
| Project board and team | the project page section "The federation and its circles", embedded (`?embed&only=federation`); clicking a circle shows the people from `project-page/content/people.json` |
| Roadmap (after Maurice's intro) | the DURF project plan, `durf-gantt/gantt.html?embed` |
| Theme leads | the design system (`window.DURF.themes`), photos from `people.json` |
| Theme carousel | the opening poster, `durf-gantt/posters/?theme=0&embed` |

Speakers, times and the agenda are in `index.html`. Photos of people not in `people.json` are in `config.js`.

## The pub quiz

Write the questions in `quiz/questions.md`:

```markdown
### How many published works are in the Corpus?

- [ ] About 1 million
- [x] About 3.4 million
- [ ] About 10 million
```

Add a line `theme: 4` under a question to show that theme's puzzle piece, number and colour.

Every question gets a slide. On the slide the bars start at 0 and the count of answers runs at the
bottom right. Next click: the bars fill. Next click: the right answer is highlighted, and every
phone shows whether it was right, the points and its place. Next click: the next question opens.
Phones can only answer the question that is on the screen.

**Points.** A right answer scores 1,000 points for the fastest, 25 fewer for each next one, at least
500. The time is measured on the phone, from when the question appears until the answer is tapped;
changing an answer restarts it. The last question counts double and has a 2× badge.

**Leaderboards** (top 10) come by themselves, so questions can be added or removed:

- after question 1: the scores grow from zero;
- after the one but last question: first the standings of the previous leaderboard, next click the
  bars move, change length and the scores count up;
- the final score after the last question: the same, and one more click crowns the top three with
  medals and confetti.

People without a name show as "Player" and a code.

**Live answers** go through [ntfy](https://ntfy.sh) (`QUIZ_BACKEND: "ntfy"` in `config.js`): the
slides publish which question is open on `<topic>-state`, phones send their answer to
`<topic>-answers`. No account or server of our own is needed; the page stays on GitHub Pages.

- The topic name in `config.js` is long and random: anyone who knows it can read or send quiz
  messages. Pick a new one for a next event.
- The public ntfy.sh limits how many messages one internet address may send per day. If many
  people answer over the same venue Wi-Fi, ask them to use mobile data, or point `NTFY_SERVER`
  at your own ntfy server (for example a PikaPods ntfy instance).
- To rehearse without sending anything, add `?quiz=demo` to the address: answers then travel only
  between tabs of the same browser, and D adds demo answers.
- The slides keep the counts in the browser. Shift+R on a quiz slide clears them, for example
  after a rehearsal.

Instructions for the quiz host (in Dutch): `docs/instructie-pubquiz.pdf`, made from
`docs/instructie-pubquiz.html` (print it to PDF from a browser after a change).

## Licence

EUPL 1.2, see `LICENSE`.
