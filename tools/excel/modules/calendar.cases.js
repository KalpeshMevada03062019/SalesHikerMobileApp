// Mobile Calendar test cases (More > CRM > Calendar: the task calendar, the same screen as Tasks > Calendar),
// SalesHiker Android 1.0.0. Expected results come from the live app on the Realme RMX3997 (2026-11-04).
// Read only: New Task, the "Mark ... done" check boxes and Save are never tapped; a task opened from a day
// is only read and left with Cancel. Tasks > Calendar is also covered by MTSK-013 to MTSK-015.

const PRE = 'Registered beta test account (config\\.env).\nApp restarted signed in; More > Calendar open.';
const tc = (fields) => ({ req: 'REQ-MCAL-01', input: 'Test account from config\\.env. Beta tasks.', pre: PRE, ...fields });

module.exports = [
  tc({ ts: 'TS-MCAL-01', scenario: 'Week view', id: 'MCAL-001', title: 'Calendar opens from More on the current week with today selected',
    steps: '1. More > Calendar.', type: 'Smoke', design: 'Positive',
    expected: 'Title Calendar, New Task (not tapped), month and year, Monday to Sunday of this week, today marked "today" and selected, no Today button, the day header (e.g. "WEDNESDAY, 4 NOVEMBER").',
    observed: 'November 2026, week 2-8, Wednesday 4 selected.' }),
  tc({ ts: 'TS-MCAL-01', scenario: 'Week view', id: 'MCAL-002', title: 'Each day of the week shows as many tasks as its count, or Nothing planned',
    steps: '1. Tap each day of the week in turn.', type: 'Functional', design: 'Validation',
    expected: 'A day with tasks shows its count next to the header and that many entries ("<title>, <time>, ..."); a day without shows "Nothing planned" and "Add a task for this day."',
    observed: 'Friday 6 November: 1 task; the other days: Nothing planned.' }),
  tc({ ts: 'TS-MCAL-01', scenario: 'Week view', id: 'MCAL-003', title: 'Moving a week keeps the weekday selected and the month follows the selected day',
    steps: '1. Tap Previous week.\n2. Tap Next week twice.', type: 'Functional', design: 'Boundary Value',
    expected: 'The same weekday one week earlier / later is selected and the month label is its month (week 26 Oct - 1 Nov reads October 2026 with Wednesday 28 October selected).',
    observed: 'Wednesday 28 October, October 2026; then Wednesday 11 November.' }),
  tc({ ts: 'TS-MCAL-01', scenario: 'Week view', id: 'MCAL-004', title: 'Today appears away from today and brings the calendar back to it',
    steps: '1. Tap Next week twice.\n2. Tap Today.', type: 'Functional', design: 'Positive',
    expected: 'No Today button on today; Today shown two weeks ahead; Today returns to the current week with today selected and hides the button.',
    observed: 'As expected.' }),
  tc({ ts: 'TS-MCAL-02', scenario: 'Tasks on days', id: 'MCAL-005', title: 'An overdue task is listed on its past due day',
    steps: '1. Tasks > Overdue: read the first task and its date.\n2. More > Calendar; go back to that week and tap the day.', type: 'Functional', design: 'Validation',
    expected: 'The day lists the task ("<title>, <time>, <linked record>, <assignee>") with a count; the Today button is shown.',
    observed: 'Tuesday 13 October: 3 x "Call Rahul Mehta about pricing for 20 users, 11:00 AM, Contact: Rahul Mehta, Yash".' }),
  tc({ ts: 'TS-MCAL-02', scenario: 'Tasks on days', id: 'MCAL-006', title: 'A task opens from its day and Cancel returns to that day',
    steps: '1. Tasks > Upcoming: read the first task with a date.\n2. More > Calendar; tap that day, then the task.\n3. Tap Cancel.', type: 'Functional', design: 'Positive',
    expected: '"Edit Task" with the title and due date of that day (nothing changed); Cancel returns to the calendar with the same day selected and count.',
    observed: 'Meeting with Sam, 6 Nov 2026; Friday 6 November kept.' }),
  tc({ ts: 'TS-MCAL-02', scenario: 'Tasks on days', id: 'MCAL-007', title: 'Back returns to More, whose Tasks today matches today in the calendar',
    steps: '1. More > Calendar; read the count of today.\n2. Tap Back.', type: 'Functional', design: 'Validation',
    expected: 'More is shown and its "N Tasks today" equals the number of tasks on today in the calendar.', observed: '0 Tasks today; Nothing planned today.' }),
];
