# Requirements — ZIN-SDD-025 Alta Reject Modal Focus

## Intent

Make the alta rejection modal behave like a proper keyboard-accessible dialog without changing rejection business behavior.

## EARS Requirements

- [REQ-001] WHEN the admin opens the alta rejection modal, the system shall move keyboard focus to the first actionable field inside the dialog.
- [REQ-002] WHILE the alta rejection modal is open, the system shall keep Tab and Shift+Tab navigation inside the dialog controls.
- [REQ-003] WHEN the admin presses Escape while the alta rejection modal is open, the system shall close the dialog without submitting rejection data.
- [REQ-004] WHEN the alta rejection modal closes, the system shall restore focus to the control that opened it when that control is still available.
- [REQ-005] The alta rejection modal shall preserve the existing rejection payload, success toast, and refresh behavior.

## Properties

- No database schema change is required.
- No PII is added to logs, errors, attributes, or test output.
- The dialog shall remain operable by mouse and keyboard.
