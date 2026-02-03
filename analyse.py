#!/usr/bin/env python3
"""
Reading Assessment Analyser
============================
Takes a Microsoft Forms CSV/Excel export of reading test responses and produces:
  - Per-student reports (score, reading age, skill breakdown, weaknesses, interventions)
  - A class summary report (mean/median reading age, at-risk students, common weaknesses)
  - An optional AI-ready summary that can be pasted into ChatGPT / Copilot for narrative analysis

Usage:
    python analyse.py responses.csv
    python analyse.py responses.csv --class 7A
    python analyse.py responses.csv --output reports/
    python analyse.py responses.csv --ai-summary
    python analyse.py --help

Requirements:
    pip install openpyxl   (only needed if passing an .xlsx file directly)

The script has zero other dependencies -- it uses only the Python standard library
plus openpyxl for Excel reading.
"""

import csv
import sys
import os
import argparse
import json
from datetime import datetime, date
from collections import defaultdict

# ---------------------------------------------------------------------------
# ANSWER KEYS & DIAGNOSTIC METADATA -- extracted from the test form specs
# ---------------------------------------------------------------------------
# Structure per form:
#   "answers": {question_number: correct_letter}
#   "skills": {question_number: skill_category}        -- maps to the 4 report categories
#   "difficulty": {question_number: level_1_to_5}
#
# Skill categories used in reports:
#   literal_comprehension  -- Literal Comprehension, Comprehension-Literal, Comprehension-Retrieval
#   inference              -- Inference-Basic, Inference-Intermediate, Inference-Advanced, Comprehension-Inference
#   vocabulary             -- Vocabulary-Context, Vocabulary-Analysis, Vocabulary-Figurative, Vocabulary-Sophisticated
#   synthesis              -- Comprehension-Synthesis, Comprehension-Analytical
#
# The question-to-skill and question-to-difficulty mappings are IDENTICAL across all 8 forms
# (by design -- the tests are parallel). Only the correct answers differ per form.

QUESTION_SKILLS = {
    1: "literal_comprehension",
    2: "literal_comprehension",
    3: "vocabulary",
    4: "inference",
    5: "literal_comprehension",
    6: "inference",
    7: "vocabulary",
    8: "inference",
    9: "inference",
    10: "synthesis",
    11: "literal_comprehension",
    12: "vocabulary",
    13: "literal_comprehension",
    14: "inference",
    15: "synthesis",
    16: "inference",
    17: "vocabulary",
    18: "synthesis",
    19: "vocabulary",
    20: "inference",
    21: "synthesis",
    22: "vocabulary",
    23: "inference",
    24: "synthesis",
    25: "inference",
    26: "vocabulary",
}

QUESTION_DIFFICULTY = {
    1: 1, 2: 1, 5: 1,                          # Level 1 (3 questions)
    3: 2, 4: 2, 6: 2, 7: 2, 11: 2, 13: 2,     # Level 2 (6 questions)
    8: 3, 9: 3, 10: 3, 12: 3, 14: 3, 15: 3, 16: 3, 18: 3,  # Level 3 (8 questions)
    17: 4, 19: 4, 20: 4, 21: 4, 22: 4,        # Level 4 (5 questions - note: 22 is diff 5 in form 8 spec
    23: 5, 24: 5, 25: 5, 26: 5,               #   but the diagnostic coding section lists it under Level 4
}                                              #   for forms 1-6. Using the diagnostic coding as source of truth.)

# Corrected difficulty from the "By Difficulty Level" diagnostic coding sections:
# Level 4: 17, 19, 20, 21, 22  (but form 8 spec says 22 is Level 5)
# The diagnostic coding section is consistent across all form markdowns, so use that.
# Actually re-checking: forms 1-6 diagnostic coding all say Level 4: 17, 19, 20, 21, 22
# and form 8 says the same in its diagnostic coding despite the question tag saying 5.
# Use the diagnostic coding (authoritative summary).
QUESTION_DIFFICULTY = {
    1: 1, 2: 1, 5: 1,
    3: 2, 4: 2, 6: 2, 7: 2, 11: 2, 13: 2,
    8: 3, 9: 3, 10: 3, 12: 3, 14: 3, 15: 3, 16: 3, 18: 3,
    17: 4, 19: 4, 20: 4, 21: 4, 22: 4,
    23: 5, 24: 5, 25: 5, 26: 5,
}

ANSWER_KEYS = {
    1: {
        1: "B", 2: "B", 3: "C", 4: "B", 5: "B", 6: "C", 7: "B", 8: "C", 9: "C", 10: "B",
        11: "B", 12: "B", 13: "B", 14: "A", 15: "B", 16: "B", 17: "B", 18: "C",
        19: "B", 20: "B", 21: "B", 22: "B", 23: "C", 24: "C", 25: "B", 26: "A",
    },
    2: {
        1: "C", 2: "C", 3: "B", 4: "C", 5: "D", 6: "B", 7: "C", 8: "B", 9: "C", 10: "B",
        11: "C", 12: "B", 13: "C", 14: "B", 15: "B", 16: "C", 17: "B", 18: "C",
        19: "B", 20: "C", 21: "B", 22: "B", 23: "C", 24: "B", 25: "B", 26: "B",
    },
    3: {
        1: "A", 2: "C", 3: "B", 4: "C", 5: "C", 6: "C", 7: "B", 8: "B", 9: "C", 10: "B",
        11: "C", 12: "B", 13: "C", 14: "C", 15: "A", 16: "B", 17: "B", 18: "C",
        19: "A", 20: "B", 21: "C", 22: "B", 23: "C", 24: "B", 25: "C", 26: "A",
    },
    4: {
        1: "B", 2: "C", 3: "B", 4: "C", 5: "C", 6: "B", 7: "B", 8: "C", 9: "B", 10: "C",
        11: "C", 12: "B", 13: "A", 14: "B", 15: "B", 16: "C", 17: "B", 18: "B",
        19: "B", 20: "C", 21: "B", 22: "B", 23: "B", 24: "B", 25: "B", 26: "B",
    },
    5: {
        1: "C", 2: "C", 3: "B", 4: "C", 5: "B", 6: "C", 7: "A", 8: "B", 9: "C", 10: "B",
        11: "C", 12: "B", 13: "C", 14: "B", 15: "C", 16: "B", 17: "C", 18: "B",
        19: "B", 20: "B", 21: "B", 22: "C", 23: "B", 24: "C", 25: "B", 26: "C",
    },
    6: {
        1: "B", 2: "C", 3: "B", 4: "A", 5: "B", 6: "C", 7: "B", 8: "B", 9: "B", 10: "C",
        11: "B", 12: "C", 13: "B", 14: "B", 15: "B", 16: "C", 17: "B", 18: "C",
        19: "B", 20: "B", 21: "B", 22: "C", 23: "B", 24: "B", 25: "B", 26: "B",
    },
    # Form 7: not yet written. Add the answer key here when the test content is created.
    # 7: { ... },
    8: {
        1: "B", 2: "C", 3: "B", 4: "C", 5: "C", 6: "C", 7: "B", 8: "C", 9: "C", 10: "B",
        11: "A", 12: "B", 13: "C", 14: "B", 15: "C", 16: "B", 17: "B", 18: "B",
        19: "B", 20: "B", 21: "B", 22: "B", 23: "B", 24: "C", 25: "B", 26: "B",
    },
}

# ---------------------------------------------------------------------------
# SCORING LOGIC  (mirrors server/utils/scoring.js exactly)
# ---------------------------------------------------------------------------

WEAKNESS_THRESHOLD = 60  # percentage below which a skill is flagged

INTERVENTIONS = {
    "literal_comprehension": [
        "Reciprocal reading activities",
        "Explicit instruction in skimming and scanning",
        "Question-answer relationship (QAR) strategy",
        "Close reading practice with highlighting key information",
    ],
    "inference": [
        "Think-aloud modelling of inference-making",
        '"Reading between the lines" explicit instruction',
        "Inference question stems practice",
        "Evidence-based reasoning activities",
        "Making predictions and checking them",
    ],
    "vocabulary": [
        "Context clue strategy instruction",
        "Word morphology study (roots, prefixes, suffixes)",
        "Academic vocabulary building (Tier 2 words)",
        "Word mapping and semantic feature analysis",
        "Wide reading to build vocabulary naturally",
    ],
    "synthesis": [
        "Summarising practice (main idea identification)",
        "Graphic organizers for text structure",
        "Compare and contrast activities",
        "Author's purpose and craft analysis",
        "Critical thinking question practice",
    ],
}

SKILL_DISPLAY_NAMES = {
    "literal_comprehension": "Literal Comprehension",
    "inference": "Inference",
    "vocabulary": "Vocabulary",
    "synthesis": "Synthesis/Analysis",
}


def calculate_reading_age(difficulty_scores):
    """
    Mirrors the calculateReadingAge function in server/utils/scoring.js.
    difficulty_scores: dict {1: {"score": n, "possible": n}, ...}
    """
    def cum(levels):
        s = sum(difficulty_scores[l]["score"] for l in levels if l in difficulty_scores)
        p = sum(difficulty_scores[l]["possible"] for l in levels if l in difficulty_scores)
        return (s / p * 100) if p > 0 else 0

    level1_2 = cum([1, 2])
    level1_3 = cum([1, 2, 3])
    level1_4 = cum([1, 2, 3, 4])
    all_levels = cum([1, 2, 3, 4, 5])

    if all_levels >= 80:
        return 15 + ((all_levels - 80) / 20)
    if level1_4 >= 70:
        return 13 + ((level1_4 - 70) / 10)
    if level1_4 >= 60:
        return 11 + ((level1_4 - 60) / 10)
    if level1_3 >= 60:
        return 9 + ((level1_3 - 60) / 40)
    if level1_2 >= 60:
        return 7 + ((level1_2 - 60) / 40)
    if level1_2 >= 40:
        return 6.5
    return 6.0


def score_student(answers, form_number):
    """
    answers: dict {1: "B", 2: "A", ...}  (question number -> selected letter)
    form_number: int
    Returns a dict with all computed scores.
    """
    key = ANSWER_KEYS[form_number]

    # Per-question results
    results = {}
    for q in range(1, 27):
        selected = answers.get(q, "").strip().upper()
        # Normalise: if student wrote "A)" or "a" or "Option A", extract just the letter
        if selected and selected[0] in "ABCD":
            selected = selected[0]
        correct = key[q]
        results[q] = {
            "selected": selected,
            "correct": correct,
            "is_correct": selected == correct,
            "skill": QUESTION_SKILLS[q],
            "difficulty": QUESTION_DIFFICULTY[q],
        }

    # Skill area totals
    skill_scores = {s: {"score": 0, "possible": 0} for s in SKILL_DISPLAY_NAMES}
    for q, r in results.items():
        skill_scores[r["skill"]]["possible"] += 1
        if r["is_correct"]:
            skill_scores[r["skill"]]["score"] += 1
    for s in skill_scores:
        p = skill_scores[s]["possible"]
        skill_scores[s]["percentage"] = round(skill_scores[s]["score"] / p * 100, 1) if p else 0

    # Difficulty level totals
    diff_scores = {d: {"score": 0, "possible": 0} for d in range(1, 6)}
    for q, r in results.items():
        diff_scores[r["difficulty"]]["possible"] += 1
        if r["is_correct"]:
            diff_scores[r["difficulty"]]["score"] += 1

    total_correct = sum(1 for r in results.values() if r["is_correct"])
    total = 26
    percentage = round(total_correct / total * 100, 1)
    reading_age = round(calculate_reading_age(diff_scores), 1)

    # Weaknesses
    weaknesses = [
        SKILL_DISPLAY_NAMES[s]
        for s in skill_scores
        if skill_scores[s]["percentage"] < WEAKNESS_THRESHOLD
    ]

    # Interventions
    interventions = {
        SKILL_DISPLAY_NAMES[s]: INTERVENTIONS[s]
        for s in skill_scores
        if skill_scores[s]["percentage"] < WEAKNESS_THRESHOLD
    }

    return {
        "total_score": total_correct,
        "total_possible": total,
        "percentage": percentage,
        "reading_age": reading_age,
        "skill_scores": skill_scores,
        "difficulty_scores": diff_scores,
        "weaknesses": weaknesses,
        "interventions": interventions,
        "question_results": results,
    }


def chronological_age(dob):
    """dob: date object. Returns age in years as a float."""
    today = date.today()
    years = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
    # More precise: fraction of year
    last_birthday = date(today.year if (today.month, today.day) >= (dob.month, dob.day) else today.year - 1, dob.month, dob.day)
    days_since = (today - last_birthday).days
    return round(years + days_since / 365.25, 1)


def parse_dob(raw):
    """Parse date of birth from various formats students might enter."""
    raw = raw.strip()
    for fmt in ("%d/%m/%Y", "%d-%m-%Y", "%Y-%m-%d", "%m/%d/%Y", "%d %b %Y", "%d %B %Y"):
        try:
            return datetime.strptime(raw, fmt).date()
        except ValueError:
            continue
    return None


# ---------------------------------------------------------------------------
# CSV / EXCEL PARSING
# ---------------------------------------------------------------------------

def read_excel(filepath):
    """Read .xlsx using openpyxl. Returns list of rows (each row is a list of cell values)."""
    try:
        import openpyxl
    except ImportError:
        print("ERROR: openpyxl is needed to read .xlsx files.")
        print("       Run: pip install openpyxl")
        sys.exit(1)
    wb = openpyxl.load_workbook(filepath, read_only=True, data_only=True)
    ws = wb.active
    rows = []
    for row in ws.iter_rows(values_only=True):
        rows.append([str(cell) if cell is not None else "" for cell in row])
    wb.close()
    return rows


def read_csv(filepath):
    """Read CSV. Returns list of rows (each row is a list of string values)."""
    rows = []
    with open(filepath, "r", encoding="utf-8-sig") as f:
        reader = csv.reader(f)
        for row in reader:
            rows.append(row)
    return rows


def load_responses(filepath):
    """
    Load and parse a Forms export file.
    Returns a list of student dicts:
        { first_name, last_name, dob (string), class_name, form_number (int), answers {1: "B", ...} }
    Also returns a list of any parse warnings.
    """
    if filepath.lower().endswith(".xlsx"):
        rows = read_excel(filepath)
    else:
        rows = read_csv(filepath)

    if len(rows) < 2:
        print("ERROR: File appears empty or has only a header row.")
        sys.exit(1)

    header = rows[0]
    warnings = []

    # Microsoft Forms exports start with metadata columns:
    # "Start time", "Completion time", "Email address" (if sign-in required), "Name" (if sign-in)
    # then the actual form fields follow.
    # We detect where the student fields start by looking for known field names.
    # If we can't find them by name, we fall back to assuming they start after the
    # standard Forms metadata columns (first 2-4 columns).

    meta_col_names = {"start time", "completion time", "email", "email address", "name"}
    first_student_col = 0
    for i, h in enumerate(header):
        if h.strip().lower() not in meta_col_names:
            first_student_col = i
            break

    # The student fields are: First Name, Last Name, DOB, Class, Form Number
    # followed by 26 question columns.
    # Minimum columns after metadata: 5 (details) + 26 (questions) = 31
    expected_after_meta = 31
    available_after_meta = len(header) - first_student_col

    if available_after_meta < expected_after_meta:
        print(f"ERROR: Expected at least {expected_after_meta} columns after metadata "
              f"(got {available_after_meta}). Check the export file.")
        print(f"       Header: {header}")
        sys.exit(1)

    students = []
    for row_idx, row in enumerate(rows[1:], start=2):  # 1-indexed, row 1 is header
        # Pad row if short
        while len(row) < len(header):
            row.append("")

        first_name  = row[first_student_col].strip()
        last_name   = row[first_student_col + 1].strip()
        dob_raw     = row[first_student_col + 2].strip()
        class_name  = row[first_student_col + 3].strip()
        form_raw    = row[first_student_col + 4].strip()

        # Validate
        if not first_name or not last_name:
            warnings.append(f"Row {row_idx}: Missing name -- skipped.")
            continue

        if not dob_raw:
            warnings.append(f"Row {row_idx} ({first_name} {last_name}): No date of birth -- skipped.")
            continue

        try:
            form_number = int(form_raw)
        except (ValueError, TypeError):
            warnings.append(f"Row {row_idx} ({first_name} {last_name}): "
                           f"Invalid form number '{form_raw}' -- skipped.")
            continue

        if form_number not in ANSWER_KEYS:
            warnings.append(f"Row {row_idx} ({first_name} {last_name}): "
                           f"Form {form_number} has no answer key (Form 7 not yet created) -- skipped.")
            continue

        # Extract 26 answers
        answers = {}
        answer_start = first_student_col + 5
        for q in range(1, 27):
            col_idx = answer_start + (q - 1)
            if col_idx < len(row):
                answers[q] = row[col_idx].strip()
            else:
                answers[q] = ""

        # Warn about unanswered questions
        missing = [q for q in range(1, 27) if not answers[q]]
        if missing:
            warnings.append(f"Row {row_idx} ({first_name} {last_name}): "
                           f"Missing answers for questions: {missing}")

        students.append({
            "first_name": first_name,
            "last_name": last_name,
            "dob_raw": dob_raw,
            "class_name": class_name,
            "form_number": form_number,
            "answers": answers,
        })

    return students, warnings


# ---------------------------------------------------------------------------
# REPORT GENERATION
# ---------------------------------------------------------------------------

def generate_student_report(student):
    """Generate a full text report for one student."""
    name = f"{student['first_name']} {student['last_name']}"
    dob = parse_dob(student["dob_raw"])
    chron_age = chronological_age(dob) if dob else None
    scored = student["scored"]
    reading_age = scored["reading_age"]

    lines = []
    lines.append("=" * 70)
    lines.append(f"  INDIVIDUAL STUDENT REPORT")
    lines.append("=" * 70)
    lines.append(f"  Student:          {name}")
    lines.append(f"  Date of Birth:    {student['dob_raw']}")
    if chron_age:
        lines.append(f"  Chronological Age: {chron_age}")
    lines.append(f"  Class:            {student['class_name']}")
    lines.append(f"  Test Form:        {student['form_number']}")
    lines.append(f"  Date Analysed:    {date.today().strftime('%d/%m/%Y')}")
    lines.append("-" * 70)

    # Overall score
    lines.append(f"  Overall Score:    {scored['total_score']}/26  ({scored['percentage']}%)")
    lines.append(f"  Reading Age:      {reading_age}")
    if chron_age:
        gap = round(reading_age - chron_age, 1)
        gap_str = f"+{gap}" if gap >= 0 else str(gap)
        status = "At or above expected" if gap >= 0 else (
            "Slightly below expected" if gap >= -1 else (
            "Below expected" if gap >= -2 else "Significantly below expected"))
        lines.append(f"  Age Gap:          {gap_str} years  ({status})")
        if gap <= -2:
            lines.append(f"  ** FLAG: This student is at risk (2+ years below expected) **")

    lines.append("-" * 70)

    # Skill area breakdown
    lines.append("  SKILL AREA BREAKDOWN")
    lines.append(f"  {'Skill':<28} {'Score':<10} {'%':<8} {'Status'}")
    lines.append(f"  {'-'*28} {'-'*10} {'-'*8} {'-'*20}")
    for skill_key in ["literal_comprehension", "inference", "vocabulary", "synthesis"]:
        s = scored["skill_scores"][skill_key]
        status = "WEAKNESS" if s["percentage"] < WEAKNESS_THRESHOLD else "OK"
        lines.append(f"  {SKILL_DISPLAY_NAMES[skill_key]:<28} {s['score']}/{s['possible']:<7} {s['percentage']:<8} {status}")

    lines.append("-" * 70)

    # Difficulty level performance
    lines.append("  PERFORMANCE BY DIFFICULTY LEVEL")
    lines.append(f"  {'Level':<10} {'Score':<10} {'%':<8}")
    lines.append(f"  {'-'*10} {'-'*10} {'-'*8}")
    level_labels = {1: "Level 1", 2: "Level 2", 3: "Level 3", 4: "Level 4", 5: "Level 5"}
    for lvl in range(1, 6):
        d = scored["difficulty_scores"][lvl]
        pct = round(d["score"] / d["possible"] * 100, 1) if d["possible"] else 0
        lines.append(f"  {level_labels[lvl]:<10} {d['score']}/{d['possible']:<7} {pct}%")

    lines.append("-" * 70)

    # Weaknesses and interventions
    if scored["weaknesses"]:
        lines.append("  IDENTIFIED WEAKNESSES & RECOMMENDED INTERVENTIONS")
        for weakness in scored["weaknesses"]:
            lines.append(f"\n  {weakness}:")
            for rec in scored["interventions"][weakness]:
                lines.append(f"    - {rec}")
    else:
        lines.append("  No weaknesses identified (all skill areas at 60% or above).")

    lines.append("-" * 70)

    # Question-by-question
    lines.append("  QUESTION BREAKDOWN")
    lines.append(f"  {'Q':<4} {'Your Answer':<12} {'Correct':<9} {'Result':<8} {'Skill':<28} {'Diff'}")
    lines.append(f"  {'-'*4} {'-'*12} {'-'*9} {'-'*8} {'-'*28} {'-'*5}")
    for q in range(1, 27):
        r = scored["question_results"][q]
        result = "Correct" if r["is_correct"] else "WRONG"
        lines.append(f"  {q:<4} {r['selected']:<12} {r['correct']:<9} {result:<8} {SKILL_DISPLAY_NAMES[r['skill']]:<28} {r['difficulty']}")

    lines.append("=" * 70)
    return "\n".join(lines)


def generate_class_report(students):
    """Generate a class summary report from a list of scored students."""
    if not students:
        return "No students to report on."

    class_name = students[0]["class_name"]
    lines = []
    lines.append("=" * 70)
    lines.append(f"  CLASS REPORT: {class_name}")
    lines.append("=" * 70)
    lines.append(f"  Students tested:  {len(students)}")
    lines.append(f"  Date Analysed:    {date.today().strftime('%d/%m/%Y')}")
    lines.append("-" * 70)

    # Gather reading ages and ages
    reading_ages = []
    chron_ages = []
    gaps = []
    at_risk = []

    for s in students:
        ra = s["scored"]["reading_age"]
        reading_ages.append(ra)
        dob = parse_dob(s["dob_raw"])
        if dob:
            ca = chronological_age(dob)
            chron_ages.append(ca)
            gap = round(ra - ca, 1)
            gaps.append(gap)
            if gap <= -2:
                at_risk.append(s)

    # Statistics
    reading_ages_sorted = sorted(reading_ages)
    mean_ra = round(sum(reading_ages) / len(reading_ages), 1)
    n = len(reading_ages_sorted)
    median_ra = reading_ages_sorted[n // 2] if n % 2 == 1 else round(
        (reading_ages_sorted[n // 2 - 1] + reading_ages_sorted[n // 2]) / 2, 1)
    min_ra = reading_ages_sorted[0]
    max_ra = reading_ages_sorted[-1]
    variance = sum((ra - mean_ra) ** 2 for ra in reading_ages) / len(reading_ages)
    std_dev = round(variance ** 0.5, 1)

    lines.append("  CLASS STATISTICS")
    lines.append(f"  Mean Reading Age:   {mean_ra}")
    lines.append(f"  Median Reading Age: {median_ra}")
    lines.append(f"  Range:              {min_ra} - {max_ra}")
    lines.append(f"  Std Deviation:      {std_dev}")
    lines.append(f"  Students at Risk:   {len(at_risk)}")
    lines.append("-" * 70)

    # Skill area class averages
    lines.append("  CLASS SKILL AVERAGES")
    skill_keys = ["literal_comprehension", "inference", "vocabulary", "synthesis"]
    lines.append(f"  {'Skill':<28} {'Avg %':<8} {'Status'}")
    lines.append(f"  {'-'*28} {'-'*8} {'-'*20}")
    common_weaknesses = []
    for sk in skill_keys:
        percentages = [s["scored"]["skill_scores"][sk]["percentage"] for s in students]
        avg = round(sum(percentages) / len(percentages), 1)
        below_60_count = sum(1 for p in percentages if p < WEAKNESS_THRESHOLD)
        is_common = below_60_count / len(students) >= 0.5  # >50% of class below threshold
        status = "COMMON WEAKNESS" if is_common else "OK"
        if is_common:
            common_weaknesses.append(SKILL_DISPLAY_NAMES[sk])
        lines.append(f"  {SKILL_DISPLAY_NAMES[sk]:<28} {avg:<8} {status}")

    lines.append("-" * 70)

    # Student summary table
    lines.append("  STUDENT SUMMARY")
    lines.append(f"  {'Name':<30} {'Score':<8} {'Read Age':<10} {'Chron Age':<11} {'Gap':<8} {'Weakest Skill'}")
    lines.append(f"  {'-'*30} {'-'*8} {'-'*10} {'-'*11} {'-'*8} {'-'*25}")
    for s in sorted(students, key=lambda x: x["last_name"]):
        name = f"{s['first_name']} {s['last_name']}"
        sc = s["scored"]
        dob = parse_dob(s["dob_raw"])
        ca = chronological_age(dob) if dob else "N/A"
        gap = round(sc["reading_age"] - ca, 1) if isinstance(ca, float) else "N/A"
        gap_str = f"+{gap}" if isinstance(gap, float) and gap >= 0 else str(gap)

        # Weakest skill
        weakest = min(
            ["literal_comprehension", "inference", "vocabulary", "synthesis"],
            key=lambda sk: sc["skill_scores"][sk]["percentage"]
        )
        weakest_name = SKILL_DISPLAY_NAMES[weakest]
        weakest_pct = sc["skill_scores"][weakest]["percentage"]

        flag = " **AT RISK**" if isinstance(gap, float) and gap <= -2 else ""
        lines.append(f"  {name:<30} {sc['total_score']}/26  {sc['reading_age']:<10} {str(ca):<11} {gap_str:<8} {weakest_name} ({weakest_pct}%){flag}")

    lines.append("-" * 70)

    # Students of concern
    if at_risk:
        lines.append("  STUDENTS OF CONCERN (reading age 2+ years below chronological age)")
        at_risk_sorted = sorted(at_risk, key=lambda s: s["scored"]["reading_age"])
        for s in at_risk_sorted:
            dob = parse_dob(s["dob_raw"])
            ca = chronological_age(dob) if dob else "?"
            gap = round(s["scored"]["reading_age"] - ca, 1) if isinstance(ca, float) else "?"
            weaknesses = ", ".join(s["scored"]["weaknesses"]) or "None"
            lines.append(f"    {s['first_name']} {s['last_name']}: "
                        f"Reading Age {s['scored']['reading_age']}, "
                        f"Gap {gap} years. Weaknesses: {weaknesses}")
    else:
        lines.append("  No students of concern identified.")

    if common_weaknesses:
        lines.append(f"\n  COMMON WEAKNESSES (>50% of class below 60%):")
        for w in common_weaknesses:
            lines.append(f"    - {w}")

    lines.append("=" * 70)
    return "\n".join(lines)


def generate_ai_summary(students, class_name):
    """
    Generate a structured text block that can be pasted into ChatGPT, Copilot, or
    any AI chat tool to get a narrative analysis of the class results.
    """
    lines = []
    lines.append("=" * 70)
    lines.append("  AI ANALYSIS PROMPT")
    lines.append("  Copy everything between the dashes below and paste it into")
    lines.append("  ChatGPT, Microsoft Copilot, or similar.")
    lines.append("=" * 70)
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append(f"I am a teacher at a UK secondary school. I have just administered a")
    lines.append(f"standardised reading assessment to my class ({class_name}).")
    lines.append(f"Please analyse the results below and provide:")
    lines.append(f"  1. A plain-English summary of how the class performed overall")
    lines.append(f"  2. The key strengths and weaknesses across the class")
    lines.append(f"  3. Specific, actionable teaching recommendations for each weakness")
    lines.append(f"  4. A brief note on any individual students who need urgent attention")
    lines.append(f"  5. Suggestions for how to differentiate next reading lessons")
    lines.append(f"")
    lines.append(f"CLASS: {class_name}")
    lines.append(f"NUMBER OF STUDENTS: {len(students)}")
    lines.append(f"")

    # Reading ages
    reading_ages = [s["scored"]["reading_age"] for s in students]
    mean_ra = round(sum(reading_ages) / len(reading_ages), 1)
    lines.append(f"MEAN READING AGE: {mean_ra}")
    lines.append(f"READING AGE RANGE: {min(reading_ages)} - {max(reading_ages)}")
    lines.append(f"")

    # Skill averages
    lines.append("SKILL AREA AVERAGES (percentage correct):")
    for sk in ["literal_comprehension", "inference", "vocabulary", "synthesis"]:
        avg = round(sum(s["scored"]["skill_scores"][sk]["percentage"] for s in students) / len(students), 1)
        lines.append(f"  {SKILL_DISPLAY_NAMES[sk]}: {avg}%")
    lines.append(f"")

    # Per-student summary
    lines.append("INDIVIDUAL RESULTS:")
    for s in sorted(students, key=lambda x: x["last_name"]):
        dob = parse_dob(s["dob_raw"])
        ca = chronological_age(dob) if dob else None
        gap = round(s["scored"]["reading_age"] - ca, 1) if ca else None
        weaknesses = ", ".join(s["scored"]["weaknesses"]) or "None"
        lines.append(f"  {s['first_name']} {s['last_name']}: "
                    f"Score {s['scored']['total_score']}/26, "
                    f"Reading Age {s['scored']['reading_age']}, "
                    + (f"Chron Age {ca}, Gap {'+' if gap and gap >= 0 else ''}{gap}, " if ca else "")
                    + f"Weaknesses: {weaknesses}")

    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("=" * 70)
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Analyse Microsoft Forms reading test export and generate reports.",
        epilog="Example: python analyse.py responses.csv --class 7A --output reports/"
    )
    parser.add_argument("file", help="Path to the Forms export file (.csv or .xlsx)")
    parser.add_argument("--class", dest="class_filter", default=None,
                       help="Only analyse students in this class (e.g. 7A)")
    parser.add_argument("--output", default=None,
                       help="Directory to write report files to (default: print to terminal)")
    parser.add_argument("--ai-summary", action="store_true",
                       help="Also generate an AI-ready summary prompt for each class")
    parser.add_argument("--json", action="store_true",
                       help="Output results as JSON instead of formatted text")
    args = parser.parse_args()

    if not os.path.isfile(args.file):
        print(f"ERROR: File not found: {args.file}")
        sys.exit(1)

    # Load and parse
    print(f"Loading {args.file}...")
    students_raw, warnings = load_responses(args.file)

    if warnings:
        print(f"\n  WARNINGS ({len(warnings)}):")
        for w in warnings:
            print(f"    {w}")
        print()

    if not students_raw:
        print("ERROR: No valid student responses found in the file.")
        sys.exit(1)

    # Score everyone
    for s in students_raw:
        s["scored"] = score_student(s["answers"], s["form_number"])

    # Filter by class if requested
    if args.class_filter:
        students_raw = [s for s in students_raw if s["class_name"].upper() == args.class_filter.upper()]
        if not students_raw:
            print(f"ERROR: No students found in class '{args.class_filter}'.")
            sys.exit(1)

    # Group by class
    by_class = defaultdict(list)
    for s in students_raw:
        by_class[s["class_name"]].append(s)

    # Output directory
    if args.output:
        os.makedirs(args.output, exist_ok=True)

    # --- Generate reports ---
    all_output = []

    for class_name in sorted(by_class.keys()):
        class_students = by_class[class_name]

        if args.json:
            # JSON output
            json_data = {
                "class": class_name,
                "date_analysed": date.today().isoformat(),
                "students": []
            }
            for s in class_students:
                dob = parse_dob(s["dob_raw"])
                student_json = {
                    "first_name": s["first_name"],
                    "last_name": s["last_name"],
                    "dob": s["dob_raw"],
                    "chronological_age": chronological_age(dob) if dob else None,
                    "class": s["class_name"],
                    "form_number": s["form_number"],
                    "total_score": s["scored"]["total_score"],
                    "percentage": s["scored"]["percentage"],
                    "reading_age": s["scored"]["reading_age"],
                    "gap": round(s["scored"]["reading_age"] - chronological_age(dob), 1) if dob else None,
                    "skill_scores": {
                        SKILL_DISPLAY_NAMES[k]: {
                            "score": v["score"],
                            "possible": v["possible"],
                            "percentage": v["percentage"]
                        } for k, v in s["scored"]["skill_scores"].items()
                    },
                    "weaknesses": s["scored"]["weaknesses"],
                    "interventions": s["scored"]["interventions"],
                }
                json_data["students"].append(student_json)

            output = json.dumps(json_data, indent=2)
            if args.output:
                path = os.path.join(args.output, f"class_{class_name}_results.json")
                with open(path, "w") as f:
                    f.write(output)
                print(f"  Written: {path}")
            else:
                print(output)
            continue

        # --- Text reports ---

        # Individual student reports
        for s in class_students:
            report = generate_student_report(s)
            if args.output:
                safe_name = f"{s['first_name']}_{s['last_name']}".replace(" ", "_")
                path = os.path.join(args.output, f"student_{safe_name}.txt")
                with open(path, "w") as f:
                    f.write(report)
                print(f"  Written: {path}")
            else:
                all_output.append(report)

        # Class report
        class_report = generate_class_report(class_students)
        if args.output:
            path = os.path.join(args.output, f"class_{class_name}_report.txt")
            with open(path, "w") as f:
                f.write(class_report)
            print(f"  Written: {path}")
        else:
            all_output.append(class_report)

        # AI summary (if requested)
        if args.ai_summary:
            ai_summary = generate_ai_summary(class_students, class_name)
            if args.output:
                path = os.path.join(args.output, f"class_{class_name}_ai_prompt.txt")
                with open(path, "w") as f:
                    f.write(ai_summary)
                print(f"  Written: {path}")
            else:
                all_output.append(ai_summary)

    # Print everything to terminal if no output dir
    if not args.output and all_output:
        print("\n".join(all_output))

    print(f"\nDone. Analysed {len(students_raw)} student(s) across {len(by_class)} class(es).")


if __name__ == "__main__":
    main()
