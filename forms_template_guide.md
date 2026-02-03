# Microsoft Forms Template Guide
## Reading Assessment Tests — Forms Setup & Workflow

This guide tells you exactly how to set up each of the 8 reading tests in Microsoft Forms,
how to configure the export, and how to hand the data off to the analyser script.

---

## How it works (end to end)

1. Teacher creates the Form using this guide as a blueprint
2. Teacher shares the Form link with students (or posts it on Teams)
3. Students complete it -- Forms collects name, class, DOB, and all 26 answers
4. Teacher exports responses to CSV from the Forms UI (Forms > Responses > Excel icon)
5. Teacher runs `analyse.py` on the CSV -- it produces all the reports

That's it. No server, no login system, no test interface to maintain.

---

## Form structure (do this for every test)

Each Form needs these sections in this exact order:

### Section 1: Student Details (before any questions)

Add these fields at the top as **text input** questions (not multiple choice):

| Field | Type | Instructions to student |
|-------|------|------------------------|
| First Name | Short text | "Enter your first name" |
| Last Name | Short text | "Enter your surname" |
| Date of Birth | Date | "Enter your date of birth" (Forms has a built-in date picker) |
| Class | Short text | "Enter your class or form group (e.g. 7A)" |
| Test Form Number | Short text | "Your teacher will tell you which number to enter here (1-8)" |

**Why text fields, not dropdowns?** Keeps it simple to set up. The analyser handles
validation -- if something's wrong it flags it clearly rather than silently failing.

### Section 2: Part 1 — Narrative Fiction

- Start with a **text block** (description field) containing the full passage text.
  Copy the passage exactly from the relevant `reading_test_form_N.md` file.
- Label it clearly: **"Part 1: Read this passage carefully, then answer Questions 1-10."**
- Add 10 multiple choice questions (Questions 1-10), each with exactly 4 options labelled A, B, C, D.

### Section 3: Part 2 — Non-Fiction

- Another **text block** with the Part 2 passage.
- Label: **"Part 2: Read this passage carefully, then answer Questions 11-18."**
- Add 8 multiple choice questions (Questions 11-18).

### Section 4: Part 3 — Literary Non-Fiction

- Another **text block** with the Part 3 passage.
- Label: **"Part 3: Read this passage carefully, then answer Questions 19-26."**
- Add 8 multiple choice questions (Questions 19-26).

---

## Microsoft Forms settings to enable

- **Turn OFF** "Shuffle questions" -- question order must stay 1-26.
- **Turn OFF** "Shuffle answers" -- A/B/C/D order must stay fixed.
- **Turn OFF** "Show correct answers" -- students must not see the answer key.
- **Turn ON** "Required" on every question -- prevents blank submissions.
- **Turn OFF** any sign-in requirement if you want students to use any device without
  a school account. (Student identity is captured via the text fields above.)
- Set a **title** like: `Reading Assessment — Form 3` so the CSV export is clear.

---

## Question text for each form

The question text and options for all 8 forms are in the markdown files in this repo:

| Form | Source file |
|------|------------|
| 1 | `reading_test_form_1.md` |
| 2 | `reading_test_form_2.md` |
| 3 | `reading_test_form_3.md` |
| 4 | `reading_test_form_4.md` |
| 5 | `reading_test_form_5.md` |
| 6 | `reading_test_form_6.md` |
| 7 | *(not yet written -- see note below)* |
| 8 | `reading_test_form_8.md` |

Copy each question's stem and its four options (A, B, C, D) directly into the Form.
Do **not** change the wording -- the answer key in the analyser is matched to the exact
questions as written.

**Note on Form 7:** The passage and questions for Form 7 have not been written yet.
The analyser already has a placeholder in its answer key for it -- once the content is
written, add the answer key entry to `analyse.py` following the same pattern as the
other forms.

---

## Exporting responses

When you want to run the analysis:

1. Open the Form in Microsoft Forms
2. Click **Responses** tab
3. Click the **Excel** icon (downloads as `.xlsx`) or use **"Download as CSV"** if available
4. The file will be named something like `Reading Assessment - Form 3.xlsx`

The analyser accepts both `.csv` and `.xlsx` files. If you only have the Excel file,
either use it directly or save it as CSV first (File > Save As > CSV in Excel).

### What the export looks like

Microsoft Forms exports one row per response. The columns are:

```
Start time | Completion time | Email | Name | First Name | Last Name | Date of Birth | Class | Test Form Number | Question 1 | Question 2 | ... | Question 26
```

The analyser expects the first 5 columns after the metadata columns to be the student
detail fields, followed by the 26 question answers in order. Column headers don't need
to match exactly -- the script finds them by position after the Forms metadata columns.

---

## Running multiple forms across a year

You can reuse the same pattern for each test:

- **September:** Share Form 1 link. Export after everyone finishes. Run analyser.
- **November:** Share Form 2 link. Export. Run analyser.
- **January:** Share Form 3 link. Etc.

Each export is a separate file. The analyser produces individual and class reports
from each file independently. If you want to track progress over time, run it on
each file and compare the reading ages across runs -- or keep all the CSVs and the
analyser can take multiple files at once (see `analyse.py --help`).

---

## Preventing cheating / retakes

Microsoft Forms has a few built-in options:

- **"Each person can submit only once"** -- turn this ON if students are signed into
  their school account. This is the simplest way to prevent retakes.
- If students are NOT signed in, there's no built-in prevention. In that case, the
  teacher controls access by only sharing the link during the test session and
  collecting devices afterwards (the same way you'd run a paper test).

---

## Accessibility notes

- Forms renders passages as plain text. If you need larger font sizes or high contrast,
  students can use their browser's built-in zoom (Ctrl+scroll or Ctrl+plus).
- The passage and questions appear on the same page by default in Forms. Students
  scroll to see both -- this is less ideal than a split-screen layout but works fine
  on tablets and desktops.
- Forms works on any modern browser: Chrome, Firefox, Edge, Safari.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Student submitted blank answers | Turn on "Required" for all questions before sharing the link |
| CSV columns are in wrong order | Don't rearrange columns in Excel before running the analyser. Use the file as-downloaded. |
| Student entered wrong class name | The analyser groups by class name exactly as entered. Ask students to use the same format (e.g. always "7A", never "Year 7 A") |
| Form 7 questions are missing | Form 7 content hasn't been written yet. Use Forms 1-6 and 8 for now. |
| Analyser can't find the file | Make sure you're running the command from the same folder the CSV/Excel file is in, or give the full file path |
