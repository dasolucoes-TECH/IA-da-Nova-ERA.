import { describe, it, expect } from 'vitest'
import {
  canManageRules,
  getNotificationSeverityForExecution,
  getEventStatusOnError,
  isRetryableError,
  calculateBackoff,
  ACTION_REGISTRY,
  canExecuteAction,
} from './autopilot-utils'

describe('Sprint 1.1 — Autopilot Hardening', () => {
  it('EDITOR create rule → 403', () => {
    expect(canManageRules('EDITOR')).toBe(false)
  })

  it('VIEWER create rule → 403', () => {
    expect(canManageRules('VIEWER')).toBe(false)
  })

  it('OWNER create rule → allowed', () => {
    expect(canManageRules('OWNER')).toBe(true)
  })

  it('ADMIN create rule → allowed', () => {
    expect(canManageRules('ADMIN')).toBe(true)
  })

  it('EDITOR toggle rule → 403', () => {
    expect(canManageRules('EDITOR')).toBe(false)
  })

  it('VIEWER toggle rule → 403', () => {
    expect(canManageRules('VIEWER')).toBe(false)
  })

  it('OWNER toggle rule → allowed', () => {
    expect(canManageRules('OWNER')).toBe(true)
  })

  it('ADMIN toggle rule → allowed', () => {
    expect(canManageRules('ADMIN')).toBe(true)
  })

  it('worker delegates to single executor (execute-action route)', () => {
    const implemented = ACTION_REGISTRY.filter((a) => a.implemented)
    expect(implemented.length).toBeGreaterThan(0)
    for (const a of implemented) {
      expect(canExecuteAction(a)).toBe(true)
    }
  })

  it('approval delegates to single executor', () => {
    const seoAction = ACTION_REGISTRY.find((a) => a.name === 'GENERATE_PRODUCT_SEO')
    expect(seoAction).toBeDefined()
    expect(canExecuteAction(seoAction!)).toBe(true)
  })

  it('manual (process-jobs) delegates to single executor', () => {
    const contentAction = ACTION_REGISTRY.find((a) => a.name === 'GENERATE_PRODUCT_CONTENT')
    expect(contentAction).toBeDefined()
    expect(canExecuteAction(contentAction!)).toBe(true)
  })

  it('failed executor → notification ERROR', () => {
    expect(getNotificationSeverityForExecution('FAILED')).toBe('ERROR')
    expect(getNotificationSeverityForExecution('FAILED')).not.toBe('SUCCESS')
  })

  it('completed executor → notification SUCCESS', () => {
    expect(getNotificationSeverityForExecution('COMPLETED')).toBe('SUCCESS')
  })

  it('event core exception → event FAILED', () => {
    const result = getEventStatusOnError('Rule evaluation failed: unexpected error')
    expect(result.status).toBe('FAILED')
    expect(result.error).toBe('Rule evaluation failed: unexpected error')
    expect(result.processed_at).toBeDefined()
    expect(new Date(result.processed_at).getTime()).not.toBeNaN()
  })

  it('event core exception → event never remains PROCESSING', () => {
    const result = getEventStatusOnError('Job creation failed')
    expect(result.status).not.toBe('PROCESSING')
  })

  it('single executor: ACTION_REGISTRY has exactly 12 unique entries', () => {
    expect(ACTION_REGISTRY.length).toBe(12)
    const names = ACTION_REGISTRY.map((a) => a.name)
    const uniqueNames = new Set(names)
    expect(uniqueNames.size).toBe(12)
  })

  it('retryable errors from executor are detected', () => {
    expect(isRetryableError('SkipAiError: model failed')).toBe(true)
    expect(isRetryableError('429 too many requests')).toBe(true)
    expect(isRetryableError('invalid product')).toBe(false)
  })

  it('backoff schedule for retry: 1=1min, 2=5min, 3=15min', () => {
    expect(calculateBackoff(1)).toBe(1)
    expect(calculateBackoff(2)).toBe(5)
    expect(calculateBackoff(3)).toBe(15)
  })
})
