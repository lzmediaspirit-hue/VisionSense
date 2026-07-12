// Chart templates (SPEC 4.2). Each template pre-fills the 8 pillar names
// (domain-appropriate) and pairs with a default theme; all 64 actions are
// left empty — the user fills those in. There is no addPillar API anywhere
// (see model/factory.ts), so a template is nothing more than a name list plus
// a themeId, passed straight through to createChart({ pillarNames, themeId }).

import type { ThemeId } from '../model/types';

export interface Template {
  id: string;
  label: string;
  description: string;
  /** Always length RULE_OF_8 (8). Empty string = left blank. */
  pillarNames: readonly string[];
  defaultThemeId: ThemeId;
}

export const TEMPLATES: readonly Template[] = [
  {
    id: 'blank',
    label: 'Blank',
    description: 'Start from scratch — name your own 8 pillars.',
    pillarNames: ['', '', '', '', '', '', '', ''],
    defaultThemeId: 'minimal',
  },
  {
    id: 'athlete',
    label: 'Athlete',
    description: 'Train like Ohtani: performance paired with character and luck.',
    pillarNames: [
      'Strength & Conditioning',
      'Skill & Technique',
      'Nutrition',
      'Recovery & Sleep',
      'Mental Game',
      'Game IQ & Strategy',
      'Team & Relationships',
      'Luck & Character',
    ],
    defaultThemeId: 'stadium',
  },
  {
    id: 'founder',
    label: 'Founder',
    description: 'Build a company without losing yourself in the process.',
    pillarNames: [
      'Product & Roadmap',
      'Customers & Sales',
      'Fundraising & Runway',
      'Team & Hiring',
      'Operations & Systems',
      'Personal Health',
      'Network & Mentors',
      'Mindset & Resilience',
    ],
    defaultThemeId: 'minimal',
  },
  {
    id: 'student',
    label: 'Student',
    description: 'A whole-person plan for the school year.',
    pillarNames: [
      'Coursework & Grades',
      'Study Habits',
      'Test Prep',
      'Reading & Curiosity',
      'Health & Sleep',
      'Friendships & Community',
      'Extracurriculars',
      'Character & Discipline',
    ],
    defaultThemeId: 'campus',
  },
  {
    id: 'actor',
    label: 'Actor',
    description: 'Craft, career, and the business of acting.',
    pillarNames: [
      'Craft & Technique',
      'Voice & Movement',
      'Auditions & Casting',
      'Networking & Representation',
      'Physical Fitness',
      'Business & Finances',
      'Resilience & Mindset',
      'Reputation & Relationships',
    ],
    defaultThemeId: 'marquee',
  },
  {
    id: 'life-plan',
    label: 'Life Plan',
    description: 'The classic 8-pillar whole-life mandala.',
    pillarNames: [
      'Career & Work',
      'Health & Fitness',
      'Finances',
      'Relationships & Family',
      'Personal Growth',
      'Fun & Recreation',
      'Contribution & Community',
      'Mindset & Character',
    ],
    defaultThemeId: 'minimal',
  },
] as const;

export function getTemplate(id: string): Template | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
