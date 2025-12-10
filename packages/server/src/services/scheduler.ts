import { ConnectionWorkerPool } from '../workers/worker-pool'
import * as repository from '../database/repository'
import { error as errlog, info } from '../logging'

export class ConnectionScheduler {
  private static instance: ConnectionScheduler
  private pollingInterval: NodeJS.Timeout | null = null
  private readonly DELAY_MS = 10 * 60 * 1000 // 10 minutes
  private readonly POLLING_INTERVAL_MS = 30 * 1000 // 30 seconds

  private constructor() {}

  public static getInstance(): ConnectionScheduler {
    if (!ConnectionScheduler.instance) {
      ConnectionScheduler.instance = new ConnectionScheduler()
    }
    return ConnectionScheduler.instance
  }

  public async scheduleConnectionAutoCreate(isManualTrigger: boolean = false) {
    try {
      // Find existing pending/running action of type 'connection_auto_create'
      const existingAction = await repository.findActiveActionByType('connection_auto_create')

      if (existingAction) {
        if (existingAction.status === 'running') {
          // If running, we do nothing.
          // Ideally we might want to queue another one if changes happened during run,
          // but for now let's keep it simple.
          info('Connection auto-create is already running.')
          return existingAction
        }

        if (existingAction.status === 'pending') {
          if (isManualTrigger) {
            // If manual trigger, we try to lock and advance the task to now
            const lockedAction = await repository.claimAction(existingAction.id)

            if (lockedAction) {
              info(
                `Advanced scheduled connection auto-create task (Action ID: ${existingAction.id}) to now`,
              )
              this.executeTask(lockedAction.id)
              return lockedAction
            } else {
              // If lock failed, it might have been picked up by poller or changed status.
              // We return the existing action (or re-fetch if needed, but existing is fine for API response)
              info(
                `Failed to lock action ${existingAction.id} for manual trigger. It may be already running.`,
              )
              return existingAction
            }
          } else {
            // If auto trigger (node change), we debounce (do nothing if already pending)
            info(
              `Connection auto-create already scheduled (Action ID: ${existingAction.id}). Debouncing.`,
            )
            return existingAction
          }
        }
      }

      // Create a new pending action
      // If manual, schedule for now. If auto, schedule for future.
      const scheduledFor = isManualTrigger ? new Date() : new Date(Date.now() + this.DELAY_MS)
      const status = isManualTrigger ? 'running' : 'pending'

      const action = await repository.createAction({
        type: 'connection_auto_create',
        scheduledFor,
        status, // Create as running if manual to reserve it immediately
      })

      info(
        `Scheduled connection auto-create task (Action ID: ${action.id}) for ${scheduledFor.toISOString()}`,
      )

      if (isManualTrigger) {
        // Trigger execution immediately
        // Note: We already set it to running, so poller won't pick it up. We MUST execute it.
        this.executeTask(action.id)
      }

      return action
    } catch (err) {
      errlog('Failed to schedule connection auto-create')
      throw err
    }
  }

  public startPolling() {
    if (this.pollingInterval) {
      return
    }

    info('Starting connection scheduler polling...')
    this.pollingInterval = setInterval(() => {
      this.poll()
    }, this.POLLING_INTERVAL_MS)

    // Initial poll
    this.poll()
  }

  public stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval)
      this.pollingInterval = null
    }
  }

  private async poll() {
    try {
      const task = await repository.claimNextAvailableAction('connection_auto_create')

      if (task) {
        info(`Picked up scheduled task (Action ID: ${task.id})`)
        this.executeTask(task.id)
      }
    } catch (error) {
      errlog('Error during connection scheduler polling: ' + error?.toString())
    }
  }

  private async executeTask(actionId: string) {
    try {
      await ConnectionWorkerPool.getPool().executeConnectionAutoCreation(actionId)
    } catch (error) {
      errlog(`Failed to execute connection auto-create task ${actionId}: ` + error?.toString())
    }
  }
}
