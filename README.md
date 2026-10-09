# Exam Clock

A static two-window web app for projecting the time during an exam: the current
time, when the exam ends, a countdown, and any clarifications you announce.

- `index.html`: the **control panel**, for your own screen
- `display.html`: the **display**, for the projector (opened from the control panel)

No build step and no framework. The only dependency is
[marked](https://github.com/markedjs/marked) (vendored in `vendor/`) for Markdown.

## Usage

1. Open `index.html` and click **Open display window**.
2. Drag the new window to the projector, then double-click it (or press **F**) to go full screen.
3. Start the timer with a duration (**Start now**) or a fixed **end time**.
4. Type clarifications into the text box and click **Show on screen** (or press Ctrl+Enter).
   They're rendered as Markdown below the timer and shrink to fit as you add more.

The control panel shows a live preview of the display and the exact time left.
Everything is stored in the browser's `localStorage`, so reloading either window
(or closing and reopening it) keeps the timer and clarifications.

## Countdown

The timer sits in a strip at the top of the screen that always keeps its space
(40% of the screen height), whether or not there are clarifications. Only when the
clarifications fill the rest of the screen does the strip shrink, down to 25%;
after that the clarification text shrinks instead.

The countdown is precise by default, e.g. `1:45:00` or `12:47`. It is white, turns
orange at 5 minutes left (which is also when seconds appear in the rounded format),
and turns red once time is up, counting up as `−1:23`.

Under **Display** you can instead round the countdown: it is then prefixed with `~`
and rounded up, to 5 min while more than 30 min are left (e.g. `~1 h 45 min`) and to
whole minutes below that (`~12 min`). The thresholds and sizes can be changed there too.

The countdown is always calculated from the end time and the system clock, so it
is correct even when a window has been in the background or the computer slept.

## Controls

- Start from a duration, or set the end time directly
- Pause and resume (e.g. for a fire alarm): the end time moves by the length of the pause
- Clear the timer (with Undo)
- Show or hide the current time (optionally with seconds), the end time, and the countdown
- 24-hour or 12-hour clock
- Clarification size and the timer strip's height

The display also keeps the screen from going to sleep (where the browser supports it)
and hides the mouse cursor when it isn't moving.

## Hosting on GitHub Pages

In the repository's **Settings → Pages**, choose **Deploy from a branch**, pick the
branch and the `/ (root)` folder. The app will be at
`https://<user>.github.io/<repository>/`.

To run it locally, serve the folder with any static server, e.g.
`python3 -m http.server`, and open <http://localhost:8000/>.
