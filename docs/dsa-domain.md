# DSA Domain - Phase 13

## Overview

The DSA (Data Structures and Algorithms) foundation module provides a comprehensive system for tracking, practicing, and mastering DSA problems. It integrates with the existing Avenza skills, evidence, goals, and tasks systems to provide a cohesive learning experience.

## Core Concepts

### DSA Problem
A DSA problem represents a specific algorithmic challenge that users can attempt to solve. Each problem has:
- Title and description
- Difficulty level (Easy/Medium/Hard)
- Source (User/System/Imported)
- Status (Active/Archived)
- Tracking metrics (attempt count, solve count, etc.)

### DSA Topic
Topics provide a way to categorize and organize problems by subject area (e.g., "Arrays", "Trees", "Dynamic Programming"). Topics can be hierarchical with parent/child relationships.

### DSA Attempt
Each time a user works on a problem, an attempt is recorded. Attempts track:
- Status (Attempted/Solved/Failed/Abandoned)
- Timestamps (started, submitted, occurred)
- Optional metrics (solve time, language used, notes)

### Spaced Repetition System
The DSA module implements a deterministic spaced repetition algorithm based on:
- Revision dues (2/7/21 day intervals)
- Failure history tracking
- Problem recommendation engine
- Weak area detection

### Integration Points
- **Skills System**: Problems can be linked to skills, and solving problems generates skill evidence
- **Goals System**: Problems can be linked to goals for targeted learning
- **Tasks System**: Problems can be linked to tasks for actionable work items
- **Evidence System**: Solved problems automatically generate evidence entries

## Database Schema

The DSA module adds the following tables:
- `dsa_problems` - Core problem information
- `dsa_topics` - Topic categorization system  
- `dsa_attempts` - History of user attempts (append-only)
- Junction tables for many-to-many relationships:
  - `dsa_problems_topics`
  - `dsa_problems_skills` 
  - `dsa_problems_goals`
  - `dsa_problems_tasks`

## Key Features

1. **Deterministic Mastery Engine**: All problem statistics are computed deterministically from attempt history
2. **Revision Tracking**: Automatic scheduling of problem reviews based on spaced repetition principles
3. **Recommendation System**: Suggests problems to work on based on revision dues and weakness analysis
4. **Weak Area Detection**: Identifies topics where users need additional practice
5. **RLS Policies**: Row Level Security ensures data isolation between users
6. **Full CRUD Operations**: Complete create, read, update, delete functionality for problems, topics, and attempts
7. **Linking Flexibility**: Problems can be linked to any combination of topics, skills, goals, and tasks

## API Endpoints

### Problem Management
- `GET /dsa/problems` - List problems with filtering options
- `GET /dsa/problems/{id}` - Get specific problem details
- `POST /dsa/problems` - Create a new problem
- `PATCH /dsa/problems/{id}` - Update problem properties
- `POST /dsa/problems/{id}/archive` - Archive a problem

### Attempt Management
- `POST /dsa/problems/{problemId}/attempts` - Record a new attempt
- `GET /dsa/problems/{problemId}/attempts` - Get attempt history for a problem
- `GET /dsa/attempts/{id}` - Get specific attempt details
- `PATCH /dsa/attempts/{id}` - Update attempt properties
- `DELETE /dsa/attempts/{id}` - Delete an attempt

### Topic Management
- `GET /dsa/topics` - List topics with filtering
- `GET /dsa/topics/{id}` - Get specific topic details
- `POST /dsa/topics` - Create a new topic
- `PATCH /dsa/topics/{id}` - Update topic properties
- `POST /dsa/topics/{id}/archive` - Archive a topic

### Link Management
- `POST /dsa/problems/{problemId}/topics` - Link problem to topic
- `DELETE /dsa/problems/{problemId}/topics/{topicId}` - Remove problem-topic link
- Similar endpoints for skills, goals, and tasks

### Analytics & Recommendations
- `GET /dsa/overview` - Get DSA dashboard statistics including:
  - Total/solved/attempted problem counts
  - Revision due count
  - Weak areas analysis
  - Recommended problem suggestions

## Deterministic Algorithms

### Revision Scheduling
Problems are scheduled for review using fixed intervals:
- First review: 2 days after solving
- Second review: 7 days after first review  
- Third review: 21 days after second review
- Subsequent reviews: Every 21 days

### Recommendation Engine
The recommended problem is selected based on:
1. Problems due for revision (highest priority)
2. Problems with highest failure rates in weak topics
3. New problems in topics related to user goals/skills
4. Random selection from remaining problems

### Weak Area Detection
Weak areas are identified by:
- Topics with failure rate > 50%
- Minimum of 3 attempts in the topic
- Ranked by failure rate descending

## Row Level Security (RLS)

All DSA tables implement RLS policies that:
- Restrict access to users' own data only
- Prevent cross-user data leakage
- Allow anonymous users to see system/provided problems
- Ensure proper data isolation in multi-user scenarios

## Integration with Existing Systems

### Skills Integration
- Solved DSA problems generate evidence for linked skills
- Problem difficulty and solve time contribute to skill mastery calculations
- Skill recommendations can suggest relevant DSA problems

### Goals & Tasks Integration  
- Problems can be directly linked to goals and tasks
- Progress on linked problems contributes to goal/task completion
- Goal-oriented problem filtering and tracking

### Evidence System
- Each solved problem attempt creates an evidence entry
- Evidence includes problem details, solve time, and user notes
- Contributes to overall skill mastery and progress tracking

## Frontend Components

The DSA module includes:
- Problem listing and filtering interface
- Problem creation/editing forms  
- Problem detail views with attempt history
- Topic management interface
- Attempt recording forms
- Dashboard widgets showing DSA statistics
- Integration with existing navigation and layout systems

## Testing

The module includes:
- Unit tests for business logic and algorithms
- Integration tests for API endpoints
- Frontend component tests
- End-to-end testing of key user workflows

## Future Enhancements

Potential future enhancements for the DSA module:
- Code execution sandbox for testing solutions
- Community problem sharing and collaboration
- Advanced analytics and heatmaps
- Integration with external problem platforms (LeetCode, HackerRank, etc.)
- AI-powered hint and explanation systems