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

The countdown is rounded up to a multiple of a number of minutes (1 by default) and
prefixed with `~`, e.g. `~1 h 45 min` or `~12 min`, so it never claims more time is
left than the real amount allows for. In the last 5 minutes it switches to exact
minutes and seconds, e.g. `4:47`. It is white, turns orange in the last 5 minutes,
and turns red once time is up, counting up as `−1:23`.

The rounding, the point where seconds start, and the orange threshold are each
set under **Display**.

The countdown is always calculated from the end time and the system clock, so it
is correct even when a window has been in the background or the computer slept.

## Controls

- Start from a duration, or set the end time directly
- Pause and resume (e.g. for a fire alarm): the end time moves by the length of the pause
- Clear the timer (with Undo)
- Show or hide the current time (optionally with seconds), the end time, and the countdown
- 24-hour or 12-hour clock
- Clarification size, number of columns (1 by default), and the timer strip's height

The display also keeps the screen from going to sleep (where the browser supports it)
and hides the mouse cursor when it isn't moving.

## Hosting on GitHub Pages

In the repository's **Settings → Pages**, choose **Deploy from a branch**, pick the
branch and the `/ (root)` folder. The app will be at
`https://<user>.github.io/<repository>/`.

To run it locally, serve the folder with any static server, e.g.
`python3 -m http.server`, and open <http://localhost:8000/>.
