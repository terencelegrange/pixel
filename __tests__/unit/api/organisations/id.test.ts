import { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  setupDatabase: jest.fn().mockResolvedValue(undefined),
  getDb: jest.fn(),
  resetPool: jest.fn(),
}))
jest.mock('@/lib/audit', () => ({ writeAudit: jest.fn().mockResolvedValue(undefined) }))

import { getDb } from '@/lib/db'
import { PUT, DELETE } from '@/app/api/organisations/[id]/route'

const mockExecute = jest.fn()
const params = { params: { id: 'dept-1' } }
const dbDept = { id: 'dept-1', name: 'IT', description: null, status: 'Published' }

beforeEach(() => {
  jest.clearAllMocks()
  ;(getDb as jest.Mock).mockReturnValue({ execute: mockExecute })
})

const makeReq = (method: string, body: object) => new NextRequest('http://localhost/', {
  method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
})

describe('PUT /api/organisations/[id]', () => {
  it('returns 404 when not found', async () => {
    mockExecute.mockResolvedValueOnce([[]])  // SELECT current — not found
    const res = await PUT(makeReq('PUT', { name: 'Finance', userId: 'u1', userName: 'Admin' }), params)
    expect(res.status).toBe(404)
  })

  it('returns 200 on success', async () => {
    mockExecute.mockResolvedValueOnce([[dbDept]])  // SELECT current
    mockExecute.mockResolvedValueOnce([[]])         // name uniqueness check
    mockExecute.mockResolvedValueOnce([{}])         // UPDATE
    const res = await PUT(makeReq('PUT', { name: 'Finance', userId: 'u1', userName: 'Admin' }), params)
    expect(res.status).toBe(200)
  })
})

describe('DELETE /api/organisations/[id]', () => {
  it('returns 404 when not found', async () => {
    mockExecute.mockResolvedValueOnce([[]])
    const res = await DELETE(makeReq('DELETE', { userId: 'u1', userName: 'Admin' }), params)
    expect(res.status).toBe(404)
  })

  it('returns 200 on success', async () => {
    mockExecute.mockResolvedValueOnce([[dbDept]])
    mockExecute.mockResolvedValueOnce([{}])
    const res = await DELETE(makeReq('DELETE', { userId: 'u1', userName: 'Admin' }), params)
    expect(res.status).toBe(200)
  })
})
