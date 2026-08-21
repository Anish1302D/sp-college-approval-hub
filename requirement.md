# S.P. College Approval and Workflow Management System

## Purpose

Provide a role-based web application for managing college approval workflows, financial and non-financial requests, inventory, documents, notifications, reporting, and audit history.

## Functional Requirements

- Support login and role-aware navigation for faculty, admin clerks, SFSP members, principals, and administrators.
- Allow faculty to create, view, and track financial and non-financial requests.
- Allow authorized users to review, approve, reject, escalate, and archive requests.
- Provide request detail views with status, history, supporting information, and actions.
- Manage inventory records and purchase bills.
- Provide document and faculty profile management.
- Show notifications and a notifications center.
- Provide exports, reports, analytics, settings, and audit history views.
- Display clear status badges, confirmation modals, and toast feedback for user actions.

## Non-Functional Requirements

- Use a responsive interface that works on desktop and mobile widths.
- Keep role-specific workflows easy to scan and use.
- Preserve consistent navigation, typography, colors, and interaction patterns across pages.
- Keep development setup reproducible with the package scripts in `package.json`.
- Do not commit generated dependencies, build output, or local environment files.

## Current Scope

This repository contains the frontend prototype implemented with React, Vite, Tailwind CSS, and Lucide icons. Application data is currently represented with local mock data and context state.
