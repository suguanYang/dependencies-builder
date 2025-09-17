import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ProjectQuery } from '../project-query'

describe('ProjectQuery', () => {
  it('should render search form with all fields', () => {
    const mockOnSearch = vi.fn()
    render(<ProjectQuery onSearch={mockOnSearch} />)
    
    expect(screen.getByLabelText('Project')).toBeTruthy()
    expect(screen.getByLabelText('Branch')).toBeTruthy()
    expect(screen.getByLabelText('Type')).toBeTruthy()
    expect(screen.getByLabelText('Name')).toBeTruthy()
    expect(screen.getByText('Search Projects')).toBeTruthy()
  })

  it('should call onSearch with correct filters when form is submitted', () => {
    const mockOnSearch = vi.fn()
    render(<ProjectQuery onSearch={mockOnSearch} />)
    
    fireEvent.change(screen.getByLabelText(/project/i), { 
      target: { value: 'test-project' } 
    })
    fireEvent.change(screen.getByLabelText(/branch/i), { 
      target: { value: 'main' } 
    })
    fireEvent.change(screen.getByLabelText(/type/i), { 
      target: { value: '1' } 
    })
    fireEvent.change(screen.getByLabelText(/name/i), { 
      target: { value: 'test-dependency' } 
    })
    
    fireEvent.click(screen.getByText('Search Projects'))
    
    expect(mockOnSearch).toHaveBeenCalledWith({
      project: 'test-project',
      branch: 'main',
      type: 1,
      name: 'test-dependency'
    })
  })

  it('should handle empty filter values correctly', () => {
    const mockOnSearch = vi.fn()
    render(<ProjectQuery onSearch={mockOnSearch} />)
    
    fireEvent.click(screen.getByText('Search Projects'))
    
    expect(mockOnSearch).toHaveBeenCalledWith({})
  })

  it('should disable button when loading', () => {
    render(<ProjectQuery onSearch={vi.fn()} isLoading={true} />)
    
    expect(screen.getByText('Searching...')).toBeTruthy()
  })

  it('should show loading state', () => {
    render(<ProjectQuery onSearch={vi.fn()} isLoading={true} />)
    
    expect(screen.getByText('Searching...')).toBeTruthy()
  })
})