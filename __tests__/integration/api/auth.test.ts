// __tests__/integration/api/auth.test.ts
import { NextRequest } from 'next/server'
import { config } from 'dotenv'

config({ path: '.env.test' })

import { resetPool, setupDatabase } from '@/lib/db'

beforeAll(async () => {
  resetPool()
  await setupDatabase()
})

afterAll(() => resetPool())

function makeReq(path: string, body: object) {
  return new NextRequest(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const testEmail = `test_${Date.now()}@pixel.test`
const testPassword = 'TestPass123!'
const testName = 'Integration Tester'

describe('POST /api/auth/register + login (integration)', () => {
  afterAll(async () => {
    const { getDb } = await import('@/lib/db')
    await getDb().execute('DELETE FROM users WHERE email = ?', [testEmail])
  })

  it('registers a new user and returns 201', async () => {
    const { POST } = await import('@/app/api/auth/register/route')
    const res = await POST(makeReq('/api/auth/register', {
      name: testName, email: testEmail, password: testPassword,
    }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.user.email).toBe(testEmail)
    expect(body.user.role).toBe('Member')
  })

  it('returns 409 when registering the same email again', async () => {
    const { POST } = await import('@/app/api/auth/register/route')
    const res = await POST(makeReq('/api/auth/register', {
      name: testName, email: testEmail, password: testPassword,
    }))
    expect(res.status).toBe(409)
  })

  it('logs in with the registered credentials and returns user', async () => {
    const { POST } = await import('@/app/api/auth/login/route')
    const res = await POST(makeReq('/api/auth/login', {
      email: testEmail, password: testPassword,
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.user.email).toBe(testEmail)
    expect(body.user.password).toBeUndefined()
  })

  it('returns 401 with wrong password', async () => {
    const { POST } = await import('@/app/api/auth/login/route')
    const res = await POST(makeReq('/api/auth/login', {
      email: testEmail, password: 'wrongpassword',
    }))
    expect(res.status).toBe(401)
  })
})
