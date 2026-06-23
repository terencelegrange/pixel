// __tests__/ui/components/ui/Button.test.tsx
import React from 'react'
import { render, screen } from '@testing-library/react'
import { Button } from '@/components/ui/Button'

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument()
  })

  it('applies primary variant classes by default', () => {
    render(<Button>Save</Button>)
    expect(screen.getByRole('button')).toHaveClass('bg-brand-600')
  })

  it('applies secondary variant classes', () => {
    render(<Button variant="secondary">Cancel</Button>)
    expect(screen.getByRole('button')).toHaveClass('bg-slate-100')
  })

  it('applies danger variant classes', () => {
    render(<Button variant="danger">Delete</Button>)
    expect(screen.getByRole('button')).toHaveClass('bg-red-600')
  })

  it('applies ghost variant classes', () => {
    render(<Button variant="ghost">More</Button>)
    expect(screen.getByRole('button')).toHaveClass('text-slate-600')
  })

  it('is disabled when disabled prop is true', () => {
    render(<Button disabled>Disabled</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('is disabled when isLoading is true', () => {
    render(<Button isLoading>Loading</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('applies w-full when fullWidth is true', () => {
    render(<Button fullWidth>Full</Button>)
    expect(screen.getByRole('button')).toHaveClass('w-full')
  })
})
