jest.mock('@/lib/db', () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getDb: jest.fn(),
  resetPool: jest.fn(),
}))

import { getDb } from '@/lib/db'
import { GET } from '@/app/api/dashboard/stats/route'

const mockExecute = jest.fn()
beforeEach(() => {
  jest.clearAllMocks()
  ;(getDb as jest.Mock).mockReturnValue({ execute: mockExecute })
})

describe('GET /api/dashboard/stats', () => {
  it('returns publishedDepartments, assetsByTier, and other stats', async () => {
    // Promise.all runs 5 queries in parallel: depts, lifecycle, tiers, projects, strategies
    mockExecute
      .mockResolvedValueOnce([[{ count: 4 }]])                              // departments
      .mockResolvedValueOnce([[{ status: 'Production', count: 10 }]])       // lifecycle
      .mockResolvedValueOnce([[{ tier: 'Tier 1', count: 3 }]])              // tiers
      .mockResolvedValueOnce([[{ count: 2 }]])                              // projects
      .mockResolvedValueOnce([[{ strategy: 'Emerging', count: 5 }]])        // strategies
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('publishedDepartments')
    expect(body).toHaveProperty('assetsByTier')
    expect(body).toHaveProperty('assetsByLifecycle')
    expect(body).toHaveProperty('activeProjects')
    expect(body).toHaveProperty('assetsByStrategy')
  })

  it('returns 500 when DB throws', async () => {
    mockExecute.mockRejectedValueOnce(new Error('fail'))
    const res = await GET()
    expect(res.status).toBe(500)
  })
})
