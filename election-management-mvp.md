# Election Management System MVP

## Business Requirements

- Build an MVP of a web-based Election Management application.
- The entire application should revolve around voters.
- The system should allow basic management of voters, groups, group leaders, and division heads.
- Keep the MVP simple, focused, and professional.
- The priority is a slick, professional, gorgeous UI/UX with simple and clear workflows.
- The app should open with dummy data populated so the user can immediately understand the hierarchy and workflow.

## Core Concept

The system is based on a management hierarchy:

1. Voters are the main entity in the system.
2. Voters can be assigned to one or more groups.
3. Each group is managed by a group leader.
4. Group leaders are managed by division heads.
5. Division heads provide a higher-level view of the groups and voters under their responsibility.

## Main Entities

### Voter

Each voter should include the following fields:

- First name
- Last name
- Unique ID number
- Full address:
  - Street
  - Street number
  - Building
  - Apartment
  - City
- Assigned groups

### Group

Each group should include the following fields:

- Group name (topic-based, e.g., "Parents - Elementary School", "Parents - Kindergarten")
- Group leader
- List of assigned voters

Rules:

- A group must have one group leader assigned at creation. A group cannot be created without a group leader.
- A group leader can manage more than one group.
- A voter can belong to one or more groups.
- If a group leader is deleted, their groups remain in the system without an assigned group leader (see Group Leader deletion rules). This is a valid temporary state.

### Group Leader

Each group leader should include the following fields:

- First name
- Last name
- Unique ID number
- Phone number
- Email
- Assigned division head
- Managed groups

Rules:

- A group leader can manage multiple groups.
- A group leader must belong to one division head.
- Deleting a group leader who manages one or more groups requires explicit user confirmation via a warning dialog stating the action is irreversible.
- Upon confirmed deletion, the group leader is removed and their groups remain in the system without an assigned group leader. This is a valid state (e.g., a group leader who is no longer active).
- Groups without a group leader must be visually indicated in the UI (e.g., a badge or label).

### Division Head

Each division head should include the following fields:

- First name
- Last name
- Unique ID number
- Phone number
- Email
- Managed group leaders

Rules:

- A division head can manage multiple group leaders.
- A division head has an overview of all groups and voters under the group leaders assigned to them.

## MVP Functionality

### Voter Management

- Display a list of voters.
- Add a new voter.
- Edit an existing voter.
- Delete an existing voter.
- Assign a voter to one or more groups.
- Show the voter’s full address clearly.

### Group Management

- Display a list of groups.
- Add a new group.
- Rename an existing group.
- Delete an existing group.
- Assign a group leader to a group.
- View voters assigned to each group.

### Group Leader Management

- Display a list of group leaders.
- Add a new group leader.
- Edit an existing group leader.
- Delete an existing group leader.
- Assign a group leader to a division head.
- View groups managed by each group leader.

### Division Head Management

- Display a list of division heads.
- Add a new division head.
- Edit an existing division head.
- Delete an existing division head.
- View group leaders managed by each division head.

### Warning and Confirmation Policy

Any action that modifies or removes data must display a confirmation warning dialog before execution. This applies universally across all entities:

- Deleting any entity (voter, group, group leader, division head)
- Renaming a group (the user must confirm the name change will be reflected across all records)
- Unassigning a group leader from a group
- Unassigning a group leader from a division head
- Removing a voter from a group

The warning dialog must clearly state what will change and that the action cannot be undone.

When a group is renamed, the new name is automatically reflected everywhere that group appears in the system. No manual update is required.

### Search

The application includes a search screen that allows finding voters by the following parameters:

- Last name
- Group leader name
- Street name
- Street name and street number combined (to identify all voters in a specific building)

Search results display matching voters with their full address, assigned groups, and group leader.

The street + number search is designed to identify family clusters — for example, searching "Orlanski 13" should return all voters registered at that address, making it easy to identify members of the same household or building.

Search results must update as the user types (live filtering).

### Dashboard

The application should include a simple dashboard showing:

- Total number of voters
- Total number of groups
- Total number of group leaders
- Total number of division heads
- A clear hierarchy view:
  - Division Head
    - Group Leader
      - Group
        - Voters

## Status Manager

### Overview

The system includes a Status Manager that allows defining voter statuses. Statuses are labels with color indicators used to classify voters (e.g., supporter, opponent, undecided).

### Default Statuses

The system ships with three default statuses:

| Name      | Color   | Default |
|-----------|---------|---------|
| תומך      | Green   | No      |
| מתנגד     | Red     | No      |
| מתלבט     | Amber   | Yes     |

### Status Rules

- There is always exactly one default status.
- The default status cannot be deleted — only renamed or recolored.
- When a status is deleted, all voters assigned to it revert automatically to the current default status.
- When a status is renamed, all voters assigned to it reflect the new name immediately (since voters store a `statusId`, not the name).
- The user can mark any status as the new default (the previous default loses that designation).
- Any number of custom statuses can be created.
- Each status has a name and a color (hex color code).

### Status Management Screen

- Display all statuses as visual cards with a color swatch, name, and default badge.
- Create a new status (name + color picker).
- Edit an existing status (rename and/or recolor).
- Delete a status (with confirmation dialog; disabled for the default status).
- Set a status as the new default (button on non-default status cards).

### Future: Status linked to voters

In a future phase (Telemarketing screen), each voter will be assigned a status. The status will be visible on the voters list, search results, and the telemarketing workflow.

## Out of Scope for MVP

No additional functionality should be added at this stage.

Do not include:

- User management
- Authentication
- Permissions
- Archive
- Messaging
- Campaign events
- Election day logistics
- Import/export
- Reports
- Map view
- Persistence or database
- Complex analytics

## Technical Details

- Implement as a modern NextJS app.
- The app should be client-rendered.
- The NextJS app should be created in a subdirectory named `frontend`.
- No backend is required for the MVP.
- No persistence is required.
- Data should be stored in client-side state only.
- The app should load with dummy data.
- Use popular, modern libraries.
- Keep the implementation as simple as possible while maintaining an elegant UI.

## Recommended Libraries

Use simple and popular libraries only:

- NextJS
- React
- TypeScript
- Tailwind CSS
- shadcn/ui or similar UI components
- lucide-react for icons
- React Hook Form if forms require structure
- Zod only if validation is needed and kept simple
- Playwright for integration testing
- Vitest for unit testing

## UI/UX Direction

The UI should feel modern, clean, and professional.

Key principles:

- Simple navigation
- Clear hierarchy
- Beautiful cards and panels
- Clean tables
- Minimal forms
- Strong visual distinction between voters, groups, group leaders, and division heads
- No clutter
- No unnecessary screens
- No unnecessary features

## Color Scheme

Use the following colors consistently:

- Accent Yellow: `#ecad0a` for accent lines and highlights
- Blue Primary: `#209dd7` for links and key sections
- Purple Secondary: `#753991` for submit buttons and important actions
- Dark Navy: `#032147` for main headings
- Gray Text: `#888888` for supporting text and labels

## Suggested Screens

### 1. Dashboard

Purpose:

- Give a quick overview of the election management structure.

Content:

- Summary cards
- Hierarchy preview
- Recent dummy voters or groups

Success criteria:

- User can immediately understand the system structure.
- The dashboard is visually impressive and simple.

### 2. Voters

Purpose:

- Manage voters.

Content:

- Voter list
- Add voter button
- Edit voter form
- Delete voter action
- Group assignment control

Success criteria:

- User can add, edit, delete, and assign voters to groups.
- The address is displayed clearly.

### 3. Groups

Purpose:

- Manage groups and their leaders.

Content:

- Group cards or table
- Group leader assignment
- List of voters per group

Success criteria:

- User can create and rename groups.
- User can assign a group leader.
- User can view which voters belong to each group.

### 4. Group Leaders

Purpose:

- Manage group leaders.

Content:

- Group leader list
- Assigned division head
- Managed groups

Success criteria:

- User can add, edit, and delete group leaders.
- User can assign each group leader to a division head.

### 5. Division Heads

Purpose:

- Manage division heads.

Content:

- Division head list
- Group leaders under each division head

Success criteria:

- User can add, edit, and delete division heads.
- User can see the management hierarchy clearly.

### 6. Search

Purpose:

- Find voters quickly by various parameters.

Content:

- Search input with parameter selector (last name / group leader / street / street + number)
- Live-filtered results table showing voter name, address, group leader, and assigned groups

Success criteria:

- User can search by last name, group leader, street, or street and number.
- Results update as the user types.
- Searching by street and number returns all voters in that building, enabling identification of family clusters.

## Data Model

### Voter

```ts
type Voter = {
  id: string;
  firstName: string;
  lastName: string;
  uniqueId: string;
  address: {
    street: string;
    streetNumber: string;
    building: string;
    apartment: string;
    city: string;
  };
  groupIds: string[];
};
```

### Group

```ts
type Group = {
  id: string;
  name: string;
  groupLeaderId: string;
  voterIds: string[];
};
```

### GroupLeader

```ts
type GroupLeader = {
  id: string;
  firstName: string;
  lastName: string;
  uniqueId: string;
  phone: string;
  email: string;
  divisionHeadId: string;
  groupIds: string[];
};
```

### DivisionHead

```ts
type DivisionHead = {
  id: string;
  firstName: string;
  lastName: string;
  uniqueId: string;
  phone: string;
  email: string;
  groupLeaderIds: string[];
};
```

## Dummy Data

The app should open with dummy data that includes:

- At least 20 voters
- At least 5 groups
- At least 4 group leaders
- At least 2 division heads

The dummy data should demonstrate:

- Voters assigned to groups
- Groups assigned to group leaders
- Group leaders assigned to division heads
- A complete hierarchy from division head to voter

### Reference Example (must be included in dummy data)

The following real example must be present in the dummy data to serve as a concrete reference:

- **Voter**: Benjamin Zaidner, ID 060734282, Petah Tikva, Orlanski St. 13, Apt. 17
- **Group Leader**: Uri Mani (manages Benjamin's groups)
- **Division Head**: Tzachi Zelicha (manages Uri Mani)
- **Groups Benjamin belongs to**: "Parents - Elementary School (First Grade)", "Parents - Kindergarten" (and at least one more)

This chain demonstrates the full hierarchy: Division Head → Group Leader → Voter → Groups.

## Project Structure

The project should be created under:

```txt
frontend/
```

Recommended structure:

```txt
frontend/
  app/
  components/
  data/
  lib/
  types/
  tests/
  public/
  package.json
  README.md
  .gitignore
```

## Implementation Plan

### Phase 1: Project Scaffolding

Tasks:

- Create NextJS project in `frontend`.
- Configure TypeScript.
- Configure Tailwind CSS.
- Add `.gitignore`.
- Add minimal `README.md`.
- Install selected UI libraries.
- Create base layout and navigation.

Success criteria:

- App runs locally.
- Project structure is clean.
- No unnecessary files or features are included.

### Phase 2: Data Model and Dummy Data

Tasks:

- Define TypeScript types.
- Create dummy voters, groups, group leaders, and division heads.
- Load dummy data into client-side state.

Success criteria:

- App opens with populated data.
- Relationships between entities are visible and correct.

### Phase 3: UI Layout

Tasks:

- Build dashboard.
- Build navigation.
- Build reusable cards, tables, and form components.
- Apply the defined color scheme.

Success criteria:

- UI looks professional and polished.
- User can clearly understand the hierarchy.
- Layout is responsive and clean.

### Phase 4: CRUD Workflows

Tasks:

- Add, edit, and delete voters.
- Add, edit, rename, and delete groups.
- Add, edit, and delete group leaders.
- Add, edit, and delete division heads.
- Implement assignment flows:
  - Voter to groups
  - Group to group leader
  - Group leader to division head

Success criteria:

- All core actions work.
- State updates immediately.
- No broken relationships are shown in the UI.

### Phase 5: Unit Testing

Tasks:

- Test data relationship helpers.
- Test assignment logic.
- Test delete behavior.
- Test simple form behavior where useful.

Success criteria:

- Unit tests pass.
- Core logic is covered.
- Tests stay simple and focused.

### Phase 6: Integration Testing

Tasks:

- Add Playwright tests.
- Test loading the app with dummy data.
- Test adding a voter.
- Test assigning a voter to a group.
- Test creating a group and assigning a leader.
- Test viewing the hierarchy.

Success criteria:

- Playwright tests pass.
- The MVP behaves correctly from the user’s perspective.

### Phase 7: Final Review

Tasks:

- Remove unused code.
- Confirm there are no extra features.
- Confirm UI follows the color scheme.
- Confirm README is minimal.
- Confirm the server runs successfully.

Success criteria:

- MVP is complete.
- Server is running.
- App is ready for user review.
- The system remains simple and focused.

## Acceptance Criteria

The MVP is complete only when:

- The app runs successfully from the `frontend` directory.
- The app opens with dummy data.
- The dashboard shows the election management hierarchy.
- Voters can be added, edited, deleted, and assigned to groups.
- Groups can be added, renamed, deleted, and assigned to group leaders.
- Group leaders can be added, edited, deleted, and assigned to division heads.
- Division heads can be added, edited, and deleted.
- The hierarchy is clear:
  - Division Head
    - Group Leader
      - Group
        - Voter
- The UI is clean, professional, and visually polished.
- There is no persistence.
- There is no authentication.
- No extra functionality is implemented.
- Unit tests pass.
- Playwright integration tests pass.
- README is minimal.
- `.gitignore` exists.
- The implementation is simple and not over-engineered.

## Coding Standards

1. Use latest stable libraries and idiomatic approaches.
2. Keep it simple.
3. Never over-engineer.
4. Do not add unnecessary defensive programming.
5. Do not add extra features.
6. Focus only on the MVP.
7. Be concise.
8. Keep README minimal.
9. Do not use emojis anywhere in the code, README, UI text, or documentation.
