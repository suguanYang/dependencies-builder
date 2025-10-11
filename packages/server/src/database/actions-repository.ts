import { prisma } from "./prisma"

export interface CreateActionData {
  project: string
  branch: string
  type: 'static_analysis' | 'report'
}

export interface UpdateActionData {
  status?: 'pending' | 'running' | 'completed' | 'failed'
  result?: any
  error?: string
}

export interface ActionQuery {
  project?: string
  branch?: string
  type?: 'static_analysis' | 'report'
  status?: 'pending' | 'running' | 'completed' | 'failed'
  limit?: number
  offset?: number
}

export async function getActions(query: ActionQuery = {}) {
  const { limit = 100, offset = 0, ...where } = query

  const [data, total] = await Promise.all([
    prisma.action.findMany({
      where: {
        ...(where.project && { project: where.project }),
        ...(where.branch && { branch: where.branch }),
        ...(where.type && { type: where.type }),
        ...(where.status && { status: where.status }),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.action.count({
      where: {
        ...(where.project && { project: where.project }),
        ...(where.branch && { branch: where.branch }),
        ...(where.type && { type: where.type }),
        ...(where.status && { status: where.status }),
      },
    }),
  ])

  return { data, total }
}

export async function getActionById(id: string) {
  return prisma.action.findUnique({
    where: { id },
  })
}

export async function createAction(actionData: CreateActionData) {
  return prisma.action.create({
    data: {
      status: 'pending',
      project: actionData.project,
      branch: actionData.branch,
      type: actionData.type,
    },
  })
}

export async function updateAction(id: string, updates: UpdateActionData) {
  return prisma.action.update({
    where: { id },
    data: {
      ...updates,
      updatedAt: new Date(),
    },
  })
}

export async function deleteAction(id: string) {
  try {
    await prisma.action.delete({
      where: { id },
    })
    return true
  } catch (error) {
    return false
  }
}

export async function getActionsByStatus(status: 'pending' | 'running' | 'completed' | 'failed') {
  return prisma.action.findMany({
    where: { status },
    orderBy: { createdAt: 'asc' },
  })
}