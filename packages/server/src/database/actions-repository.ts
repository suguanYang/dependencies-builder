import { prisma } from "./prisma"

export interface CreateActionData {
  projectAddr?: string
  projectName?: string
  branch?: string
  type: 'static_analysis' | 'report' | 'connection_auto_create'
  targetBranch?: string
}

export interface UpdateActionData {
  status?: 'pending' | 'running' | 'completed' | 'failed'
  result?: any
  error?: string
}

export interface ActionQuery {
  type?: 'static_analysis' | 'report' | 'connection_auto_create'
  status?: 'pending' | 'running' | 'completed' | 'failed'
  limit?: number
  offset?: number
}

export async function getActions(query: ActionQuery = {}) {
  const { limit = 100, offset = 0, ...where } = query

  const [data, total] = await Promise.all([
    prisma.action.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.action.count(),
  ])

  return { data, total }
}

export async function getActionById(id: string) {
  return prisma.action.findUnique({
    where: { id },
  })
}

export async function createAction(actionData: CreateActionData) {
  const parameters: Record<string, any> = {}

  // Only include project and branch if they exist (for connection_auto_create they won't)
  if (actionData.branch) parameters.branch = actionData.branch
  if (actionData.targetBranch) parameters.targetBranch = actionData.targetBranch
  if (actionData.projectName) parameters.projectName = actionData.projectName
  if (actionData.projectAddr) parameters.projectAddr = actionData.projectAddr

  return prisma.action.create({
    data: {
      status: 'pending',
      type: actionData.type,
      parameters,
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

export async function countRunningActions(): Promise<number> {
  return prisma.action.count({
    where: { status: 'running' },
  })
}