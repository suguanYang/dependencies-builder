import { ConnectionWorkerPool } from '../workers/worker-pool'
import * as repository from '../database/repository'

export class ConnectionScheduler {
    private static instance: ConnectionScheduler
    private pollingInterval: NodeJS.Timeout | null = null
    private readonly DELAY_MS = 10 * 60 * 1000 // 10 minutes
    private readonly POLLING_INTERVAL_MS = 30 * 1000 // 30 seconds

    private constructor() { }

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
                    console.log('Connection auto-create is already running.')
                    return existingAction
                }

                if (existingAction.status === 'pending') {
                    if (isManualTrigger) {
                        // If manual trigger, we advance the task to now
                        const now = new Date()
                        const updatedAction = await repository.updateAction(existingAction.id, {
                            scheduledFor: now
                        })
                        console.log(`Advanced scheduled connection auto-create task (Action ID: ${existingAction.id}) to now`)
                        return updatedAction
                    } else {
                        // If auto trigger (node change), we debounce (do nothing if already pending)
                        console.log(`Connection auto-create already scheduled (Action ID: ${existingAction.id}). Debouncing.`)
                        return existingAction
                    }
                }
            }

            // Create a new pending action
            // If manual, schedule for now. If auto, schedule for future.
            const scheduledFor = isManualTrigger ? new Date() : new Date(Date.now() + this.DELAY_MS)

            const action = await repository.createAction({
                type: 'connection_auto_create',
                scheduledFor,
            })

            console.log(`Scheduled connection auto-create task (Action ID: ${action.id}) for ${scheduledFor.toISOString()}`)
            return action

        } catch (error) {
            console.error('Failed to schedule connection auto-create:', error)
            throw error
        }
    }

    public startPolling() {
        if (this.pollingInterval) {
            return
        }

        console.log('Starting connection scheduler polling...')
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
            const task = await repository.findAndLockNextScheduledTask()

            if (task) {
                console.log(`Picked up scheduled task (Action ID: ${task.id})`)
                this.executeTask(task.id)
            }
        } catch (error) {
            console.error('Error during connection scheduler polling:', error)
        }
    }

    private async executeTask(actionId: string) {
        try {
            await ConnectionWorkerPool.getPool().executeConnectionAutoCreation(actionId)
        } catch (error) {
            console.error(`Failed to execute connection auto-create task ${actionId}:`, error)
        }
    }
}
