# Dependency Management System - Web Interface

This is a Next.js application for visualizing and managing dependency graphs. It provides a web interface to display project dependencies using d3.js for graph visualization and MUI for the UI components.

## Features

### Core Functionality
- **Project Query Interface**: Search and filter projects/nodes in the dependency graph
- **Graph Visualization**: Interactive dependency graph visualization using d3.js
- **Server Integration**: Connects to the backend dependency API for real-time data

### Technical Stack
- **Framework**: Next.js 14+ with App Router and SSR
- **UI Components**: Material-UI (MUI) for consistent design system
- **Graph Visualization**: d3.js for interactive dependency graphs
- **State Management**: React hooks and context for local state
- **Styling**: Emotion with MUI's styled components
- **API Integration**: Fetch API with proper error handling

## Implementation Requirements

### 1. Project/Node Query Page
- Searchable list of all projects/nodes
- Filter by project type, dependencies, or metadata
- Pagination for large datasets
- Real-time search with debouncing
- Display project details on selection

### 2. Graph Visualization Page
- Interactive force-directed graph using d3.js
- Node representation: circles with project names
- Edge representation: lines showing dependency relationships
- Zoom and pan capabilities
- Node selection and highlighting
- Tooltips showing detailed project information
- Color coding for different project types

### 3. API Integration
- Fetch dependency graph data from server API
- Handle loading states and error scenarios
- Real-time updates when dependencies change
- Caching strategy for better performance

### 4. UI/UX Requirements
- Responsive design for desktop and mobile
- Loading indicators for async operations
- Error boundaries and user-friendly error messages


## Implementation Guide
Use server actions to fetch the data.


## Tech Stack

- Next.js
- d3.js
- shadcn/ui
- tailwindcss
- typescript
- pnpm
- vitest