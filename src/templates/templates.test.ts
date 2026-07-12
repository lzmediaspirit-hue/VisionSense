import { describe, expect, it } from 'vitest';
import { createChart } from '../model/factory';
import { RULE_OF_8 } from '../model/types';
import { AVAILABLE_THEME_IDS } from '../themes/themes';
import { getTemplate, TEMPLATES } from './templates';

describe('templates', () => {
  it('defines exactly Blank, Athlete, Founder, Student, Actor, Life Plan', () => {
    expect(TEMPLATES.map((t) => t.id)).toEqual([
      'blank',
      'athlete',
      'founder',
      'student',
      'actor',
      'life-plan',
    ]);
  });

  it('every template has exactly 8 pillar names (Rule of 8)', () => {
    for (const t of TEMPLATES) {
      expect(t.pillarNames).toHaveLength(RULE_OF_8);
    }
  });

  it('non-blank templates use concrete, non-empty, distinct pillar names', () => {
    for (const t of TEMPLATES) {
      if (t.id === 'blank') continue;
      const trimmed = t.pillarNames.map((n) => n.trim());
      expect(trimmed.every((n) => n.length > 0)).toBe(true);
      expect(new Set(trimmed).size).toBe(RULE_OF_8);
    }
  });

  it('the Blank template leaves all pillar names empty', () => {
    const blank = getTemplate('blank');
    expect(blank?.pillarNames.every((n) => n === '')).toBe(true);
  });

  it('every default theme is a currently-available theme', () => {
    for (const t of TEMPLATES) {
      expect(AVAILABLE_THEME_IDS).toContain(t.defaultThemeId);
    }
  });

  it('maps each template to its spec-required default theme', () => {
    expect(getTemplate('athlete')?.defaultThemeId).toBe('stadium');
    expect(getTemplate('actor')?.defaultThemeId).toBe('marquee');
    expect(getTemplate('student')?.defaultThemeId).toBe('campus');
    expect(getTemplate('blank')?.defaultThemeId).toBe('minimal');
    expect(getTemplate('founder')?.defaultThemeId).toBe('minimal');
    expect(getTemplate('life-plan')?.defaultThemeId).toBe('minimal');
  });

  it('building a chart from a template preserves the Rule of 8 and fills only pillar names', () => {
    for (const t of TEMPLATES) {
      const chart = createChart({
        pillarNames: t.pillarNames,
        themeId: t.defaultThemeId,
        templateId: t.id,
      });
      expect(chart.pillars).toHaveLength(RULE_OF_8);
      for (let i = 0; i < RULE_OF_8; i++) {
        expect(chart.pillars[i].name).toBe(t.pillarNames[i]);
        expect(chart.pillars[i].actions).toHaveLength(RULE_OF_8);
        for (const action of chart.pillars[i].actions) {
          expect(action.text).toBe('');
          expect(action.status).toBe('todo');
        }
      }
      expect(chart.goal).toBe('');
      expect(chart.themeId).toBe(t.defaultThemeId);
      expect(chart.templateId).toBe(t.id);
    }
  });

  it('getTemplate returns undefined for unknown ids', () => {
    expect(getTemplate('nope')).toBeUndefined();
  });
});
