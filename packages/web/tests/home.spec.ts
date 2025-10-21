import { test, expect } from '@playwright/test'

test.describe('Home Page', () => {
  test('should display the main heading', async ({ page }) => {
    await page.goto('/')
    
    await expect(page.getByRole('heading', { 
      name: 'Dependency Management System' 
    })).toBeVisible()
    
    await expect(page.getByText('Visualize and manage project dependencies')).toBeVisible()
  })

  test('should display the search form', async ({ page }) => {
    await page.goto('/')
    
    await expect(page.getByLabel('Project')).toBeVisible()
    await expect(page.getByLabel('Branch')).toBeVisible()
    await expect(page.getByLabel('Type')).toBeVisible()
    await expect(page.getByLabel('Name')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Search Projects' })).toBeVisible()
  })

  test('should show empty state message', async ({ page }) => {
    await page.goto('/')
    
    await expect(page.getByText(
      'Use the search form above to find projects and visualize dependencies.'
    )).toBeVisible()
  })

  test('should handle search form submission', async ({ page }) => {
    await page.goto('/')
    
    // Fill in the search form
    await page.getByLabel('Project').fill('test-project')
    await page.getByLabel('Branch').fill('main')
    await page.getByLabel('Type').selectOption('0')
    await page.getByLabel('Name').fill('test-dependency')
    
    // Mock the API response
    await page.route('**/nodes?*', async route => {
      const json = [
        {
          id: '1',
          name: 'test-dependency',
          projectName: 'test-project',
          type: 0,
          branch: 'main'
        }
      ]
      await route.fulfill({ json })
    })
    
    await page.route('**/connections?*', async route => {
      const json = [
        {
          id: 'conn1',
          from: '1',
          to: '2'
        }
      ]
      await route.fulfill({ json })
    })
    
    // Submit the form
    await page.getByRole('button', { name: 'Search Projects' }).click()
    
    // Wait for results to appear
    await expect(page.getByText('Dependency Graph')).toBeVisible()
    await expect(page.getByText('Showing 1 nodes and 1 connections')).toBeVisible()
  })

  test('should display error message on API failure', async ({ page }) => {
    await page.goto('/')
    
    // Mock API failure
    await page.route('**/nodes?*', async route => {
      await route.fulfill({
        status: 404,
        contentType: 'text/plain',
        body: 'Not Found'
      })
    })
    
    await page.getByRole('button', { name: 'Search Projects' }).click()
    
    await expect(page.getByText('Failed to fetch nodes: Not Found')).toBeVisible()
  })
})