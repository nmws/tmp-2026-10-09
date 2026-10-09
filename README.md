# Exam Clock

A static two-window web app for projecting the time during an exam: the current
time, when the exam ends, a calm countdown, and any clarifications you announce.

- `index.html`: the **control panel**, for your own screen
- `display.html`: the **display**, for the projector (opened from the control panel)

No build step and no framework. The only dependency is
[marked](https://github.com/markedjs/marked) (vendored in `vendor/`) for Markdown.

## Usage

1. Open `index.html` and click **Open display window**.
2. Drag the new window to the projector, then double-click it (or press **F**) to go full screen.
3. Start the timer with a duration (**Start now**) or a fixed **end time**.
4. Type clarifications into the text box and click **Show on screen** (or press Ctrl+Enter).
   They're rendered as Markdown and shrink to fit as you add more.

The control panel shows a live preview of the display and the exact time left.
Everything is stored in the browser's `localStorage`, so reloading either window
(or closing and reopening it) keeps the timer and clarifications.

## Countdown

The countdown is kept deliberately coarse so it doesn't distract:

| Time left        | Shown as                   |
| ---------------- | -------------------------- |
| more than 30 min | rounded up to 5 min, e.g. `1 h 45 min` |
| 3 to 30 min      | whole minutes, e.g. `12 min` |
| last 3 min       | minutes and seconds, e.g. `2:47` |
| time's up        | counting up, e.g. `−1:23`  |

It's white, then orange from 15 minutes left, then red from 5 minutes.
All these thresholds can be changed under **Display** in the control panel.

The countdown is always calculated from the end time and the system clock, so it
is correct even when a window has been in the background or the computer slept.

## Controls

- Start from a duration, or set the end time directly
- Adjust the end time by −5/−1/+1/+5/+10/+15 minutes (e.g. for a late start)
- Pause and resume (e.g. for a fire alarm): the end time moves by the length of the pause
- Show or hide the current time (optionally with seconds), the end time, and the countdown
- An optional title, such as the exam name
- 24-hour or 12-hour clock
- Clarification size, number of columns (1 by default), and how much room the timer gets when clarifications are shown

The display also keeps the screen from going to sleep (where the browser supports it)
and hides the mouse cursor when it isn't moving.

## Hosting on GitHub Pages

In the repository's **Settings → Pages**, choose **Deploy from a branch**, pick the
branch and the `/ (root)` folder. The app will be at
`https://<user>.github.io/<repository>/`.

To run it locally, serve the folder with any static server, e.g.
`python3 -m http.server`, and open <http://localhost:8000/>.
