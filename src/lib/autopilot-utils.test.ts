import { describe, it, expect } from 'vitest'
import { createHmac } from 'crypto'
import {
  evaluateCondition,
  evaluateConditions,
  buildShopifyDedupKey,
  buildManualDedupKey,
  isCooldownActive,
  canRoleApprove,
  canManageRules,
  canToggleAutopilot,
  resolveAutonomyMode,
  isRetryableError,
  calculateBackoff,
  canExecuteAction,
  isScheduledForReady,
  shouldProcessJob,
  buildIdempotencyKey,
  constantTimeCompare,
  canAccessStore,
  shouldExecuteApproval,
  getNotificationSeverityForExecution,
  resolveLocalProductId,
  validateSeoOutput,
  validateInstagramOutput,
  ACTION_REGISTRY,
  UNSAFE_ACTIONS,
  UNIMPLEMENTED_ACTIONS,
} from './autopilot-utils'

describe('Autopilot Utils', () => {
  it('1. equals condition', () => {
    expect(
      evaluateCondition(
        { field: 'status', operator: 'equals', value: 'active' },
        { status: 'active' },
      ),
    ).toBe(true)
    expect(
      evaluateCondition(
        { field: 'status', operator: 'equals', value: 'active' },
        { status: 'draft' },
      ),
    ).toBe(false)
  })

  it('2. less_or_equal condition', () => {
    expect(
      evaluateCondition(
        { field: 'inventory.quantity', operator: 'less_or_equal', value: 3 },
        { inventory: { quantity: 2 } },
      ),
    ).toBe(true)
    expect(
      evaluateCondition(
        { field: 'inventory.quantity', operator: 'less_or_equal', value: 3 },
        { inventory: { quantity: 5 } },
      ),
    ).toBe(false)
  })

  it('3. all conditions', () => {
    const conditions = {
      all: [
        { field: 'status', operator: 'equals', value: 'active' },
        { field: 'count', operator: 'greater_than', value: 0 },
      ],
    }
    expect(evaluateConditions(conditions, { status: 'active', count: 5 })).toBe(true)
    expect(evaluateConditions(conditions, { status: 'active', count: 0 })).toBe(false)
    expect(evaluateConditions(conditions, { status: 'draft', count: 5 })).toBe(false)
  })

  it('4. any conditions', () => {
    const conditions = {
      any: [
        { field: 'status', operator: 'equals', value: 'active' },
        { field: 'status', operator: 'equals', value: 'pending' },
      ],
    }
    expect(evaluateConditions(conditions, { status: 'active' })).toBe(true)
    expect(evaluateConditions(conditions, { status: 'pending' })).toBe(true)
    expect(evaluateConditions(conditions, { status: 'draft' })).toBe(false)
  })

  it('5. webhook quantity=10 does not create low stock job', () => {
    const conditions = {
      all: [{ field: 'inventory.quantity', operator: 'less_or_equal', value: 3 }],
    }
    expect(evaluateConditions(conditions, { inventory: { quantity: 10 } })).toBe(false)
  })

  it('6. quantity=2 creates job', () => {
    const conditions = {
      all: [{ field: 'inventory.quantity', operator: 'less_or_equal', value: 3 }],
    }
    expect(evaluateConditions(conditions, { inventory: { quantity: 2 } })).toBe(true)
  })

  it('7. cooldown product A does not block product B', () => {
    const lastExecA = new Date().toISOString()
    const cooldownMin = 720
    expect(isCooldownActive(lastExecA, cooldownMin)).toBe(true)
    expect(isCooldownActive(null, cooldownMin)).toBe(false)
  })

  it('8. same webhook ID is deduplicated', () => {
    const key1 = buildShopifyDedupKey(
      'store1',
      'wh-123',
      null,
      'shop.myshopify.com',
      'products/update',
      '123',
      '2026-01-01',
    )
    const key2 = buildShopifyDedupKey(
      'store1',
      'wh-123',
      null,
      'shop.myshopify.com',
      'products/update',
      '123',
      '2026-01-01',
    )
    expect(key1).toBe(key2)
  })

  it('9. two different webhook IDs on same product are processed', () => {
    const key1 = buildShopifyDedupKey(
      'store1',
      'wh-123',
      null,
      'shop.myshopify.com',
      'products/update',
      '123',
      '2026-01-01',
    )
    const key2 = buildShopifyDedupKey(
      'store1',
      'wh-456',
      null,
      'shop.myshopify.com',
      'products/update',
      '123',
      '2026-01-02',
    )
    expect(key1).not.toBe(key2)
  })

  it('10. unsafe action never AUTOPILOT', () => {
    expect(resolveAutonomyMode('AUTOPILOT', false)).toBe('APPROVAL')
    expect(resolveAutonomyMode('AUTOPILOT', true)).toBe('AUTOPILOT')
  })

  it('11. unimplemented action never COMPLETED', () => {
    const action = ACTION_REGISTRY.find((a) => a.name === 'CREATE_SHOPIFY_DRAFT')!
    expect(canExecuteAction(action)).toBe(false)
  })

  it('12. VIEWER cannot approve', () => {
    expect(canRoleApprove('VIEWER', 'LOW')).toBe(false)
    expect(canRoleApprove('VIEWER', 'HIGH')).toBe(false)
  })

  it('13. EDITOR cannot configure a rule', () => {
    expect(canManageRules('EDITOR')).toBe(false)
    expect(canManageRules('VIEWER')).toBe(false)
    expect(canManageRules('ADMIN')).toBe(true)
    expect(canManageRules('OWNER')).toBe(true)
  })

  it('14. ADMIN cannot approve CRITICAL', () => {
    expect(canRoleApprove('ADMIN', 'CRITICAL')).toBe(false)
  })

  it('15. OWNER approves CRITICAL', () => {
    expect(canRoleApprove('OWNER', 'CRITICAL')).toBe(true)
  })

  it('16. tenant A cannot access tenant B', () => {
    expect(canAccessStore('store-A', 'store-B')).toBe(false)
    expect(canAccessStore('store-A', 'store-A')).toBe(true)
  })

  it('17. retry respects scheduled_for', () => {
    const future = new Date(Date.now() + 5 * 60 * 1000).toISOString()
    const past = new Date(Date.now() - 60 * 1000).toISOString()
    expect(isScheduledForReady(future)).toBe(false)
    expect(isScheduledForReady(past)).toBe(true)
    expect(isScheduledForReady(null)).toBe(true)
  })

  it('18. AUTOPILOT paused does not execute RETRYING', () => {
    expect(shouldProcessJob('RETRYING', false, null)).toBe(false)
    expect(shouldProcessJob('QUEUED', false, null)).toBe(false)
    const past = new Date(Date.now() - 60000).toISOString()
    expect(shouldProcessJob('RETRYING', true, past)).toBe(true)
  })

  it('19. duplicate approval does not execute twice', () => {
    expect(shouldExecuteApproval('PENDING', 'WAITING_APPROVAL')).toBe(true)
    expect(shouldExecuteApproval('APPROVED', 'RUNNING')).toBe(false)
    expect(shouldExecuteApproval('APPROVED', 'COMPLETED')).toBe(false)
  })

  it('20. failed approval execution does not generate SUCCESS', () => {
    expect(getNotificationSeverityForExecution('FAILED')).not.toBe('SUCCESS')
    expect(getNotificationSeverityForExecution('FAILED')).toBe('ERROR')
    expect(getNotificationSeverityForExecution('COMPLETED')).toBe('SUCCESS')
  })

  it('21. Shopify ID resolves to local product ID', () => {
    const products = [
      { id: 'local-1', shopify_id: 'gid://shopify/Product/123' },
      { id: 'local-2', shopify_id: 'gid://shopify/Product/456' },
    ]
    expect(resolveLocalProductId(products, 'gid://shopify/Product/123')).toBe('local-1')
    expect(resolveLocalProductId(products, 'gid://shopify/Product/999')).toBe(null)
  })

  it('22. invalid AI JSON is not saved', () => {
    expect(validateSeoOutput(null)).toBe(false)
    expect(validateSeoOutput({ seo_title: 'OK' })).toBe(false)
    expect(
      validateSeoOutput({
        seo_title: 'OK',
        meta_description: 'd',
        keywords: 'k',
        slug: 's',
        alt_text: 'a',
      }),
    ).toBe(true)
    expect(validateInstagramOutput(null)).toBe(false)
    expect(validateInstagramOutput({ caption: 'ok', hashtags: '#tags' })).toBe(true)
  })

  it('23. invalid HMAC returns 401', () => {
    const payload = '{"test":true}'
    const secret = 'test-secret'
    const validSig = createHmac('sha256', secret).update(payload).digest('base64')
    expect(constantTimeCompare(validSig, 'invalid-signature')).toBe(false)
    expect(constantTimeCompare(validSig, validSig)).toBe(true)
    expect(constantTimeCompare('', '')).toBe(true)
    expect(constantTimeCompare('abc', 'abcd')).toBe(false)
  })
})
