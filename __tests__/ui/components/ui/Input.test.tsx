// __tests__/ui/components/ui/Input.test.tsx
import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Input } from '@/components/ui/Input'

describe('Input', () => {
  it('renders label text', () => {
    render(<Input label="Email address" />)
    expect(screen.getByText('Email address')).toBeInTheDocument()
  })

  it('renders error message', () => {
    render(<Input error="This field is required." />)
    expect(screen.getByText('This field is required.')).toBeInTheDocument()
  })

  it('renders hint text when no error', () => {
    render(<Input hint="We will never share your email." />)
    expect(screen.getByText('We will never share your email.')).toBeInTheDocument()
  })

  it('does not render hint when error is present', () => {
    render(<Input hint="Hint text" error="Error text" />)
    expect(screen.queryByText('Hint text')).not.toBeInTheDocument()
  })

  it('toggles password visibility when showToggle is used', async () => {
    const user = userEvent.setup()
    render(<Input type="password" showToggle label="Password" />)
    const input = screen.getByLabelText('Password')
    expect(input).toHaveAttribute('type', 'password')
    await user.click(screen.getByRole('button', { name: 'Show password' }))
    expect(input).toHaveAttribute('type', 'text')
    await user.click(screen.getByRole('button', { name: 'Hide password' }))
    expect(input).toHaveAttribute('type', 'password')
  })
})
