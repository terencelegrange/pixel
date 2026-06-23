// __tests__/ui/components/ui/Modal.test.tsx
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { Modal } from '@/components/ui/Modal'

describe('Modal', () => {
  it('renders nothing when isOpen is false', () => {
    render(<Modal isOpen={false} onClose={jest.fn()} title="Test"><p>Content</p></Modal>)
    expect(screen.queryByText('Content')).not.toBeInTheDocument()
  })

  it('renders title and children when isOpen is true', () => {
    render(<Modal isOpen onClose={jest.fn()} title="My Modal"><p>Modal body</p></Modal>)
    expect(screen.getByText('My Modal')).toBeInTheDocument()
    expect(screen.getByText('Modal body')).toBeInTheDocument()
  })

  it('calls onClose when Escape key is pressed', () => {
    const onClose = jest.fn()
    render(<Modal isOpen onClose={onClose} title="Test"><p>body</p></Modal>)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when backdrop is clicked', () => {
    const onClose = jest.fn()
    render(<Modal isOpen onClose={onClose} title="Test"><p>body</p></Modal>)
    const backdrop = document.querySelector('.absolute.inset-0') as HTMLElement
    fireEvent.click(backdrop)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('sets body overflow to hidden when open', () => {
    render(<Modal isOpen onClose={jest.fn()} title="Test"><p>body</p></Modal>)
    expect(document.body.style.overflow).toBe('hidden')
  })

  it('calls onClose when the X button is clicked', () => {
    const onClose = jest.fn()
    render(<Modal isOpen onClose={onClose} title="Test"><p>body</p></Modal>)
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
